// Extra (ported): host refreshes its tab mid-round after a first confirm. A guest drags +
// confirms while the host is away. endsAt, submissions and the offline confirm must survive.
import {
  DESKTOP, PHONE, boardOrder, browser, check, configure, confirm, createRoom, gotoHome, installRecorder, joinByCode,
  launch, log, openPlayer, pickPlaylist, placeCorrect, rec, shot, st, startGame, summary, waitBoard, waitPhase,
  waitScreen, waitStore,
} from './lib.mjs'

const tag = Math.random().toString(36).slice(2, 6)
const P = (id, name, a) => ({ id: `qa-${id}-${tag}`, name, avatar: a, color: a })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const out = {}
await launch()
const host = await openPlayer('host', DESKTOP, { profile: P('h', 'Host', 0) })
const ada = await openPlayer('ada', PHONE, { profile: P('ada', 'Ada', 1) })
const leo = await openPlayer('leo', PHONE, { profile: P('leo', 'Leo', 2) })
ada.__touch = leo.__touch = true
const all = [host, ada, leo]
const ids = { ada: `qa-ada-${tag}`, leo: `qa-leo-${tag}` }
try {
  await Promise.all(all.map(gotoHome))
  const code = await createRoom(host)
  await Promise.all([joinByCode(ada, code, { touch: true }), joinByCode(leo, code, { touch: true })])
  await Promise.all([ada, leo].map((p) => waitScreen(p, 'lobby')))
  await pickPlaylist(host, process.env.QUERY ?? 'hits 2000')
  await configure(host, { rounds: 3, snippets: 6, roundTime: 90, finalTimer: 30 })
  await startGame(host)
  await Promise.all(all.map((p) => waitPhase(p, 'playing', 0, 120_000)))
  await Promise.all(all.map((p) => waitBoard(p)))
  await Promise.all([ada, leo].map(installRecorder))
  await sleep(1200)
  const adaOrder = await placeCorrect(ada, 0)
  await confirm(ada)
  await waitStore(host, '(s) => !!s.room.phase.firstSubmit', null, 10_000)
  const endsAt = (await st(host)).room.phase.endsAt
  const tR = Date.now()
  const reload = host.reload({ waitUntil: 'load' })
  await sleep(300)
  const leoOrder = await placeCorrect(leo, 1)
  await confirm(leo)
  const leoLocal = await st(leo)
  out.leoWhileHostAway = { connection: leoLocal.connection, submitted: leoLocal.submitted }
  await reload
  await waitStore(host, '(s) => s.role === "host" && s.connection === "open" && s.room?.phase.kind === "playing"', null, 40_000)
  out.hostBackMs = Date.now() - tR
  out.guestsBackMs = await Promise.all(
    [ada, leo].map((p) => waitStore(p, '(s) => s.connection === "open" && s.role === "client"', null, 45_000).then(() => Date.now() - tR, () => null)),
  )
  const hs0 = await st(host)
  check('11: host reclaimed the same code', hs0.room.code === code, hs0.room.code)
  await waitStore(host, '(s, id) => s.room.submissions[id]?.submitted === true', ids.leo, 20_000).then(
    () => check('11: confirm made while the host was reloading reaches the host', true),
    () => check('11: confirm made while the host was reloading reaches the host', false),
  )
  const hs = await st(host)
  check('11: endsAt preserved across the host reload', hs.room.phase.kind !== 'playing' || hs.room.phase.endsAt === endsAt, `${endsAt} → ${hs.room.phase.endsAt}`)
  await shot(host, 's11b-host-after-reload')
  if (hs.room.phase.kind === 'playing') await confirm(host)
  await Promise.all(all.map((p) => waitPhase(p, 'reveal', 0, 60_000)))
  await sleep(1500)
  const fin = await st(host)
  const res = Object.fromEntries(fin.room.results[0].map((r) => [r.playerId, r]))
  out.results = fin.room.results[0].map((r) => ({ id: r.playerId, order: r.order, timedOut: r.timedOut, points: r.points }))
  check('11: first confirm (before the reload) kept', JSON.stringify(res[ids.ada]?.order) === JSON.stringify(adaOrder) && !res[ids.ada]?.timedOut, JSON.stringify(res[ids.ada]))
  check('11: confirm made during the reload scored with the right order', JSON.stringify(res[ids.leo]?.order) === JSON.stringify(leoOrder) && !res[ids.leo]?.timedOut, JSON.stringify(res[ids.leo]))
  const gs = await Promise.all([ada, leo].map(st))
  check('11: guests see the same results', gs.every((g) => JSON.stringify(g.room.results) === JSON.stringify(fin.room.results)))
  out.leoPhases = (await rec(leo)).phases.map((p) => p.key)
  await shot(leo, 's11b-leo-reveal')
} catch (err) {
  check('FATAL', false, err?.stack ?? String(err))
  for (const p of all) await shot(p, 's11b-FAIL')
} finally {
  summary(`s11b ${JSON.stringify(out)}`)
  await browser.close()
}
