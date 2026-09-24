// Scenario 1 + 2: 4 players (host desktop, 2 phones, 1 desktop guest), 3 rounds × 8 snippets,
// 60 s rounds, 10 s final timer. Rounds 1–2: staggered confirms (Giulia first → final
// timer pull-in; Sofi confirms an untouched board; host confirms; Marco never does).
// Round 3: nobody confirms (timer expiry scores the last arrangement).
import {
  launch, openPlayer, DESKTOP, PHONE, snap, createRoom, joinByLink, pickPlaylist, setSettings, startGame,
  waitPhase, waitStore, boardOrder, placeSegment, confirm, displayedSeconds, scoreArrangement, check, log,
  shot, finish, recordTimeline, timeline, revealRows, finalRows, expectedStandings, waitScreen, sleep, waitRevealDone, boardReady, waitPlayingOrPast, waitRevealOrPast, hostNext,
} from './lib.mjs'

const ROUNDS = 3
const N = 8
const FINAL = 15
const RT = 90
const timings = {}
const browser = await launch()
let ok = false
try {
  const host = await openPlayer(browser, 'Host', DESKTOP)
  const giulia = await openPlayer(browser, 'Giulia', PHONE)
  const marco = await openPlayer(browser, 'Marco', PHONE)
  const sofi = await openPlayer(browser, 'Sofi', { viewport: { width: 1280, height: 800 } })
  const all = [host, giulia, marco, sofi]
  const guests = [giulia, marco, sofi]
  globalThis.__all = all

  const code = await createRoom(host)
  log('room', code)
  await Promise.all(guests.map((g) => joinByLink(g, code)))
  await waitStore(host, '(s) => s.room && s.room.players.length === 4 && s.room.players.every(p => p.connected)', null, 20_000)
  check(true, 'all 4 players in the lobby')
  await Promise.all(all.map(recordTimeline))
  const pl = await pickPlaylist(host)
  log('playlist', pl)
  await setSettings(host, { rounds: ROUNDS, snippets: N, roundTime: RT, finalTimer: FINAL })
  const s0 = await Promise.all(all.map(snap))
  check(s0.every((s) => s.room.settings.rounds === ROUNDS && s.room.settings.snippets === N && s.room.settings.roundTime === RT && s.room.settings.finalTimer === FINAL),
    'every peer sees the settings 3/8/90/15', s0.map((s) => s.room.settings))
  await Promise.all(all.map((p) => shot(p, 's1-lobby')))

  const tStart = Date.now()
  await startGame(host)
  const ids = Object.fromEntries(s0.map((s, i) => [all[i].__name, s.me]))
  const nameOf = Object.fromEntries(Object.entries(ids).map(([k, v]) => [v, k]))

  for (let r = 0; r < ROUNDS; r++) {
    const R = `r${r + 1}`
    const phs = await Promise.all(all.map((p) => waitPlayingOrPast(p, r)))
    timings[`${R}-toPlaying`] = (Date.now() - tStart) / 1000
    if (!phs.every((p) => p.kind === 'playing' && p.round === r)) {
      check(false, `${R}: script too slow, missed the playing phase (machine load)`, phs)
      continue
    }
    await Promise.all(all.map((p) => boardReady(p)))
    await sleep(1800)
    const sub = {}
    const nobody = r === ROUNDS - 1

    // Drags (in parallel on different peers)
    await Promise.all([
      (async () => {
        for (const seg of [0, 1, 2]) await placeSegment(giulia, seg, seg)
      })(),
      (async () => {
        await placeSegment(host, 0, 0)
      })(),
    ])
    const orders = Object.fromEntries(await Promise.all(all.map(async (p) => [p.__name, await boardOrder(p)])))
    log(R, 'orders', orders)

    if (!nobody) {
      // Giulia confirms first: everyone must see the final timer.
      const seen = all.map((p) => waitStore(p, '(s) => s.room?.phase.kind === "playing" && !!s.room.phase.firstSubmit', null, 15_000).then(() => Date.now()))
      sub.Giulia = await boardOrder(giulia)
      const tClick = Date.now()
      await confirm(giulia)
      const seenAt = await Promise.all(seen)
      timings[`${R}-firstSubmitPropagationMs`] = Object.fromEntries(all.map((p, i) => [p.__name, seenAt[i] - tClick]))
      const measure = (async () => {
        await sleep(700)
        const snaps = await Promise.all(all.map(snap))
        const secs = await Promise.all(all.map(displayedSeconds))
        const ph = snaps[0].room.phase
        const localEnds = snaps.map((s) => s.room.phase.endsAt - (s.hostNow - s.now))
        const spread = Math.max(...localEnds) - Math.min(...localEnds)
        check(ph.firstSubmit?.playerId === ids.Giulia, `${R}: firstSubmit is Giulia`)
        check(ph.endsAt === ph.firstSubmit.at + FINAL * 1000, `${R}: endsAt pulled in to firstSubmit.at + ${FINAL}s`, { endsAt: ph.endsAt, at: ph.firstSubmit.at })
        check(snaps.every((s) => s.room.phase.endsAt === ph.endsAt), `${R}: every peer has the same endsAt`)
        check(spread < 500, `${R}: endsAt in local clock agrees across peers (spread ${spread.toFixed(0)} ms)`, { offsets: snaps.map((s) => Math.round(s.hostNow - s.now)) })
        check(Math.max(...secs) - Math.min(...secs) <= 1, `${R}: displayed timers agree (${secs.join(',')})`)
        timings[`${R}-displayedAfterFirst`] = secs
      })()
      const confirmAs = async (page, who, delay) => {
        await sleep(delay)
        const ph = (await snap(page)).room.phase
        if (ph.kind !== 'playing' || ph.round !== r) return log(R, who, 'too late to confirm', ph)
        sub[who] = await boardOrder(page)
        await confirm(page)
        await waitStore(host, '(s, id) => s.room.submissions[id]?.submitted === true || s.room.results.length > ' + r, ids[who], 10_000)
        const ok2 = (await snap(host)).room.results[r] === undefined ? true : null
        timings[`${R}-${who}-confirmAfterFirstMs`] = Date.now() - tClick
        return ok2
      }
      await Promise.all([measure, confirmAs(sofi, 'Sofi', 1000), confirmAs(host, 'Host', 2500)])
      if (r === 0) await Promise.all(all.map((p) => shot(p, `s1-${R}-after-confirms`)))
    }

    // Wait for the reveal everywhere; measure when each peer got there vs endsAt.
    await Promise.all(all.map((p) => waitRevealOrPast(p, r)))
    const tls = await Promise.all(all.map(timeline))
    const lastPlaying = tls[0].filter((x) => { const k = JSON.parse(x.k); return k[0] === 'playing' && k[1] === r }).pop()
    const endsAt = lastPlaying ? JSON.parse(lastPlaying.k)[2] : NaN
    const late = tls.map((tl) => {
      const e = tl.find((x) => { const k = JSON.parse(x.k); return k[0] === 'reveal' && k[1] === r })
      return e ? e.t - endsAt : null
    })
    timings[`${R}-revealLagVsEndsAtMs`] = Object.fromEntries(all.map((p, i) => [p.__name, late[i]]))
    check(late.every((l) => l != null && l < 1500 && l > -500), `${R}: reveal reached on every peer within 1.5 s of endsAt (Marco never confirms)`, late)

    const snaps = await Promise.all(all.map(snap))
    const res = snaps[0].room.results[r]
    check(snaps.every((s) => JSON.stringify(s.room.results) === JSON.stringify(snaps[0].room.results)), `${R}: results identical on all peers`)
    check(snaps.every((s) => JSON.stringify(s.room.players.map((p) => p.score)) === JSON.stringify(snaps[0].room.players.map((p) => p.score))), `${R}: scores identical on all peers`)
    check(res.length === 4, `${R}: 4 results`, res.length)
    for (const rr of res) {
      const who = nameOf[rr.playerId]
      const expectedOrder = sub[who] ?? orders[who]
      const sc = scoreArrangement(rr.order, N)
      check(JSON.stringify(rr.order) === JSON.stringify(expectedOrder), `${R}: ${who} scored order == what was on their board`, { scored: rr.order, board: expectedOrder })
      check(sc.points === rr.points && sc.correct === rr.correct && sc.pairs === rr.pairs, `${R}: ${who} points ${rr.points} == scoreArrangement`, sc)
      const shouldTimeout = nobody || !sub[who]
      check(rr.timedOut === shouldTimeout, `${R}: ${who} timedOut=${rr.timedOut}`)
      if (shouldTimeout) check(rr.timeMs === RT * 1000, `${R}: ${who} timed-out timeMs = full round`, rr.timeMs)
    }
    if (nobody) {
      const pts = Object.fromEntries(res.map((x) => [nameOf[x.playerId], x.points]))
      check(pts.Giulia > 0 && pts.Host > 0, `${R} (nobody confirms): dragged boards score > 0 on timeout`, pts)
      check(pts.Sofi === 0 && pts.Marco === 0, `${R}: untouched boards score 0`, pts)
    }
    const sorted = [...res].sort((a, b) => b.points - a.points || a.timeMs - b.timeMs)
    check(JSON.stringify(sorted.map((x) => x.playerId)) === JSON.stringify(res.map((x) => x.playerId)), `${R}: results ranked points desc, time asc`)
    const totals = snaps[0].room.players.map((p) => p.score)
    const sums = snaps[0].room.players.map((p) => snaps[0].room.results.reduce((a, list) => a + (list.find((x) => x.playerId === p.id)?.points ?? 0), 0))
    check(JSON.stringify(totals) === JSON.stringify(sums), `${R}: player.score == sum of results`, { totals, sums })

    const done = await Promise.all(all.map((p) => waitRevealDone(p, 20_000).then(() => true, () => false)))
    if (done.every(Boolean)) {
      await sleep(500)
      const rows = await Promise.all(all.map(revealRows))
      const norm = rows.map((rs) => rs.map((x) => (x ?? '').replace(' (tu)', '')))
      check(norm.every((rs) => JSON.stringify(rs) === JSON.stringify(norm[0])), `${R}: reveal leaderboard identical on all peers`, norm[0])
      if (r === 0) await Promise.all(all.map((p) => shot(p, `s1-${R}-reveal`)))
    } else log(R, 'reveal animation not done in 20 s on', done)
    const last = r === ROUNDS - 1
    await hostNext(host, r, last)
  }

  await Promise.all(all.map((p) => waitScreen(p, 'final', 60_000)))
  await sleep(4500)
  const fs = await Promise.all(all.map(snap))
  const exp = expectedStandings(fs[0].room)
  log('expected standings', exp)
  const rows = await Promise.all(all.map(finalRows))
  log('final rows (host)', rows[0])
  const namesInRows = rows.map((rs) => rs.map((t) => exp.map((e) => e.name).find((n) => t.includes(n))))
  check(namesInRows.every((ns) => JSON.stringify(ns) === JSON.stringify(exp.map((e) => e.name))), 'final standings order matches score desc / time asc on every peer', namesInRows)
  const iS = exp.findIndex((e) => e.name === 'Sofi')
  const iM = exp.findIndex((e) => e.name === 'Marco')
  log('tie-break check Sofi vs Marco', exp[iS], exp[iM])
  await Promise.all(all.map((p) => shot(p, 's1-final')))
  timings.hostTimeline = await timeline(host)
  ok = true
} catch (err) {
  check(false, `FATAL ${err?.stack ?? err}`)
  try {
    for (const p of globalThis.__all ?? []) {
      await shot(p, 's1-FAIL')
      const sn = await snap(p)
      console.log('SNAP', p.__name, JSON.stringify({ phase: sn.room?.phase, conn: sn.connection, err: sn.error, subs: sn.room?.submissions, players: sn.room?.players.map((x) => [x.name, x.connected]) }))
      console.log('TL', p.__name, JSON.stringify(await timeline(p)))
    }
  } catch (e) {
    console.log('diag failed', e)
  }
} finally {
  await browser.close()
}
console.log('timings', JSON.stringify(timings, null, 1))
finish('s1-full', { timings })
process.exit(ok ? 0 : 1)
