// QA (network): real-app connectivity scenarios, driven through the UI.
//
//   node scripts/qa-network/net-e2e.mjs <scenario> [baseUrl]
//     turn        both players forced to relay-only through a TURN server (elixir-webrtc
//                 public dev relay, fresh creds) injected by wrapping RTCPeerConnection:
//                 join time, ICE path, bytes on the data channel for lobby + one round.
//     noturn      guest forced to relay-only with no TURN (= both sides behind symmetric
//                 NAT/CGNAT without a relay): what the player sees and after how long.
//     sigdown     0.peerjs.com does not resolve (NXDOMAIN): create + join.
//     sigblack    0.peerjs.com blackholed (192.0.2.1, TCP SYN never answered): create + join.
//
// Screenshots: scripts/qa-network/shots/<scenario>-*.png
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const SCENARIO = process.argv[2] ?? 'turn'
const BASE = process.argv[3] ?? 'http://127.0.0.1:5306/'
const OUT = new URL('./shots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const T0 = Date.now()
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1).padStart(6)}s]`, ...a)

const MESSAGES = [
  'Connessione di rete non disponibile',
  'Il server di connessione non risponde',
  'Impossibile collegarsi all’host',
  'Stanza non trovata',
  'Impossibile caricare il modulo di rete',
  'Errore di connessione imprevisto',
  'Impossibile entrare nella stanza',
  'Impossibile creare la stanza',
  'L’host non risponde',
  'Problema di rete',
  'Server di collegamento non raggiungibile',
  'Nessuna risposta dal server',
]

const args = ['--autoplay-policy=no-user-gesture-required']
if (SCENARIO === 'sigdown') args.push('--host-resolver-rules=MAP 0.peerjs.com ~NOTFOUND')
if (SCENARIO === 'sigblack') args.push('--host-resolver-rules=MAP 0.peerjs.com 192.0.2.1')
const browser = await chromium.launch({ channel: 'chrome', headless: !process.env.HEADFUL, args })

async function elixirCreds() {
  const r = await fetch('https://turn.elixir-webrtc.org/?service=turn&username=unshuffleqa', { method: 'POST' })
  const j = await r.json()
  return [{ urls: 'turn:turn.elixir-webrtc.org:3478?transport=udp', username: j.username, credential: j.password }]
}

/** ice: { policy?, servers? } overrides every RTCPeerConnection the app creates. */
async function openPlayer(name, opts, ice) {
  const ctx = await browser.newContext(opts)
  await ctx.addInitScript(
    ({ ice }) => {
      try {
        localStorage.setItem('unshuffle:onboarded', String(Date.now()))
      } catch {
        /* ignore */
      }
      const Native = window.RTCPeerConnection
      window.__pcs = []
      window.__tx = { frames: 0, bytes: 0, maxFrame: 0 }
      window.RTCPeerConnection = class extends Native {
        constructor(cfg = {}) {
          const c = { ...cfg }
          if (ice?.servers) c.iceServers = ice.servers
          if (ice?.policy) c.iceTransportPolicy = ice.policy
          super(c)
          window.__pcs.push(this)
        }
      }
      const send = RTCDataChannel.prototype.send
      RTCDataChannel.prototype.send = function (d) {
        const n = d?.byteLength ?? d?.size ?? d?.length ?? 0
        window.__tx.frames++
        window.__tx.bytes += n
        if (n > window.__tx.maxFrame) window.__tx.maxFrame = n
        return send.call(this, d)
      }
    },
    { ice },
  )
  const page = await ctx.newPage()
  page.on('dialog', (d) => void d.accept().catch(() => {}))
  page.on('pageerror', (e) => log(`[${name}] pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') log(`[${name}] console.error: ${m.text().slice(0, 200)}`)
  })
  return page
}

const frame = (page, screen) => page.locator(`[data-screen-frame][data-screen="${screen}"]:not([inert])`)
const waitScreen = (page, screen, timeout = 30_000) => frame(page, screen).waitFor({ state: 'visible', timeout })
const waitPhase = (page, kind, timeout = 90_000) =>
  page.waitForFunction((k) => document.querySelector(`[data-screen-frame]:not([inert]) [data-phase="${k}"]`) !== null, kind, {
    timeout,
    polling: 100,
  })
