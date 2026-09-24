// fix-game E2E against a built snapshot (real PeerJS cloud + real Deezer):
//   npx vite build --config scripts/fix-game/vite.fix-game.config.ts
//   npx vite preview --outDir scripts/fix-game/dist --port 5458 --strictPort
//   node scripts/fix-game/e2e.mjs
// Host desktop 1440×900, guest phone 390×844 @2x touch, a third player (Mallory).
// Checks: late drop counted (F1/F3), reload with the final timer running (F2), decode
// window + byte prefetch (F6), copied player id refused (F4/F10), seat moving to a new
// tab keeps the arrangement (F9), results / podium consistent. Screenshots in shots/.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://127.0.0.1:5458/'
const URL = new globalThis.URL('lab/fix-game.html', BASE).href
const OUT = new globalThis.URL('./shots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const PLAYLIST = { id: 248297032, title: '00s Hits', picture: '', nbTracks: 100 }
const T0 = Date.now()
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1).padStart(6)}s]`, ...a)
const problems = []
let failed = 0
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '  ✔' : '  ✘'} ${label}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })

async function newPlayer(name, opts) {
  const ctx = await browser.newContext(opts)
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('unshuffle:onboarded', String(Date.now()))
    } catch {
      /* ignore */
    }
  })
  const page = await openPage(ctx, name)
  return { name, ctx, page }
}

async function openPage(ctx, name) {
  const page = await ctx.newPage()
  page.on('dialog', (d) => void d.accept().catch(() => {}))
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`[${name}] console.error: ${m.text().slice(0, 300)}`)
  })
  page.on('pageerror', (e) => problems.push(`[${name}] pageerror: ${e.message}`))
  await page.goto(URL)
  await page.waitForFunction(() => !!window.__fg)
  return page
}

const st = (page, fn, arg) => page.evaluate(fn, arg)
/** Wait until `pred(state)` is true (synchronous predicate source evaluated in the page). */
async function waitStore(page, pred, arg, timeout = 60_000) {
  await page.waitForFunction(
    ([src, a]) => {
      const g = window.__fg
      if (!g) return false
      // eslint-disable-next-line no-new-func
      return !!new Function('s', 'a', `return (${src})(s, a)`)(g.useGame.getState(), a)
    },
    [pred.toString(), arg],
    { timeout, polling: 50 },
  )
}
const phaseOf = (page) => st(page, () => window.__fg.useGame.getState().room?.phase ?? null)
const shot = (p, tag) => p.page.screenshot({ path: `${OUT}${tag}-${p.name}.png` })

try {
  const H = await newPlayer('host', { viewport: { width: 1440, height: 900 } })
  const G = await newPlayer('guest', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
  const M = await newPlayer('mallory', { viewport: { width: 1280, height: 800 } })
  for (const [p, name] of [[H, 'Host Tommy'], [G, 'Giulia'], [M, 'Marco']]) {
    await st(p.page, (n) => window.__fg.useGame.getState().setProfile({ name: n }), name)
  }

  const code = await st(H.page, () => window.__fg.useGame.getState().createRoom())
  log('room', code)
  await st(H.page, (pl) => window.__fg.useGame.getState().updateSettings({ playlist: pl, rounds: 3, snippets: 6, roundTime: 60, finalTimer: 10 }), PLAYLIST)
  for (const p of [G, M]) await st(p.page, (c) => window.__fg.useGame.getState().joinRoom(c), code)
  await waitStore(H.page, (s) => s.room.players.length === 3)
  const ids = await st(H.page, () => Object.fromEntries(window.__fg.useGame.getState().room.players.map((p) => [p.name, p.id])))
  log('players', JSON.stringify(ids))

  await st(H.page, () => window.__fg.useGame.getState().startGame())
  for (const p of [H, G, M]) await waitStore(p.page, (s) => s.room?.phase.kind === 'playing' && s.room.phase.round === 0, null, 90_000)
  log('round 0 playing')

  // ---- F6: decode window + compressed prefetch -------------------------------------------
  await sleep(4000)
  const mem = await st(G.page, () => {
    const { useGame, audioEngine } = window.__fg
    const room = useGame.getState().room
    const decoded = room.tracks.filter((t) => audioEngine.has(`track:${t.id}`)).map((t) => t.id)
    const previews = performance.getEntriesByType('resource').filter((e) => /dzcdn\.net/.test(e.name) && /mp3|preview/.test(e.name)).length
    return { tracks: room.tracks.length, decoded: decoded.length, previews, audio: useGame.getState().audio }
  })
  check(mem.decoded <= 2, 'F6 guest decodes only the current + next round', JSON.stringify(mem))
  check(mem.previews >= mem.tracks, 'F6 every preview downloaded early (bytes for later rounds)', `${mem.previews} preview downloads for ${mem.tracks} tracks`)

  // ---- F1/F3: a drop 120 ms before time's up still counts -------------------------------
  await st(M.page, () => {
    const s = window.__fg.useGame.getState()
    s.submit()
  })
  await st(H.page, () => window.__fg.useGame.getState().submit())
  await waitStore(G.page, (s) => s.room.phase.kind === 'playing' && s.room.phase.firstSubmit !== null)
  const lastDrop = await st(G.page, async () => {
    const { useGame, hostNow } = window.__fg
    const s0 = useGame.getState()
    const ph = s0.room.phase
    const order = [...s0.arrangement].reverse()
    await new Promise((r) => setTimeout(r, Math.max(0, ph.endsAt - 120 - hostNow())))
    useGame.getState().setArrangement(order)
    return { order, before: ph.endsAt - hostNow() }
  })
  log('guest dropped', Math.round(lastDrop.before), 'ms before endsAt')
  for (const p of [H, G, M]) await waitStore(p.page, (s) => s.room.phase.kind === 'reveal' && s.room.phase.round === 0)
  const r0 = await st(H.page, (id) => window.__fg.useGame.getState().room.results[0].find((r) => r.playerId === id), ids.Giulia)
  check(JSON.stringify(r0?.order) === JSON.stringify(lastDrop.order), 'F1/F3 last-moment drop is what the host scored', `scored ${JSON.stringify(r0?.order)} dropped ${JSON.stringify(lastDrop.order)} (${Math.round(lastDrop.before)} ms before)`)
  check(r0?.timedOut === true, 'F1/F3 …marked as timed out (no confirm)')
  await sleep(2500)
  await shot(G, 'r0-reveal')
  await shot(H, 'r0-reveal')

  // ---- F2: guest reloads while the final timer runs ---------------------------------------
  await st(H.page, () => window.__fg.useGame.getState().nextRound())
  for (const p of [H, G, M]) await waitStore(p.page, (s) => s.room?.phase.kind === 'playing' && s.room.phase.round === 1, null, 90_000)
  log('round 1 playing')
  await st(M.page, () => window.__fg.useGame.getState().submit())
  await st(H.page, () => window.__fg.useGame.getState().submit())
  await waitStore(G.page, (s) => s.room.phase.firstSubmit !== null)
  const tReload = Date.now()
  await G.page.reload()
  await G.page.waitForFunction(() => !!window.__fg)
  await waitStore(G.page, (s) => s.connection === 'open' && s.room?.phase.kind === 'playing', null, 20_000).catch(() => {})
  const back = await st(G.page, () => {
    const s = window.__fg.useGame.getState()
    return { conn: s.connection, phase: s.room?.phase.kind ?? null, round: s.room?.phase.round ?? null }
  })
  log('guest back after reload in', Date.now() - tReload, 'ms', JSON.stringify(back))
  check(back.phase === 'playing' && back.round === 1, 'F2 round still running after the guest reloaded', JSON.stringify(back))
  const hostSawLeave = await st(H.page, (id) => window.__fg.useGame.getState().toasts.some((t) => t.event.type === 'player-left' && t.event.playerId === id), ids.Giulia)
  check(!hostSawLeave, 'F2 nobody was told the guest left')
  const mine1 = await st(G.page, () => {
    const s = window.__fg.useGame.getState()
    const order = [...s.arrangement]
    ;[order[0], order[1]] = [order[1], order[0]]
    s.setArrangement(order)
    s.submit()
    return order
  })
  for (const p of [H, G, M]) await waitStore(p.page, (s) => s.room.phase.kind === 'reveal' && s.room.phase.round === 1)
  const r1 = await st(H.page, (id) => window.__fg.useGame.getState().room.results[1].find((r) => r.playerId === id), ids.Giulia)
  check(r1 && !r1.timedOut && JSON.stringify(r1.order) === JSON.stringify(mine1), 'F2 guest confirmed after the reload and was scored on it', JSON.stringify(r1))
  await sleep(2500)
  await shot(G, 'r1-reveal')

  // ---- F4/F10: someone copies Giulia's public id -------------------------------------------
  await st(H.page, () => window.__fg.useGame.getState().nextRound())
  for (const p of [H, G, M]) await waitStore(p.page, (s) => s.room?.phase.kind === 'playing' && s.room.phase.round === 2, null, 90_000)
  log('round 2 playing')
  const X = await newPlayer('impostor', { viewport: { width: 1280, height: 800 } })
  const gProfile = await st(G.page, () => window.__fg.useGame.getState().profile)
  await X.page.evaluate((p) => localStorage.setItem('unshuffle:profile', JSON.stringify(p)), gProfile)
  await X.page.reload()
  await X.page.waitForFunction(() => !!window.__fg)
  const xErr = await st(X.page, async (c) => {
    try {
      await window.__fg.useGame.getState().joinRoom(c)
      return null
    } catch (e) {
      return String(e?.message ?? e)
    }
  }, code)
  check(xErr === 'Il tuo profilo è già in questa stanza da un’altra scheda o un altro dispositivo.', 'F4/F10 copied player id is refused', String(xErr))
  const gStill = await st(G.page, () => window.__fg.useGame.getState().connection)
  check(gStill === 'open', 'F4/F10 the real owner stays in', gStill)
  await X.ctx.close()

  // ---- F9: Giulia continues in a second tab of the same browser ----------------------------
  const moved = await st(G.page, () => {
    const s = window.__fg.useGame.getState()
    const order = [...s.arrangement].reverse()
    s.setArrangement(order)
    return order
  })
  await sleep(500)
  const G2page = await openPage(G.ctx, 'guest-tab2')
  await st(G2page, (c) => window.__fg.useGame.getState().joinRoom(c), code)
  await waitStore(G2page, (s) => s.room?.phase.kind === 'playing' && s.arrangementRound === 2)
  const tab2 = await st(G2page, () => window.__fg.useGame.getState().arrangement)
  check(JSON.stringify(tab2) === JSON.stringify(moved), 'F9 the new tab shows the arrangement the old one had', `${JSON.stringify(tab2)} vs ${JSON.stringify(moved)}`)
  const oldTab = await st(G.page, () => ({ conn: window.__fg.useGame.getState().connection, err: window.__fg.useGame.getState().error }))
  check(oldTab.err === 'Il tuo profilo è già in questa stanza da un’altra scheda o un altro dispositivo.', 'F9 the old tab is parked with “Già in partita”', JSON.stringify(oldTab))
  G.page = G2page
  await shot(G, 'r2-tab2-playing')

  for (const p of [M, H, G]) await st(p.page, () => window.__fg.useGame.getState().submit())
  for (const p of [H, G, M]) await waitStore(p.page, (s) => s.room.phase.kind === 'reveal' && s.room.phase.round === 2)
  const r2 = await st(H.page, (id) => window.__fg.useGame.getState().room.results[2].find((r) => r.playerId === id), ids.Giulia)
  check(JSON.stringify(r2?.order) === JSON.stringify(moved), 'F9 host scored what the new tab showed', JSON.stringify(r2?.order))
  await sleep(2500)
  await shot(G, 'r2-reveal')
  await shot(H, 'r2-reveal')

  await st(H.page, () => window.__fg.useGame.getState().nextRound())
  for (const p of [H, G, M]) await waitStore(p.page, (s) => s.room?.phase.kind === 'final')
  const fin = await st(H.page, () => {
    const room = window.__fg.useGame.getState().room
    return room.players.map((p) => ({ n: p.name, score: p.score, sum: room.results.flat().filter((r) => r.playerId === p.id).reduce((a, r) => a + r.points, 0) }))
  })
  check(fin.every((p) => p.score === p.sum), 'scores equal the sum of rounds', JSON.stringify(fin))
  const leftAudio = await st(G.page, () => {
    const { useGame, audioEngine } = window.__fg
    return useGame.getState().room.tracks.filter((t) => audioEngine.has(`track:${t.id}`)).length
  })
  check(leftAudio === 0, 'F6 nothing decoded on the final screen', String(leftAudio))
  await sleep(3500)
  await shot(G, 'final')
  await shot(H, 'final')
} catch (err) {
  failed++
  console.error('E2E aborted:', err)
} finally {
  const noisy = problems.filter((p) => !/ERR_NETWORK_CHANGED|Failed to load resource/.test(p))
  check(noisy.length === 0, 'no console errors', noisy.slice(0, 8).join(' | '))
  await browser.close()
  console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed')
  process.exit(failed ? 1 : 0)
}
