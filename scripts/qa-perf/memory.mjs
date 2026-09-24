// Memory over a long 2-player game (host desktop + guest phone, separate browsers), then Rigioca ×2.
// Dev server (:5308) so the page can import the store/engine modules for buffer counts.
// env ROUNDS=10 (3/5/7/10), REPLAYS=2, REPLAY_ROUNDS=3
import { chromium } from 'playwright'
import { execSync } from 'node:child_process'
import * as G from './game.mjs'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5308/'
const ROUNDS = Number(process.env.ROUNDS ?? 10)
const REPLAYS = Number(process.env.REPLAYS ?? 2)
const REPLAY_ROUNDS = String(process.env.REPLAY_ROUNDS ?? 3)
const OUT = new URL('./shots/', import.meta.url).pathname
const T0 = Date.now()
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0).padStart(4)}s]`, ...a)

async function player(device) {
  const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required', '--js-flags=--expose-gc'] })
  const { ctx, page } = await G.newPlayer(browser, device)
  const cdp = await ctx.newCDPSession(page)
  const bcdp = await browser.newBrowserCDPSession()
  await cdp.send('Memory.enable').catch(() => {})
  return { browser, ctx, page, cdp, bcdp, device }
}
async function snapshot(p, label) {
  await p.cdp.send('HeapProfiler.collectGarbage')
  await p.cdp.send('HeapProfiler.collectGarbage')
  const heap = await p.cdp.send('Runtime.getHeapUsage')
  const dom = await p.cdp.send('Memory.getDOMCounters')
  let detached = null
  try { const r = await p.cdp.send('DOM.getDetachedDomNodes'); detached = r.detachedNodes?.length ?? null } catch { detached = 'n/a' }
  let leak = null
  try { leak = await p.cdp.send('Memory.getDOMCountersForLeakDetection') } catch {}
  const { processInfo } = await p.bcdp.send('SystemInfo.getProcessInfo')
  const pids = processInfo.filter((x) => x.type === 'renderer').map((x) => x.id)
  let rss = 0
  for (const pid of pids) { try { rss += Number(execSync(`ps -o rss= -p ${pid}`).toString().trim()) } catch {} }
  const gpuPid = processInfo.find((x) => x.type === 'GPU')?.id
  let gpuRss = 0
  try { gpuRss = Number(execSync(`ps -o rss= -p ${gpuPid}`).toString().trim()) } catch {}
  const audio = await p.page.evaluate(async () => {
    try {
      const store = await import('/src/game/store.ts')
      const eng = await import('/src/audio/engine.ts')
      const st = store.useGame.getState()
      const ids = new Set([...(st.room?.tracks ?? []).map((t) => t.id), ...(st.room?.rounds ?? []).filter(Boolean).map((r) => r.track.id), ...Object.keys(st.audio).map(Number), ...(window.__seenTracks ?? [])])
      window.__seenTracks = [...ids]
      let n = 0, bytes = 0
      for (const id of ids) {
        const b = eng.audioEngine.get(`track:${id}`)
        if (b) { n++; bytes += b.length * b.numberOfChannels * 4 }
      }
      return { buffers: n, MB: +(bytes / 1048576).toFixed(1), statusKeys: Object.keys(st.audio).length, phase: st.room?.phase.kind, round: st.room?.phase.round ?? null, results: st.room?.results?.length ?? 0 }
    } catch (e) { return { err: String(e) } }
  })
  const row = {
    who: p.device, label,
    heapMB: +(heap.usedSize / 1048576).toFixed(1), backingMB: heap.backingStorageSize != null ? +(heap.backingStorageSize / 1048576).toFixed(1) : null, embedderMB: heap.embedderHeapUsedSize != null ? +(heap.embedderHeapUsedSize / 1048576).toFixed(1) : null,
    nodes: dom.nodes, listeners: dom.jsEventListeners, docs: dom.documents, detached,
    rendererRssMB: Math.round(rss / 1024), gpuRssMB: Math.round(gpuRss / 1024), ...audio,
  }
  console.log(JSON.stringify(row))
  return row
}
async function playRounds(host, guest, rounds, tag) {
  for (let r = 0; r < rounds; r++) {
    await Promise.all([G.boardReady(host.page), G.boardReady(guest.page)])
    await host.page.waitForTimeout(1500)
    if (tag === 'main' && (r === 0 || r === rounds - 1 || r === Math.floor(rounds / 2))) {
      await snapshot(host, `${tag} r${r + 1} playing`)
      await snapshot(guest, `${tag} r${r + 1} playing`)
    }
    // click a block to decode/play a snippet (exercise audio) then confirm
    await guest.page.locator('[data-round-view="playing"] .sb-item').first().click().catch(() => {})
    await guest.page.waitForTimeout(400)
    await G.confirm(guest.page)
    await host.page.waitForTimeout(300)
    await G.confirm(host.page)
    await Promise.all([G.waitPhase(host.page, 'reveal', 40_000), G.waitPhase(guest.page, 'reveal', 40_000)])
    await host.page.waitForTimeout(3500)
    const last = r === rounds - 1
    await G.nextRound(host.page, last)
    if (!last) await host.page.waitForFunction(() => !document.querySelector('[data-phase="reveal"]'), null, { timeout: 20_000 })
    log(`${tag}: round ${r + 1}/${rounds} done`)
  }
  await Promise.all([G.waitScreen(host.page, 'final', 30_000), G.waitScreen(guest.page, 'final', 30_000)])
  await host.page.waitForTimeout(4000)
}

const host = await player('desktop')
const guest = await player('phone')
try {
  await Promise.all([host.page.goto(BASE), guest.page.goto(BASE)])
  await Promise.all([G.waitScreen(host.page, 'home'), G.waitScreen(guest.page, 'home')])
  await host.page.waitForTimeout(2000)
  await snapshot(host, 'home')
  await snapshot(guest, 'home')
  const code = await G.createRoom(host.page)
  await G.joinRoom(guest.page, code)
  await G.pickPlaylist(host.page, process.env.QUERY ?? 'hits 2000')
  await G.setRadio(host.page, 'Round', String(ROUNDS))
  await G.setRadio(host.page, 'Spezzoni', /^8/)
  await G.setRadio(host.page, 'Timer finale', '10s')
  await host.page.waitForTimeout(1500)
  await snapshot(host, 'lobby (before game)')
  await snapshot(guest, 'lobby (before game)')
  await G.start(host.page)
  // peak prefetch: shortly after start
  await G.waitScreen(guest.page, 'round', 30_000)
  await guest.page.waitForTimeout(9000)
  await snapshot(host, 'main preparing+9s')
  await snapshot(guest, 'main preparing+9s')
  await playRounds(host, guest, ROUNDS, 'main')
  await snapshot(host, 'final after main')
  await snapshot(guest, 'final after main')
  await host.page.screenshot({ path: `${OUT}mem-final-host.png` })
  for (let k = 1; k <= REPLAYS; k++) {
    await host.page.getByRole('button', { name: 'Rigioca' }).click()
    await Promise.all([G.waitScreen(host.page, 'lobby', 15_000), G.waitScreen(guest.page, 'lobby', 15_000)])
    await host.page.waitForTimeout(2500)
    await snapshot(host, `lobby after Rigioca #${k}`)
    await snapshot(guest, `lobby after Rigioca #${k}`)
    await G.setRadio(host.page, 'Round', REPLAY_ROUNDS)
    await host.page.waitForTimeout(500)
    await G.start(host.page)
    await playRounds(host, guest, Number(REPLAY_ROUNDS), `replay${k}`)
    await snapshot(host, `final after replay ${k}`)
    await snapshot(guest, `final after replay ${k}`)
  }
  await host.page.getByRole('button', { name: 'Rigioca' }).click()
  await Promise.all([G.waitScreen(host.page, 'lobby', 15_000), G.waitScreen(guest.page, 'lobby', 15_000)])
  await host.page.waitForTimeout(3000)
  await snapshot(host, 'lobby at end')
  await snapshot(guest, 'lobby at end')
} catch (e) {
  console.log('FATAL', e.stack)
  await host.page.screenshot({ path: `${OUT}mem-fail-host.png` }).catch(() => {})
  await guest.page.screenshot({ path: `${OUT}mem-fail-guest.png` }).catch(() => {})
} finally {
  await host.browser.close()
  await guest.browser.close()
}
log('done')
