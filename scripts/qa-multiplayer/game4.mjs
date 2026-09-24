// Scenarios 1, 2, 3, 7, 9 in one real 4-player game (+ a second game after Rigioca).
//   host  desktop 1440x900 (mouse)      p1/p2 phones 390x844 touch      late: desktop, joins during round 1
// Settings: 3 rounds · 8 snippets · 60 s · final 10 s.
//   R1: p1 confirms first (pull-in measured on all peers), p2 confirms, host drags but never confirms (timeout).
//       late joiner enters while R1 is playing → spectator.
//   R2: nobody confirms (full 60 s): host/p1/late drag, p2 untouched.
//   R3: p1 double-clicks Conferma; p2 drags early, then again finishing ~0.3 s before the end;
//       late confirms ~0.15 s before the end; host confirms ~0.05 s before the end (loopback).
//   Final: standings identical everywhere, match an independent recomputation.
//   Rigioca → lobby (same players, scores 0, settings kept) → second game starts at once, 1 round played.
import {
  DESKTOP, PHONE, boardOrder, check, configure, confirm, consoleLines, createRoom, displayedTimer, drag,
  gotoHome, installRecorder, joinByCode, launch, log, pickPlaylist, placeCorrect, rec, score, shot, st, startGame,
  summary, waitBoard, waitPhase, waitScreen, browser,
} from './lib.mjs'

const QUERY = process.env.QUERY ?? 'hits 2000'
const tag = Math.random().toString(36).slice(2, 6)
const prof = (id, name, avatar, color) => ({ id: `qa-${id}-${tag}`, name, avatar, color })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const until = async (t) => {
  const d = t - Date.now()
  if (d > 0) await sleep(d)
}

await launch()
const host = await openP('host', DESKTOP, prof('host', 'Host', 0, 0))
const p1 = await openP('p1', PHONE, prof('p1', 'Giulia', 1, 1), true)
const p2 = await openP('p2', PHONE, prof('p2', 'Marco', 2, 2), true)
const late = await openP('late', DESKTOP, prof('late', 'Tardi', 3, 3))
async function openP(name, dev, profile, touch = false) {
  const { openPlayer } = await import('./lib.mjs')
  const p = await openPlayer(name, dev, { profile })
  p.__touch = touch
  return p
}
const all = [host, p1, p2, late]
const ids = { host: `qa-host-${tag}`, p1: `qa-p1-${tag}`, p2: `qa-p2-${tag}`, late: `qa-late-${tag}` }
const nameOf = Object.fromEntries(Object.entries(ids).map(([k, v]) => [v, k]))
const submittedOrders = [{}, {}, {}] // round -> id -> order the player really had when it counted
const timings = {}

/** local wall-clock end of the current round as seen by a page (all browsers share Date.now()). */
async function localEnd(page) {
  const s = await st(page)
  const ph = s.room?.phase
  if (!ph || ph.kind !== 'playing') return null
  return ph.endsAt - (s.hostNow - s.localNow)
}

async function snapshotTimers(pages) {
  const [ends, disp] = await Promise.all([Promise.all(pages.map(localEnd)), Promise.all(pages.map(displayedTimer))])
  return { ends, disp }
}

async function verifyRound(r, pages, expect) {
  const states = await Promise.all(pages.map(st))
  const lists = states.map((s) => JSON.stringify(s.room.results[r]))
  check(`R${r + 1}: results identical on all ${pages.length} peers`, lists.every((l) => l === lists[0]))
  const list = states[0].room.results[r]
  const n = states[0].room.rounds[r].segments.length
  const scoresOk = []
  for (const res of list) {
    const who = nameOf[res.playerId]
    const recalc = score(res.order, n)
    const want = submittedOrders[r][res.playerId]
    const orderOk = !want || JSON.stringify(want) === JSON.stringify(res.order)
    const ptsOk = recalc.points === res.points && recalc.correct === res.correct && recalc.pairs === res.pairs
    scoresOk.push(`${who}:${res.points}pts c${res.correct} p${res.pairs} to=${res.timedOut} t=${res.timeMs}${orderOk ? '' : ` ORDER≠ want ${want} got ${res.order}`}${ptsOk ? '' : ' POINTS≠'}`)
    check(`R${r + 1}: ${who} points == scoreArrangement(order)`, ptsOk, `${res.points} vs ${recalc.points}`)
    if (want) check(`R${r + 1}: ${who} scored order == what was on their board`, orderOk, `want ${want} got ${res.order}`)
    if (expect?.[who]) expect[who](res)
  }
  log(`R${r + 1} results:`, scoresOk.join(' | '))
  // Leaderboard rows (reveal) on each peer: same order
  const rows = await Promise.all(
    pages.map((p) =>
      p.$$eval('[data-screen-frame]:not([inert]) section[aria-label="Classifica"] li.rv-row', (els) => els.map((e) => e.getAttribute('aria-label')?.split(':')[0])),
    ),
  )
  log(`R${r + 1} reveal leaderboard rows:`, JSON.stringify(rows))
  return states
}

