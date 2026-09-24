// Scenario 3 + 4: late joiner during round 1 (spectates, plays from round 2, starts at 0,
// podium correct); guest refresh mid-round (arrangement restored, can still submit);
// guest closes the tab mid-round (round not blocked, shown disconnected); the same
// profile rejoins later and keeps its score.
import {
  launch, openPlayer, DESKTOP, PHONE, snap, createRoom, joinByLink, pickPlaylist, setSettings, startGame,
  waitStore, boardOrder, placeSegment, confirm, check, log, shot, finish, recordTimeline, timeline,
  revealRows, finalRows, expectedStandings, waitScreen, sleep, waitRevealDone, boardReady, waitPlayingOrPast,
  waitRevealOrPast, hostNext, scoreArrangement, BASE,
} from './lib.mjs'

const N = 6
const timings = {}
const browser = await launch()
let ok = false
const all = []
try {
  const host = await openPlayer(browser, 'Host', DESKTOP)
  const anna = await openPlayer(browser, 'Anna', PHONE)
  const bruno = await openPlayer(browser, 'Bruno', PHONE)
  all.push(host, anna, bruno)
  const code = await createRoom(host)
  log('room', code)
  await Promise.all([anna, bruno].map((g) => joinByLink(g, code)))
  await waitStore(host, '(s) => s.room?.players.length === 3', null, 20_000)
  await pickPlaylist(host)
  await setSettings(host, { rounds: 3, snippets: N, roundTime: 90, finalTimer: 30 })
  await Promise.all(all.map(recordTimeline))
  await startGame(host)
  const ids = Object.fromEntries((await Promise.all(all.map(snap))).map((s, i) => [all[i].__name, s.me]))

  // ---------------------------------------------------------------- round 1
  let ph = await waitPlayingOrPast(host, 0)
  await Promise.all([anna, bruno].map((p) => waitPlayingOrPast(p, 0)))
  await Promise.all(all.map((p) => boardReady(p)))
  await sleep(1500)

  // Late joiner arrives while round 1 is being played.
  const luca = await openPlayer(browser, 'Luca', PHONE)
  all.push(luca)
  const tJoin = Date.now()
  await luca.goto(`${BASE}#/r/${code}`, { waitUntil: 'load' })
  await waitScreen(luca, 'home')
  await sleep(300)
  await luca.getByRole('button', { name: /^Entra/ }).first().tap()
  await waitStore(luca, '(s) => !!s.room && s.room.phase.kind === "playing"', null, 30_000)
  timings.lateJoinMs = Date.now() - tJoin
  await recordTimeline(luca)
  const ls = await snap(luca)
  const lp = ls.room.players.find((p) => p.id === ls.me)
  ids.Luca = ls.me
  check(lp && lp.activeFromRound === 1 && lp.score === 0, 'late joiner: activeFromRound = 1, score 0', lp)
  await sleep(1200)
  const spectatorCard = await luca.getByText('Stai guardando').count()
  check(spectatorCard > 0, 'late joiner sees the "Stai guardando" spectator card')
  const locked = await luca.locator('[data-round-view="playing"][data-locked]').count()
  check(locked > 0, 'late joiner board is locked')
  await shot(luca, 's3-late-spectator')

  // Anna drags, then refreshes.
  await placeSegment(anna, 0, 0)
  await placeSegment(anna, 1, 1)
  const annaBefore = await boardOrder(anna)
  await sleep(700) // let the debounced arrangement reach the host
  const tReload = Date.now()
  await anna.reload({ waitUntil: 'load' })
  await waitStore(anna, '(s) => s.connection === "open" && s.room?.phase.kind === "playing"', null, 40_000)
  timings.guestReloadBackMs = Date.now() - tReload
  await boardReady(anna)
  const annaAfter = await boardOrder(anna)
  check(JSON.stringify(annaAfter) === JSON.stringify(annaBefore), `guest refresh: arrangement restored (${annaBefore} → ${annaAfter})`)
  await recordTimeline(anna)
  await shot(anna, 's3-after-reload')

  // Bruno drags and closes his tab.
  await placeSegment(bruno, N - 1, N - 1)
  const brunoOrder = await boardOrder(bruno)
  await sleep(700)
  const tClose = Date.now()
  await bruno.close()
  all.splice(all.indexOf(bruno), 1)
  await waitStore(host, '(s, id) => s.room.players.find((p) => p.id === id)?.connected === false', ids.Bruno, 30_000)
  timings.closedTabDetectedMs = Date.now() - tClose
  check(timings.closedTabDetectedMs < 12_000, `host marks the closed tab disconnected (${timings.closedTabDetectedMs} ms)`)
  const annaSeesBruno = await snap(anna)
  check(annaSeesBruno.room.players.find((p) => p.id === ids.Bruno)?.connected === false, 'other guests see Bruno disconnected')

  // Anna (after reload) confirms, host confirms → round must end right away (Bruno gone, Luca spectating).
  const annaSubmitted = await boardOrder(anna)
  await confirm(anna)
  await waitStore(host, '(s, id) => s.room.submissions[id]?.submitted === true', ids.Anna, 10_000).then(
    () => check(true, 'refreshed guest can still submit'),
    () => check(false, 'refreshed guest can still submit'),
  )
  const hostSubmitted = await boardOrder(host)
  const tHostConfirm = Date.now()
  await confirm(host)
  await waitRevealOrPast(host, 0, 20_000)
  timings.endAfterLastPresentSubmitMs = Date.now() - tHostConfirm
  check(timings.endAfterLastPresentSubmitMs < 3000, `round ends as soon as all connected players confirmed (${timings.endAfterLastPresentSubmitMs} ms)`)
  let s = await snap(host)
  const r0 = s.room.results[0]
  const byId = Object.fromEntries(r0.map((x) => [x.playerId, x]))
  check(!byId[ids.Luca], 'late joiner has no result in round 1')
  check(byId[ids.Bruno]?.timedOut === true && JSON.stringify(byId[ids.Bruno].order) === JSON.stringify(brunoOrder), 'closed-tab player scored with his last arrangement (timedOut)', byId[ids.Bruno])
  check(JSON.stringify(byId[ids.Anna]?.order) === JSON.stringify(annaSubmitted) && byId[ids.Anna].timedOut === false, 'refreshed guest result = restored arrangement', byId[ids.Anna])
  check(JSON.stringify(byId[ids.Host]?.order) === JSON.stringify(hostSubmitted), 'host result order')
  const lrows = await waitRevealDone(luca, 20_000).then(() => revealRows(luca), () => [])
  log('late joiner reveal rows', lrows)
  check(lrows.some((x) => /Luca.*spettatore/.test(x ?? '')), 'late joiner listed as "spettatore" in the round-1 leaderboard', lrows)
  await shot(luca, 's3-r1-reveal-late')
  await shot(host, 's3-r1-reveal-host')
  await hostNext(host, 0, false)

  // ---------------------------------------------------------------- round 2: Bruno comes back, Luca plays
  s = await snap(host)
  const brunoScoreBefore = s.room.players.find((p) => p.id === ids.Bruno).score
  const bruno3 = await openPlayer(browser, 'Bruno', PHONE, { profile: { id: ids.Bruno }, url: null })
  all.push(bruno3)
  const tRejoin = Date.now()
  await bruno3.goto(`${BASE}#/r/${code}`, { waitUntil: 'load' })
  await bruno3.getByRole('button', { name: /^Entra/ }).first().tap()
  await waitStore(bruno3, '(s) => s.connection === "open" && !!s.room', null, 30_000)
  timings.rejoinMs = Date.now() - tRejoin
  s = await snap(host)
  const bp = s.room.players.find((p) => p.id === ids.Bruno)
  check(bp.connected && bp.score === brunoScoreBefore && bp.activeFromRound === 0, `rejoined profile keeps score ${bp.score} and stays active`, bp)
  check(s.room.players.length === 4, 'no duplicate player entry after rejoin', s.room.players.map((p) => p.name))

  ph = await waitPlayingOrPast(host, 1)
  await Promise.all([anna, luca, bruno3].map((p) => waitPlayingOrPast(p, 1)))
  await Promise.all([host, anna, luca, bruno3].map((p) => boardReady(p)))
  await sleep(1500)
  const ls2 = await luca.locator('[data-round-view="playing"][data-locked]').count()
  check(ls2 === 0, 'late joiner board unlocked in round 2')
  await placeSegment(luca, 0, 0)
  const lucaOrder = await boardOrder(luca)
  await confirm(luca)
  await sleep(500)
  await confirm(anna)
  await confirm(bruno3)
  await confirm(host)
  await waitRevealOrPast(host, 1, 70_000)
  s = await snap(host)
  const lr = s.room.results[1].find((x) => x.playerId === ids.Luca)
  check(lr && JSON.stringify(lr.order) === JSON.stringify(lucaOrder) && lr.points === scoreArrangement(lucaOrder, N).points, 'late joiner plays and scores in round 2', lr)
  await hostNext(host, 1, false)

  // ---------------------------------------------------------------- round 3
  await waitPlayingOrPast(host, 2)
  await Promise.all([anna, luca, bruno3].map((p) => waitPlayingOrPast(p, 2)))
  await Promise.all([host, anna, luca, bruno3].map((p) => boardReady(p)))
  await sleep(1200)
  await placeSegment(luca, 1, 1)
  for (const p of [luca, anna, bruno3, host]) await confirm(p)
  await waitRevealOrPast(host, 2, 70_000)
  await hostNext(host, 2, true)
  const peers = [host, anna, luca, bruno3]
  await Promise.all(peers.map((p) => waitScreen(p, 'final', 60_000)))
  await sleep(4500)
  s = await snap(host)
  const exp = expectedStandings(s.room)
  const lucaScore = s.room.players.find((p) => p.id === ids.Luca).score
  const lucaSum = s.room.results.reduce((a, l) => a + (l.find((x) => x.playerId === ids.Luca)?.points ?? 0), 0)
  check(lucaScore === lucaSum, `late joiner total = sum of rounds 2–3 (${lucaScore})`)
  const rows = await Promise.all(peers.map(finalRows))
  log('final rows', rows[2])
  const names = rows.map((rs) => rs.map((t) => exp.map((e) => e.name).find((n) => t.includes(n))))
  check(names.every((ns) => JSON.stringify(ns) === JSON.stringify(exp.map((e) => e.name))), 'final standings consistent + correct on every peer (incl. late joiner)', { names, exp })
  for (const p of peers) await shot(p, 's3-final')
  timings.hostTimeline = await timeline(host)
  ok = true
} catch (err) {
  check(false, `FATAL ${err?.stack ?? err}`)
  for (const p of all) {
    try {
      await shot(p, 's3-FAIL')
      const sn = await snap(p)
      console.log('SNAP', p.__name, JSON.stringify({ phase: sn.room?.phase, conn: sn.connection, err: sn.error, subs: sn.room?.submissions, players: sn.room?.players.map((x) => [x.name, x.connected, x.score, x.activeFromRound]) }))
    } catch {
      /* ignore */
    }
  }
} finally {
  await browser.close()
}
console.log('timings', JSON.stringify(timings))
finish('s3-late-refresh', { timings })
process.exit(ok ? 0 : 1)
