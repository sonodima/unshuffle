// fix-game E2E #2 (same snapshot + preview as e2e.mjs): ghosts and link blips.
//   F7: a player closes the tab right before "Inizia partita" → never scored, removed from the room.
//   F2: a guest's data channel breaks mid-round (transport reconnects on its own) → the seat is
//       held silently: still "connected" for everyone, no "ha lasciato la stanza" toast, and the round doesn't
//       end although everybody else confirmed.
import { chromium } from 'playwright'

const BASE = process.env.BASE ?? 'http://127.0.0.1:5458/'
const URL = new globalThis.URL('lab/fix-game.html', BASE).href
const PLAYLIST = { id: 248297032, title: '00s Hits', picture: '', nbTracks: 100 }
const T0 = Date.now()
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1).padStart(6)}s]`, ...a)
let failed = 0
const problems = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '  ✔' : '  ✘'} ${label}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await chromium.launch({ channel: 'chrome' })

async function player(name) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await ctx.addInitScript(() => localStorage.setItem('unshuffle:onboarded', String(Date.now())))
  const page = await ctx.newPage()
  page.on('pageerror', (e) => problems.push(`[${name}] ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && problems.push(`[${name}] ${m.text().slice(0, 200)}`))
  page.on('response', (r) => r.status() >= 400 && console.log(`    (${name}) HTTP ${r.status()} ${r.url().slice(0, 110)}`))
  await page.goto(URL)
  await page.waitForFunction(() => !!window.__fg)
  await page.evaluate((n) => window.__fg.useGame.getState().setProfile({ name: n }), name)
  return { name, ctx, page }
}
const st = (p, fn, arg) => p.page.evaluate(fn, arg)
async function waitStore(p, pred, arg, timeout = 60_000) {
  await p.page.waitForFunction(
    ([src, a]) => !!window.__fg && !!new Function('s', 'a', `return (${src})(s, a)`)(window.__fg.useGame.getState(), a),
    [pred.toString(), arg],
    { timeout, polling: 50 },
  )
}

try {
  const H = await player('Host')
  const G = await player('Giulia')
  const F = await player('Fantasma')
  const code = await st(H, () => window.__fg.useGame.getState().createRoom())
  await st(H, (pl) => window.__fg.useGame.getState().updateSettings({ playlist: pl, rounds: 3, snippets: 6, roundTime: 90, finalTimer: 10 }), PLAYLIST)
  for (const p of [G, F]) await st(p, (c) => window.__fg.useGame.getState().joinRoom(c), code)
  await waitStore(H, (s) => s.room.players.length === 3)
  const ghostId = await st(F, () => window.__fg.useGame.getState().me)
  log('room', code, 'ghost', ghostId)

  // ---- F7 ---------------------------------------------------------------------------------
  await F.ctx.close() // the tab is closed without a goodbye…
  await sleep(300)
  await st(H, () => window.__fg.useGame.getState().startGame()) // …right before the start
  await waitStore(H, (s) => s.room?.phase.kind === 'playing', null, 90_000)
  const readyWaitMs = await st(H, () => Date.now())
  log('round 0 playing')
  await waitStore(H, (s, id) => !s.room.players.some((p) => p.id === id), ghostId, 40_000).catch(() => {})
  const gone = await st(H, (id) => !window.__fg.useGame.getState().room.players.some((p) => p.id === id), ghostId)
  check(gone, 'F7 the ghost left the room (no permanent 0-point seat)', `${((Date.now() - T0) / 1000).toFixed(1)} s`)
  void readyWaitMs

  // ---- F2 blip ------------------------------------------------------------------------------
  await st(H, () => window.__fg.useGame.getState().submit())
  await waitStore(G, (s) => s.room.phase.firstSubmit !== null)
  const gid = await st(G, () => window.__fg.useGame.getState().me)
  const broke = await G.page.evaluate(() => {
    const { netDebug, storeDebug } = window.__fg
    const conn = storeDebug.connection()
    return conn ? netDebug.breakLink(conn) : null
  })
  log('guest link broken:', broke)
  const samples = []
  for (let i = 0; i < 16; i++) {
    samples.push(await st(H, (id) => {
      const s = window.__fg.useGame.getState()
      return { phase: s.room.phase.kind, connected: s.room.players.find((p) => p.id === id)?.connected }
    }, gid))
    await sleep(250)
  }
  check(samples.every((x) => x.phase === 'playing'), 'F2 round keeps running during the blip', JSON.stringify(samples.map((x) => x.phase[0]).join('')))
  check(samples.every((x) => x.connected === true), 'F2 the guest stays "connected" for everyone during the blip')
  await waitStore(G, (s) => s.connection === 'open', null, 20_000).catch(() => {})
  const leftToast = await st(H, (id) => window.__fg.useGame.getState().toasts.some((t) => t.event.type === 'player-left' && t.event.playerId === id), gid)
  check(!leftToast, 'F2 no "ha lasciato la stanza" toast for a blip')
  await st(G, () => window.__fg.useGame.getState().submit())
  await waitStore(H, (s) => s.room.phase.kind === 'reveal', null, 20_000)
  const res = await st(H, (id) => window.__fg.useGame.getState().room.results[0].find((r) => r.playerId === id), gid)
  check(res && res.timedOut === false, 'F2 the guest confirmed after the blip', JSON.stringify(res))
  const ghostScored = await st(H, (id) => window.__fg.useGame.getState().room.results[0].some((r) => r.playerId === id), ghostId)
  check(!ghostScored, 'F7 the ghost has no round result')
} catch (err) {
  failed++
  console.error('aborted:', err)
} finally {
  // The lab page has no <link rel=icon>: Chrome's /favicon.ico probe 404s. Nothing else may fail.
  const real = problems.filter((p) => !/Failed to load resource: the server responded with a status of 404/.test(p))
  check(real.length === 0, 'no console errors', real.slice(0, 5).join(' | '))
  await browser.close()
  console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed')
  process.exit(failed ? 1 : 0)
}