try {
  await Promise.all(all.map(gotoHome))
  const code = await createRoom(host)
  check('host created room', !!code, code)
  await Promise.all([joinByCode(p1, code, { touch: true }), joinByCode(p2, code, { touch: true })])
  await Promise.all([waitScreen(p1, 'lobby'), waitScreen(p2, 'lobby')])
  await host.waitForTimeout(800)
  await Promise.all(all.map(installRecorder))

  // ---- scenario 9a: reaction spam in the lobby (3 peers, as fast as possible)
  const spam = async (p, k) => {
    const btns = p.locator('[data-screen-frame]:not([inert]) [role="group"] button[aria-label^="Reazione"]')
    const cnt = await btns.count()
    for (let i = 0; i < k; i++) await btns.nth(i % cnt).click({ delay: 0, force: true }).catch(() => {})
  }
  const t9 = Date.now()
  await Promise.all([spam(host, 25), spam(p1, 25), spam(p2, 25)])
  const spamMs = Date.now() - t9
  await host.waitForTimeout(600)
  const toastsNow = await Promise.all([host, p1, p2].map(async (p) => (await rec(p)).maxToasts))
  check('9: reaction spam (75 clicks) caused no page errors', !consoleLines.some((l) => l.includes('PAGEERROR')), `spam took ${spamMs} ms, max toasts per peer ${toastsNow}`)
  await shot(host, '00-lobby-spam')

  const pl = await pickPlaylist(host, QUERY)
  log('playlist', pl)
  await configure(host, { rounds: 3, snippets: 8, roundTime: 60, finalTimer: 10 })
  const lobbySettings = (await st(p1)).room.settings
  check('guest sees 3/8/60/10', lobbySettings.rounds === 3 && lobbySettings.snippets === 8 && lobbySettings.roundTime === 60 && lobbySettings.finalTimer === 10, JSON.stringify({ ...lobbySettings, playlist: lobbySettings.playlist?.title }))
  const tStart = Date.now()
  await startGame(host)

  // ================================================================ ROUND 1
  await Promise.all([host, p1, p2].map((p) => waitPhase(p, 'playing', 0, 120_000)))
  timings.r1PrepToPlaying = Date.now() - tStart
  log('R1 playing after', timings.r1PrepToPlaying, 'ms')
  await Promise.all([host, p1, p2].map((p) => waitBoard(p)))
  // Late joiner enters now (round 1 playing)
  const tj = Date.now()
  await joinByCode(late, code)
  await waitScreen(late, 'round', 30_000)
  timings.lateJoin = Date.now() - tj
  await installRecorder(late)
  await late.waitForTimeout(1200)
  const ls = await st(late)
  const lateMe = ls.room.players.find((p) => p.id === ids.late)
  check('3: late joiner has activeFromRound = 1 and score 0', lateMe?.activeFromRound === 1 && lateMe?.score === 0, JSON.stringify(lateMe && { a: lateMe.activeFromRound, s: lateMe.score }))
  const spect = await late.getByText('Stai guardando').count()
  const lateLocked = await late.evaluate(() => !!document.querySelector('[data-round-view="playing"][data-locked]'))
  check('3: late joiner sees spectator card and locked board', spect > 0 && lateLocked, `card=${spect} locked=${lateLocked}`)
  await shot(late, '01-r1-late-spectator')

  await host.waitForTimeout(1200)
  // p1 fixes 2 snippets (touch) and confirms first
  await placeCorrect(p1, 0)
  await placeCorrect(p1, 1)
  const p1Order = await boardOrder(p1)
  submittedOrders[0][ids.p1] = p1Order
  const beforeEnds = await snapshotTimers([host, p1, p2, late])
  log('R1 pre-confirm local ends', beforeEnds.ends.map((e) => e && Math.round(e)), 'displayed', beforeEnds.disp.map((d) => d.secs))
  const tConfirm = Date.now()
  await confirm(p1)
  await Promise.all([host, p1, p2, late].map((p) => p.waitForFunction(() => window.__qaRec?.firstSubmit?.[0], null, { timeout: 5000 })))
  const recs = await Promise.all([host, p1, p2, late].map(rec))
  const fs = recs.map((r) => r.firstSubmit[0])
  const fsLocalEnds = fs.map((f) => f.endsAt - (f.hostNow - f.at))
  const spreadEnd = Math.max(...fsLocalEnds) - Math.min(...fsLocalEnds)
  const arrivals = fs.map((f) => f.at - tConfirm)
  const expectedEnd = fs[0].fsAt + 10_000
  check('1: endsAt pulled in to firstSubmit.at + 10 s', fs.every((f) => f.endsAt === expectedEnd), `endsAt ${fs[0].endsAt} fsAt ${fs[0].fsAt}`)
  check('1: pulled-in end time agrees across 4 peers within 500 ms (clock sync)', spreadEnd <= 500, `spread ${Math.round(spreadEnd)} ms; arrival after tap ${arrivals.join('/')} ms`)
  await sleep(300)
  const t1 = await snapshotTimers([host, p1, p2, late])
  const shown = t1.disp.map((d) => d.secs)
  const exact = t1.ends.map((e, i) => (e - t1.disp[i].at) / 1000)
  check('1: displayed timers agree (integer seconds, max diff ≤ 1)', Math.max(...shown) - Math.min(...shown) <= 1, `shown ${shown} exact ${exact.map((x) => x.toFixed(2))}`)
  timings.r1PullIn = { spreadEnd: Math.round(spreadEnd), arrivals, shown, exact: exact.map((x) => +x.toFixed(2)) }
  await Promise.all([host, p1, p2, late].map((p, i) => shot(p, `02-r1-after-first-confirm-${i}`)))

  // p2 fixes 1 and confirms 3 s later
  await sleep(1500)
  await placeCorrect(p2, 2)
  submittedOrders[0][ids.p2] = await boardOrder(p2)
  await confirm(p2)
  // host: drag without confirming → timeout uses last arrangement
  await placeCorrect(host, 3)
  await placeCorrect(host, 4)
  submittedOrders[0][ids.host] = await boardOrder(host)
  log('R1 host (not confirming) order', submittedOrders[0][ids.host])
  await Promise.all(all.map((p) => waitPhase(p, 'reveal', 0, 20_000)))
  const tReveal = Date.now()
  timings.r1RevealVsEnd = Math.round(tReveal - fsLocalEnds[0])
  log('R1 reveal reached', timings.r1RevealVsEnd, 'ms after predicted end')
  await host.waitForTimeout(2500)
  await verifyRound(0, all, {
    host: (r) => check('2(R1): host timed out with last arrangement, points>0', r.timedOut && r.points > 0, `${r.points} c${r.correct}`),
    p1: (r) => check('R1: p1 confirmed, not timed out', !r.timedOut && r.correct >= 2),
    late: () => check('3: late joiner has NO result in round 1', false),
  })
  const r1res = (await st(host)).room.results[0]
  check('3: late joiner absent from R1 results', !r1res.some((r) => r.playerId === ids.late))
  await Promise.all(all.map((p) => shot(p, '03-r1-reveal')))
  await host.getByRole('button', { name: /Prossimo round/ }).first().click()

  // ================================================================ ROUND 2: nobody confirms
  await Promise.all(all.map((p) => waitPhase(p, 'playing', 1, 90_000)))
  await Promise.all(all.map((p) => waitBoard(p)))
  const ls2 = await late.evaluate(() => !!document.querySelector('[data-round-view="playing"][data-locked]'))
  check('3: late joiner can play round 2 (board unlocked)', !ls2)
  await host.waitForTimeout(1500)
  await placeCorrect(host, 0)
  await placeCorrect(late, 5)
  await placeCorrect(p1, 7)
  const r2init = (await st(host)).room.rounds[1].initialOrder
  submittedOrders[1][ids.host] = await boardOrder(host)
  submittedOrders[1][ids.late] = await boardOrder(late)
  submittedOrders[1][ids.p1] = await boardOrder(p1)
  submittedOrders[1][ids.p2] = r2init
  check('2: p2 board untouched == initialOrder', JSON.stringify(await boardOrder(p2)) === JSON.stringify(r2init))
  const mid = await snapshotTimers(all)
  const midSpread = Math.max(...mid.ends) - Math.min(...mid.ends)
  check('1: R2 mid-round end time agrees across peers ≤ 500 ms', midSpread <= 500, `spread ${Math.round(midSpread)} ms shown ${mid.disp.map((d) => d.secs)}`)
  const r2end = mid.ends[0]
  log('R2 waiting for the 60 s to run out…', Math.round((r2end - Date.now()) / 1000), 's')
  await shot(p2, '04-r2-playing')
  await Promise.all(all.map((p) => waitPhase(p, 'reveal', 1, 75_000)))
  timings.r2RevealVsEnd = Math.round(Date.now() - r2end)
  await host.waitForTimeout(2500)
  await verifyRound(1, all, {
    p2: (r) => check('2: untouched board → 0 points, timedOut', r.points === 0 && r.timedOut, `${r.points}`),
    host: (r) => check('2: host dragged, never confirmed → points>0 timedOut', r.points > 0 && r.timedOut, `${r.points}`),
    late: (r) => check('2/3: late joiner plays R2, points>0 timedOut', r.points > 0 && r.timedOut, `${r.points}`),
    p1: (r) => check('2: p1 dragged, never confirmed → points>0', r.points > 0 && r.timedOut, `${r.points}`),
  })
  await Promise.all(all.map((p) => shot(p, '05-r2-reveal')))
  await host.getByRole('button', { name: /Prossimo round/ }).first().click()

  // ================================================================ ROUND 3: rapid fire
  await Promise.all(all.map((p) => waitPhase(p, 'playing', 2, 90_000)))
  await Promise.all(all.map((p) => waitBoard(p)))
  await host.waitForTimeout(1500)
  // p2 early drag (arrangement A)
  await placeCorrect(p2, 0)
  const p2A = await boardOrder(p2)
  await placeCorrect(p1, 1)
  submittedOrders[2][ids.p1] = await boardOrder(p1)
  // p1 double-clicks confirm
  const btn = p1.getByRole('button', { name: /^Conferma/ }).first()
  const bb = await btn.boundingBox()
  await p1.mouse.dblclick(bb.x + bb.width / 2, bb.y + bb.height / 2)
  await p1.waitForTimeout(700)
  const s3 = await st(host)
  const firstSubmitEvents = (await st(host)).toasts.filter((t) => t.type === 'first-submit').length
  check('9: double-click confirm → one submission, first-submit once', s3.room.submissions[ids.p1]?.submitted === true && firstSubmitEvents <= 1, `fs toasts on host ${firstSubmitEvents}`)
  const end3 = await localEnd(host)
  log('R3 ends in', Math.round(end3 - Date.now()), 'ms')
  // late: small drag, then confirm ~150 ms before the end (remote)
  await placeCorrect(late, 2)
  submittedOrders[2][ids.late] = await boardOrder(late)
  // host: drag, confirm ~50 ms before end (loopback)
  await placeCorrect(host, 3)
  submittedOrders[2][ids.host] = await boardOrder(host)
  // p2: second drag timed to drop ~300 ms before the end
  const p2DragDuration = 14 * 16 + 100 + 60 // approx
  await until(end3 - 300 - p2DragDuration - 150)
  const lateBtn = late.getByRole('button', { name: /^Conferma/ }).first()
  const hostBtn = host.getByRole('button', { name: /^Conferma/ }).first()
  const lbb = await lateBtn.boundingBox()
  const hbb = await hostBtn.boundingBox()
  const p2Order = await boardOrder(p2)
  const from = p2Order.indexOf(5)
  const dragP = drag(p2, from, 5, { settle: 0 }).then(() => Date.now())
  const lateP = (async () => {
    await until(end3 - 150)
    const at = Date.now()
    await late.mouse.click(lbb.x + lbb.width / 2, lbb.y + lbb.height / 2)
    return at
  })()
  const hostP = (async () => {
    await until(end3 - 50)
    const at = Date.now()
    await host.mouse.click(hbb.x + hbb.width / 2, hbb.y + hbb.height / 2)
    return at
  })()
  const [p2DropAt, lateAt, hostAt] = await Promise.all([dragP, lateP, hostP])
  await p2.waitForTimeout(100)
  const p2B = await boardOrder(p2)
  log(`R3 p2 drop at end${Math.round(p2DropAt - end3)} ms · late click end${Math.round(lateAt - end3)} · host click end${Math.round(hostAt - end3)}`)
  await Promise.all(all.map((p) => waitPhase(p, 'reveal', 2, 20_000)))
  await host.waitForTimeout(2500)
  const st3 = await verifyRound(2, all, {})
  const res3 = Object.fromEntries(st3[0].room.results[2].map((r) => [nameOf[r.playerId], r]))
  const p2Got = JSON.stringify(res3.p2.order)
  const p2Verdict = p2Got === JSON.stringify(p2B) ? 'late drag COUNTED' : p2Got === JSON.stringify(p2A) ? 'late drag LOST (earlier arrangement scored)' : `other ${p2Got}`
  check('9: drag finished ~0.3 s before time-up is the arrangement scored', p2Got === JSON.stringify(p2B), `${p2Verdict}; board A=${p2A} B=${p2B} drop at ${Math.round(p2DropAt - end3)} ms vs end`)
  check('9: late confirm ~150 ms before the end accepted (not timed out)', res3.late && !res3.late.timedOut, `timedOut=${res3.late?.timedOut} t=${res3.late?.timeMs}`)
  check('9: host confirm ~50 ms before the end accepted', res3.host && !res3.host.timedOut, `timedOut=${res3.host?.timedOut}`)
  const p2Final = await p2.evaluate(async () => (await import('/src/game/store.ts')).useGame.getState().arrangement)
  log('p2 store arrangement at reveal', p2Final)
  await Promise.all(all.map((p) => shot(p, '06-r3-reveal')))
  await host.getByRole('button', { name: /Classifica finale/ }).first().click()

  // ================================================================ FINAL
  await Promise.all(all.map((p) => waitScreen(p, 'final', 20_000)))
  await host.waitForTimeout(4500)
  const fin = await Promise.all(all.map(st))
  const playersJson = fin.map((s) => JSON.stringify(s.room.players.map((p) => [p.id, p.score])))
  check('final: player scores identical on all peers', playersJson.every((j) => j === playersJson[0]), playersJson[0])
  // independent standings
  const room = fin[0].room
  const tot = {}
  for (const list of room.results) for (const r of list) {
    tot[r.playerId] ??= { pts: 0, t: 0, n: 0 }
    tot[r.playerId].pts += r.points
    tot[r.playerId].t += r.timeMs
    tot[r.playerId].n += 1
  }
  check('final: player.score == Σ round points', room.players.every((p) => p.score === (tot[p.id]?.pts ?? 0)), JSON.stringify(tot))
  // game/standing compareStanding: score desc, rounds played desc, total confirm time asc.
  const expected = [...room.players].sort((a, b) => b.score - a.score || (tot[b.id]?.n ?? 0) - (tot[a.id]?.n ?? 0) || (tot[a.id]?.t ?? 0) - (tot[b.id]?.t ?? 0)).map((p) => p.name)
  const domOrders = await Promise.all(
    all.map((p) => p.$$eval('[data-screen-frame]:not([inert]) section[aria-labelledby="fp-standings"] ol > li', (els) => els.map((e) => e.querySelector('.truncate')?.textContent?.trim()))),
  )
  check('final: standings order (score desc, rounds played desc, total time asc) on every peer', domOrders.every((o) => JSON.stringify(o) === JSON.stringify(expected)), `expected ${expected} got ${JSON.stringify(domOrders)}`)
  const podium = await Promise.all(all.map((p) => p.$$eval('[role="list"][aria-label="Podio"] [role="listitem"]', (els) => els.map((e) => e.getAttribute('aria-label')))))
  log('podium labels', JSON.stringify(podium[0]))
  const lateP2 = room.players.find((p) => p.id === ids.late)
  check('3: late joiner on standings with score from R2+R3 only', lateP2 && lateP2.score === (tot[ids.late]?.pts ?? 0) && room.results[0].every((r) => r.playerId !== ids.late), `score ${lateP2?.score}`)
  await Promise.all(all.map((p) => shot(p, '07-final')))
  const sc = await late.evaluate(() => {
    const f = document.querySelector('[data-screen-frame]:not([inert])')
    const sc = f?.querySelector('.overflow-y-auto') ?? f
    sc?.scrollTo({ top: 600 })
  })
  void sc
  await late.waitForTimeout(800)
  await shot(late, '07b-final-standings')

  // ================================================================ RIGIOCA (scenario 7)
  await host.getByRole('button', { name: 'Rigioca' }).click()
  await Promise.all(all.map((p) => waitScreen(p, 'lobby', 15_000)))
  await host.waitForTimeout(1000)
  const lob = await Promise.all(all.map(st))
  const lr = lob[0].room
  check('7: lobby after Rigioca has the same 4 players, all connected', lr.players.length === 4 && lr.players.every((p) => p.connected), lr.players.map((p) => `${p.name}:${p.connected}`).join(','))
  check('7: scores reset to 0 and activeFromRound 0', lr.players.every((p) => p.score === 0 && p.activeFromRound === 0))
  check('7: settings kept', lr.settings.rounds === 3 && lr.settings.snippets === 8 && lr.settings.roundTime === 60 && lr.settings.finalTimer === 10 && !!lr.settings.playlist, JSON.stringify({ ...lr.settings, playlist: lr.settings.playlist?.title }))
  const audioState = await Promise.all(all.map((p) => p.evaluate(async () => {
    const e = (await import('/src/audio/engine.ts')).audioEngine
    const s = e.getState()
    return { playing: s.playing, key: s.key, tag: s.tag }
  })))
  check('7: no audio still playing in the lobby after Rigioca', audioState.every((a) => !a.playing), JSON.stringify(audioState))
  await Promise.all(all.map((p) => shot(p, '08-lobby-again')))
  // second game immediately
  const t2 = Date.now()
  await startGame(host)
  await Promise.all(all.map((p) => waitPhase(p, 'playing', 0, 120_000)))
  timings.g2PrepToPlaying = Date.now() - t2
  const g2 = await st(host)
  const ph = g2.room.phase
  check('7: game 2 round 1 has a fresh 60 s timer', ph.endsAt - ph.startedAt === 60_000 && !ph.firstSubmit, `${ph.endsAt - ph.startedAt}`)
  check('7: game 2 results/tracks fresh', g2.room.results.length === 0 && g2.room.tracks.length === 3)
  await Promise.all(all.map((p) => waitBoard(p)))
  await host.waitForTimeout(1500)
  const g2late = await late.evaluate(() => !!document.querySelector('[data-round-view="playing"][data-locked]'))
  check('7: former late joiner plays game 2 round 1', !g2late)
  for (const p of all) await confirm(p)
  await Promise.all(all.map((p) => waitPhase(p, 'reveal', 0, 20_000)))
  await host.waitForTimeout(2000)
  const g2r = await st(p2)
  check('7: game 2 round 1 scored for all 4', g2r.room.results[0]?.length === 4, `${g2r.room.results[0]?.length}`)
  const phasesHost = (await rec(host)).phases.map((p) => p.key)
  log('host phase sequence', phasesHost.join(' → '))
  await Promise.all(all.map((p) => shot(p, '09-g2-reveal')))
  // wait past the reveal auto-advance to see no stale timer races
  timings.all = Date.now() - tStart
} catch (err) {
  check('FATAL', false, err?.stack ?? String(err))
  for (const p of all) await shot(p, 'zz-failure')
  for (const p of all) {
    try {
      const s = await st(p)
      log(p.__name, s.room?.phase, s.connection, s.error)
    } catch {
      /* ignore */
    }
  }
} finally {
  summary(`timings ${JSON.stringify(timings)}`)
  await browser.close()
}
