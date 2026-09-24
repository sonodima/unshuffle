// Extra: host refreshes its tab mid-round (after a first confirm). A guest drags + confirms
// while the host is away. Everything must survive: endsAt, submissions, the offline confirm.
import {
  launch, openPlayer, DESKTOP, PHONE, snap, createRoom, joinByLink, pickPlaylist, setSettings, startGame,
  waitStore, check, log, shot, finish, sleep, boardReady, waitPlayingOrPast, waitRevealOrPast,
  boardOrder, confirm, placeSegment, recordTimeline, timeline,
} from './lib.mjs'

const browser = await launch()
let ok = false
const all = []
const out = {}
try {
  const host = await openPlayer(browser, 'Host', DESKTOP)
  const ada = await openPlayer(browser, 'Ada', PHONE)
  const leo = await openPlayer(browser, 'Leo', PHONE)
  all.push(host, ada, leo)
  const code = await createRoom(host)
  await Promise.all([ada, leo].map((g) => joinByLink(g, code)))
  await waitStore(host, '(s) => s.room?.players.length === 3', null, 20_000)
  await pickPlaylist(host)
  await setSettings(host, { rounds: 3, snippets: 6, roundTime: 90, finalTimer: 30 })
  await startGame(host)
  await Promise.all(all.map((p) => waitPlayingOrPast(p, 0)))
  await Promise.all([ada, leo].map(recordTimeline))
  await Promise.all(all.map((p) => boardReady(p)))
  await sleep(1200)
  const ids = Object.fromEntries((await Promise.all(all.map(snap))).map((s, i) => [all[i].__name, s.me]))
  await placeSegment(ada, 0, 0)
  const adaOrder = await boardOrder(ada)
  await confirm(ada)
  await waitStore(host, '(s) => !!s.room.phase.firstSubmit', null, 10_000)
  const before = await snap(host)
  const endsAt = before.room.phase.endsAt
  // Host reloads.
  const tR = Date.now()
  const reload = host.reload({ waitUntil: 'load' })
  await sleep(300)
  // Leo drags + confirms while the host is away.
  await placeSegment(leo, 1, 1)
  const leoOrder = await boardOrder(leo)
  await confirm(leo)
  const leoLocal = await snap(leo)
  out.leoWhileHostAway = { connection: leoLocal.connection, submitted: leoLocal.submitted }
  await reload
  await waitStore(host, '(s) => s.role === "host" && s.connection === "open" && s.room?.phase.kind === "playing"', null, 40_000)
  out.hostBackMs = Date.now() - tR
  await recordTimeline(host)
  const back = await Promise.all([ada, leo].map((p) => waitStore(p, '(s) => s.connection === "open"', null, 40_000).then(() => Date.now() - tR, () => null)))
  out.guestsBackMs = back
  const code2 = (await snap(host)).room.code
  check(code2 === code, `host reclaimed the same code (${code2})`)
  await waitStore(host, '(s, id) => s.room.submissions[id]?.submitted === true', ids.Leo, 20_000).then(
    () => check(true, 'confirm made while the host was reloading reaches the host'),
    () => check(false, 'confirm made while the host was reloading reaches the host'),
  )
  const hs = await snap(host)
  check(hs.room.phase.kind !== 'playing' || hs.room.phase.endsAt === endsAt, 'endsAt preserved across the host reload', { before: endsAt, after: hs.room.phase.endsAt })
  const hostOrder = await boardOrder(host).catch(() => null)
  log('host board after reload', hostOrder)
  await shot(host, 's11-host-after-reload')
  if (hs.room.phase.kind === 'playing') await confirm(host)
  await waitRevealOrPast(host, 0, 60_000)
  const fin = await snap(host)
  const res = Object.fromEntries(fin.room.results[0].map((r) => [r.playerId, r]))
  out.results = fin.room.results[0].map((r) => ({ id: r.playerId, order: r.order, timedOut: r.timedOut, points: r.points }))
  check(JSON.stringify(res[ids.Ada].order) === JSON.stringify(adaOrder) && !res[ids.Ada].timedOut, 'first confirm (before the reload) kept')
  check(JSON.stringify(res[ids.Leo].order) === JSON.stringify(leoOrder) && !res[ids.Leo].timedOut, 'offline confirm scored with the right order', res[ids.Leo])
  const gs = await Promise.all([ada, leo].map(snap))
  check(gs.every((g) => JSON.stringify(g.room.results) === JSON.stringify(fin.room.results)), 'guests see the same results')
  out.timelineLeo = await timeline(leo)
  ok = true
} catch (err) {
  check(false, `FATAL ${err?.stack ?? err}`)
  for (const p of all) {
    await shot(p, 's11-FAIL')
    try {
      const sn = await snap(p)
      console.log('SNAP', p.__name, JSON.stringify({ phase: sn.room?.phase, conn: sn.connection, err: sn.error, role: sn.role, subs: sn.room?.submissions }))
    } catch {
      /* ignore */
    }
  }
} finally {
  await browser.close()
}
console.log(JSON.stringify(out, null, 1))
finish('s11-host-refresh', { out })
process.exit(ok ? 0 : 1)
