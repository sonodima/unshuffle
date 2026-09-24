// Extra: a guest closes its tab in the lobby; the host starts the game a few seconds later
// (inside the 10 s heartbeat + 15 s lobby grace). Is the gone player dragged into the game?
import {
  DESKTOP, PHONE, browser, check, configure, confirm, createRoom, gotoHome, joinByCode, launch, log, openPlayer,
  pickPlaylist, shot, st, startGame, summary, waitBoard, waitPhase, waitScreen, waitStore,
} from './lib.mjs'

const tag = Math.random().toString(36).slice(2, 6)
const P = (id, name, a) => ({ id: `qa-${id}-${tag}`, name, avatar: a, color: a })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const out = {}
await launch()
const host = await openPlayer('host', DESKTOP, { profile: P('h', 'Host', 0) })
const g1 = await openPlayer('g1', PHONE, { profile: P('g1', 'Uno', 1) })
const g2 = await openPlayer('g2', PHONE, { profile: P('g2', 'Fantasma', 2) })
g1.__touch = g2.__touch = true
const all = [host, g1]
try {
  await Promise.all([host, g1, g2].map(gotoHome))
  const code = await createRoom(host)
  await Promise.all([joinByCode(g1, code, { touch: true }), joinByCode(g2, code, { touch: true })])
  await Promise.all([g1, g2].map((p) => waitScreen(p, 'lobby')))
  await pickPlaylist(host, process.env.QUERY ?? 'hits 2000')
  await configure(host, { rounds: 3, snippets: 6, roundTime: 60, finalTimer: 10 })
  const tClose = Date.now()
  await g2.close()
  await sleep(2000)
  const before = await st(host)
  out.rosterAtStart = before.room.players.map((p) => `${p.name}:${p.connected ? 'on' : 'off'}`)
  await startGame(host)
  await Promise.all(all.map((p) => waitPhase(p, 'playing', 0, 120_000)))
  await Promise.all(all.map((p) => waitBoard(p)))
  await waitStore(host, (`(s, id) => s.room.players.find((p) => p.id === id)?.connected === false`), `qa-g2-${tag}`, 20_000).catch(() => {})
  out.ghostDetectedMs = Date.now() - tClose
  const s = await st(host)
  out.rosterInGame = s.room.players.map((p) => `${p.name}:${p.connected ? 'on' : 'off'}:from${p.activeFromRound}`)
  log(JSON.stringify(out))
  await shot(host, 's12-playing')
  await shot(g1, 's12-playing')
  for (const p of all) await confirm(p)
  await Promise.all(all.map((p) => waitPhase(p, 'reveal', 0, 30_000)))
  await sleep(8000)
  const r = await st(host)
  out.results = r.room.results[0].map((x) => `${x.playerId.split('-')[1]}:${x.points}:${x.timedOut ? 'timeout' : 'ok'}`)
  check('12: a player gone before the start is not dragged into the game', !r.room.players.some((p) => p.id === `qa-g2-${tag}`), JSON.stringify(out))
  await shot(g1, 's12-reveal')
} catch (err) {
  check('FATAL', false, err?.stack ?? String(err))
  for (const p of all) await shot(p, 's12-FAIL')
} finally {
  summary(`s12 ${JSON.stringify(out)}`)
  await browser.close()
}