async function waitMessage(page, timeout = 90_000) {
  const h = await page.waitForFunction(
    (msgs) => {
      const text = document.body.innerText
      return msgs.find((m) => text.includes(m)) ?? null
    },
    MESSAGES,
    { timeout, polling: 100 },
  )
  return h.jsonValue()
}
async function iceSummary(page) {
  return page.evaluate(async () => {
    const out = []
    for (const pc of window.__pcs) {
      if (pc.connectionState !== 'connected') continue
      const stats = await pc.getStats()
      const row = {}
      stats.forEach((r) => {
        if (r.type === 'candidate-pair' && r.nominated && r.state === 'succeeded') {
          const l = stats.get(r.localCandidateId)
          const rm = stats.get(r.remoteCandidateId)
          row.path = `${l?.candidateType}/${l?.relayProtocol ?? l?.protocol} ↔ ${rm?.candidateType}`
          row.rttMs = r.currentRoundTripTime != null ? Math.round(r.currentRoundTripTime * 1000) : null
        }
        if (r.type === 'data-channel') {
          row.dc = { label: r.label, sent: r.bytesSent, recv: r.bytesReceived, msgsSent: r.messagesSent, msgsRecv: r.messagesReceived }
        }
      })
      out.push(row)
    }
    return { pcs: window.__pcs.length, connected: out, tx: window.__tx }
  })
}
async function typeCodeAndJoin(page, code) {
  const firstBox = page.getByRole('textbox', { name: 'Codice stanza: lettera 1 di 5' })
  await firstBox.click()
  await page.keyboard.type(code.toLowerCase(), { delay: 30 })
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: /^Entra/ }).click()
}

