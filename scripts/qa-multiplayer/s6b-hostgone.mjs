// Scenario 6 refined: how fast do guests learn that the host is gone, depending on HOW the
// host tab goes away mid-round?
//   A) host navigates away (clean unload, like typing another URL)
//   B) host closes the tab through the normal close path (beforeunload guard shown & accepted)
// Measures: first sign (connection != open), definitive state (closed / role none), UI text.
import {
  DESKTOP, PHONE, browser, check, configure, createRoom, gotoHome, joinByCode, launch, log, openPlayer, pickPlaylist,
  shot, st, startGame, summary, waitBoard, waitPhase, waitScreen, waitStore,
} from './lib.mjs'

const tag = Math.random().toString(36).slice(2, 6)
const P = (id, name, a) => ({ id: `qa-${id}-${tag}`, name, avatar: a, color: a })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const out = {}
await launch()

async function variant(name, goAway) {
  const host = await openPlayer(`host${name}`, DESKTOP, { profile: P(`h${name}`, 'Host', 0) })
  const g = await openPlayer(`g${name}`, PHONE, { profile: P(`g${name}`, 'Ospite', 1) })
  g.__touch = true
  await Promise.all([host, g].map(gotoHome))
  const code = await createRoom(host)
  await joinByCode(g, code, { touch: true })
  await waitScreen(g, 'lobby')
  await pickPlaylist(host, process.env.QUERY ?? 'hits 2000')
  await configure(host, { rounds: 3, snippets: 6, roundTime: 90, finalTimer: 10 })
  await startGame(host)
  await Promise.all([host, g].map((p) => waitPhase(p, 'playing', 0, 120_000)))
  await waitBoard(g)
  await sleep(1500)
  const t0 = Date.now()
  await goAway(host)
  const first = await waitStore(g, '(s) => s.connection !== "open"', null, 30_000).then(() => Date.now() - t0, () => null)
  await sleep(1500)
  const banner = await g.locator('[role="status"]').allInnerTexts().catch(() => [])
  await shot(g, `s6b-${name}-reconnecting`)
  const final = await waitStore(g, '(s) => s.connection === "closed" || s.connection === "error" || s.role === "none"', null, 90_000).then(() => Date.now() - t0, () => null)
  await sleep(1000)
  const dialog = await g.locator('[role="dialog"]').allInnerTexts().catch(() => [])
  await shot(g, `s6b-${name}-final`)
  const s = await st(g)
  out[name] = { firstSignMs: first, definitiveMs: final, banner, dialog: dialog.map((d) => d.replace(/\s+/g, ' ').slice(0, 200)), conn: s.connection, err: s.error }
  log(name, JSON.stringify(out[name]))
  check(`6(${name}): definitive "host gone" within 15 s`, final != null && final < 15_000, `${first} ms first sign, ${final} ms definitive`)
  await g.context().close()
  await host.context().close().catch(() => {})
}

try {
  await variant('A-navigate', (h) => h.goto('about:blank'))
  await variant('B-close', (h) => h.close({ runBeforeUnload: true }))
} catch (err) {
  check('FATAL', false, err?.stack ?? String(err))
} finally {
  summary(`s6b ${JSON.stringify(out)}`)
  await browser.close()
}