try {
  if (SCENARIO === 'sigdown' || SCENARIO === 'sigblack') {
    const host = await openPlayer('host', { viewport: { width: 1280, height: 800 } })
    const guest = await openPlayer('guest', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    await Promise.all([host.goto(BASE), guest.goto(BASE)])
    await Promise.all([waitScreen(host, 'home'), waitScreen(guest, 'home')])
    await host.waitForTimeout(800)
    let t = Date.now()
    await host.getByRole('button', { name: 'Crea stanza', exact: true }).click()
    await host.waitForTimeout(1500)
    await host.screenshot({ path: `${OUT}${SCENARIO}-create-pending.png` })
    const m1 = await waitMessage(host)
    log(`create → "${m1}" after ${Date.now() - t} ms`)
    await host.waitForTimeout(400)
    await host.screenshot({ path: `${OUT}${SCENARIO}-create-error.png` })
    t = Date.now()
    await typeCodeAndJoin(guest, 'KXQPM')
    const m2 = await waitMessage(guest)
    log(`join → "${m2}" after ${Date.now() - t} ms`)
    await guest.waitForTimeout(400)
    await guest.screenshot({ path: `${OUT}${SCENARIO}-join-error.png` })
  } else if (SCENARIO === 'noturn') {
    const host = await openPlayer('host', { viewport: { width: 1280, height: 800 } })
    const guest = await openPlayer(
      'guest',
      { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
      { policy: 'relay', servers: [{ urls: 'stun:stun.l.google.com:19302' }] },
    )
    await Promise.all([host.goto(BASE), guest.goto(BASE)])
    await Promise.all([waitScreen(host, 'home'), waitScreen(guest, 'home')])
    await host.getByRole('button', { name: 'Crea stanza', exact: true }).click()
    await waitScreen(host, 'lobby')
    const code = await host.evaluate(() => /#\/r\/([A-Z]{5})/.exec(location.hash)?.[1] ?? null)
    log('room', code)
    const t = Date.now()
    await typeCodeAndJoin(guest, code)
    await guest.waitForTimeout(4000)
    await guest.screenshot({ path: `${OUT}noturn-join-pending.png` })
    const m = await waitMessage(guest)
    log(`join (no relay path) → "${m}" after ${Date.now() - t} ms`)
    await guest.waitForTimeout(400)
    await guest.screenshot({ path: `${OUT}noturn-join-error.png` })
    await host.screenshot({ path: `${OUT}noturn-host-lobby.png` })
    const hostPlayers = await host.evaluate(() => document.body.innerText.match(/\d+\s*\/\s*\d+/g))
    log('host lobby counters', hostPlayers)
  } else if (SCENARIO === 'turn') {
    const servers = await elixirCreds()
    const ice = { policy: 'relay', servers }
    const host = await openPlayer('host', { viewport: { width: 1280, height: 800 } }, ice)
    const guest = await openPlayer('guest', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, ice)
    await Promise.all([host.goto(BASE), guest.goto(BASE)])
    await Promise.all([waitScreen(host, 'home'), waitScreen(guest, 'home')])
    await host.getByRole('button', { name: 'Crea stanza', exact: true }).click()
    await waitScreen(host, 'lobby')
    const code = await host.evaluate(() => /#\/r\/([A-Z]{5})/.exec(location.hash)?.[1] ?? null)
    log('room', code)
    let t = Date.now()
    await typeCodeAndJoin(guest, code)
    await waitScreen(guest, 'lobby', 40_000)
    log(`guest in lobby via TURN after ${Date.now() - t} ms`)
    await host.waitForTimeout(1500)
    log('guest ICE', JSON.stringify(await iceSummary(guest)))
    const txLobby0 = await host.evaluate(() => ({ ...window.__tx }))
    await host.waitForTimeout(10_000)
    const txLobby1 = await host.evaluate(() => ({ ...window.__tx }))
    log(`host idle lobby 10 s: ${txLobby1.frames - txLobby0.frames} frames, ${txLobby1.bytes - txLobby0.bytes} B`)
    await Promise.all([host.screenshot({ path: `${OUT}turn-lobby-host.png` }), guest.screenshot({ path: `${OUT}turn-lobby-guest.png` })])

    const search = host.getByRole('searchbox', { name: 'Cerca playlist' })
    await search.click()
    await search.fill('hits 2000')
    const first = host.locator('section[aria-label="Scegli la playlist"] ul:not([aria-hidden]) li button[aria-pressed]').first()
    await first.waitFor({ state: 'visible', timeout: 20_000 })
    await host.waitForTimeout(600)
    await first.click()
    const setRadio = async (group, name) => host.getByRole('radiogroup', { name: group }).first().getByRole('radio', { name }).first().click()
    await setRadio('Round', '3')
    await setRadio('Spezzoni', /^6/)
    await setRadio('Timer finale', '10s')
    await host.waitForTimeout(800)
    const txStart = await host.evaluate(() => ({ ...window.__tx }))
    t = Date.now()
    await host.getByRole('button', { name: /Inizia partita/ }).first().click()
    await Promise.all([waitPhase(host, 'playing', 90_000), waitPhase(guest, 'playing', 90_000)])
    log(`start → playing on both (TURN) after ${Date.now() - t} ms`)
    await host.waitForTimeout(2500)
    const txPlay = await host.evaluate(() => ({ ...window.__tx }))
    log(`host tx start→playing: ${txPlay.frames - txStart.frames} frames, ${txPlay.bytes - txStart.bytes} B, max frame ${txPlay.maxFrame} B`)
    await guest.getByRole('button', { name: /^Conferma/ }).first().tap()
    await host.waitForTimeout(600)
    await host.getByRole('button', { name: /^Conferma/ }).first().click()
    await Promise.all([waitPhase(host, 'reveal', 40_000), waitPhase(guest, 'reveal', 40_000)])
    await host.waitForTimeout(2500)
    await Promise.all([host.screenshot({ path: `${OUT}turn-reveal-host.png` }), guest.screenshot({ path: `${OUT}turn-reveal-guest.png` })])
    const txEnd = await host.evaluate(() => ({ ...window.__tx }))
    log(`host tx playing→reveal: ${txEnd.frames - txPlay.frames} frames, ${txEnd.bytes - txPlay.bytes} B`)
    log('host ICE', JSON.stringify(await iceSummary(host)))
    log('guest ICE', JSON.stringify(await iceSummary(guest)))
    // State size as the guest received it
    const sizes = await guest.evaluate(() => window.__tx)
    log('guest tx totals', JSON.stringify(sizes))
  }
} catch (e) {
  log('ERROR', e.message.split('\n')[0])
  process.exitCode = 1
} finally {
  await browser.close()
}
