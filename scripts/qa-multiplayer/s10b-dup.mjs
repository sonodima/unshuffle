// Scenario 10 (ported): the SAME profile in two places.
//  a0) the profile id copied into ANOTHER browser (no re-attach secret) → refused 'duplicate', A keeps the seat
//  a) lobby: A in, then B (a second tab of the same browser: same profile + secret) joins → roster, who owns the seat, what A sees
//  b) A re-enters → does the seat ping-pong? any automatic loop?
//  c) in game: A drags (no confirm), B takes over mid-round → what B's board shows vs what gets scored
//  d) the host's own profile joining as a guest from another browser
import {
  DESKTOP, PHONE, boardOrder, browser, check, configure, confirm, createRoom, gotoHome, joinByCode, launch, log, openPlayer,
  pickPlaylist, placeCorrect, shot, st, startGame, summary, waitBoard, waitPhase, waitScreen, waitStore,
} from './lib.mjs'

const tag = Math.random().toString(36).slice(2, 6)
const twin = { id: `qa-twin-${tag}`, name: 'Twin', avatar: 4, color: 4 }
const hostProf = { id: `qa-host-${tag}`, name: 'Host', avatar: 0, color: 0 }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const out = {}
const brief = (s) => ({ role: s.role, conn: s.connection, err: s.error, phase: s.room?.phase.kind ?? null })

await launch()
const host = await openPlayer('host', DESKTOP, { profile: hostProf })
const A = await openPlayer('A', PHONE, { profile: twin })
A.__touch = true
const all = [host, A]
let B = null
async function okDialog(p) {
  const btn = p.getByRole('dialog').getByRole('button', { name: /^Ok$/i })
  if (await btn.count()) await (p.__touch ? btn.first().tap() : btn.first().click()).catch(() => {})
  await sleep(400)
}
try {
  await Promise.all(all.map(gotoHome))
  const code = await createRoom(host)
  // a) lobby
  await joinByCode(A, code, { touch: true })
  await waitScreen(A, 'lobby')
  // a0) the same profile id from another browser (its own secret): refused, A keeps the seat
  const X = await openPlayer('X', DESKTOP, { profile: twin })
  await gotoHome(X)
  await joinByCode(X, code)
  // A refused join stays on Home with the reason inline (the store's error is cleared there).
  const xMsg = await X.getByText(/già in questa stanza/).first().textContent({ timeout: 20_000 }).catch(() => null)
  const [sx, sa0] = await Promise.all([X, A].map(st))
  out.copiedId = { X: { ...brief(sx), shown: xMsg }, A: brief(sa0) }
  log('a0) copied id from another browser', JSON.stringify(out.copiedId))
  check('10a0: a copied profile id from another browser is refused (duplicate)', sx.role === 'none' && !!xMsg, xMsg)
  check('10a0: the original tab keeps its seat', sa0.role === 'client' && sa0.connection === 'open', JSON.stringify(brief(sa0)))
  await shot(X, 's10b-a0-copied-id')
  await X.context().close()
  // a) a second tab of the SAME browser (localStorage shared: profile + secret) hands the seat over
  B = await openPlayer('B', DESKTOP, { storageState: await A.context().storageState() })
  all.push(B)
  await gotoHome(B)
  const tB = Date.now()
  await joinByCode(B, code)
  await waitScreen(B, 'lobby', 20_000)
  await waitStore(A, '(s) => s.role === "none"', null, 10_000).catch(() => {})
  out.aKickedAfterMs = Date.now() - tB
  let [sh, sa, sb] = await Promise.all([host, A, B].map(st))
  out.lobby = { roster: sh.room.players.map((p) => `${p.name}:${p.connected}`), A: brief(sa), B: brief(sb) }
  log('a) lobby', JSON.stringify(out.lobby))
  check('10a: one roster entry for the shared profile', sh.room.players.length === 2)
  check('10a: newest tab (B) owns the seat', sb.role === 'client' && sb.connection === 'open')
  check('10a: older tab (A) is told the profile is in use in another tab', sa.role === 'none' && /altra scheda/.test(sa.error ?? ''), sa.error)
  await shot(A, 's10b-a-oldtab')
  // b) A re-enters
  await okDialog(A)
  await waitScreen(A, 'home', 10_000)
  const tA = Date.now()
  await joinByCode(A, code, { touch: true })
  await waitScreen(A, 'lobby', 20_000).catch(() => {})
  await waitStore(B, '(s) => s.role === "none"', null, 10_000).catch(() => {})
  out.bKickedAfterMs = Date.now() - tA
  await sleep(3000) // any automatic re-join loop would show up here
  ;[sh, sa, sb] = await Promise.all([host, A, B].map(st))
  out.reenter = { roster: sh.room.players.map((p) => `${p.name}:${p.connected}`), A: brief(sa), B: brief(sb) }
  log('b) A re-enters', JSON.stringify(out.reenter))
  check('10b: re-entering tab takes the seat back, other tab parked (no automatic ping-pong)', sa.role === 'client' && sb.role === 'none' && sh.room.players.length === 2)
  await shot(B, 's10b-b-B-parked')
  await okDialog(B)

  // c) in game
  await pickPlaylist(host, process.env.QUERY ?? 'hits 2000')
  await configure(host, { rounds: 3, snippets: 6, roundTime: 60, finalTimer: 10 })
  await startGame(host)
  await Promise.all([host, A].map((p) => waitPhase(p, 'playing', 0, 120_000)))
  await Promise.all([host, A].map((p) => waitBoard(p)))
  await sleep(1000)
  await placeCorrect(A, 0)
  await placeCorrect(A, 1)
  const aOrder = await boardOrder(A)
  await sleep(700)
  const tC = Date.now()
  await B.goto(`${new URL(B.url()).origin}/#/`, { waitUntil: 'load' })
  await waitScreen(B, 'home')
  await joinByCode(B, code)
  await waitScreen(B, 'round', 20_000)
  await waitBoard(B)
  out.takeoverMs = Date.now() - tC
  await sleep(1500)
  const bOrder = await boardOrder(B)
  ;[sh, sa, sb] = await Promise.all([host, A, B].map(st))
  out.inGame = { A: brief(sa), B: brief(sb), aOrder, bOrder, init: sh.room.rounds[0].initialOrder }
  log('c) B takes over mid-round', JSON.stringify(out.inGame))
  check('10c: B inherits the seat mid-round (A parked)', sb.role === 'client' && sa.role === 'none')
  check('10c: B board shows the arrangement the host will score (A\'s)', JSON.stringify(bOrder) === JSON.stringify(aOrder), `A had ${aOrder}, B shows ${bOrder}`)
  await shot(B, 's10b-c-B-takeover')
  await shot(A, 's10b-c-A-parked')
  // end the round: host moves + confirms (starts the 10 s final timer), B does nothing
  await placeCorrect(host, 0)
  await confirm(host)
  await Promise.all([host, B].map((p) => waitPhase(p, 'reveal', 0, 20_000)))
  await sleep(1500)
  const res = (await st(host)).room.results[0].find((r) => r.playerId === twin.id)
  out.scored = res.order
  check('10c: scored order == what B saw on its board', JSON.stringify(res.order) === JSON.stringify(bOrder), `scored ${res.order} (A ${aOrder}, B ${bOrder}) pts ${res.points}`)
  await sleep(4000)
  await shot(B, 's10b-c-B-reveal')

  // d) host profile as a guest from another browser
  const H2 = await openPlayer('H2', DESKTOP, { profile: hostProf })
  all.push(H2)
  await gotoHome(H2)
  await joinByCode(H2, code)
  await waitStore(H2, '(s) => s.role === "none" && !!s.error', null, 15_000).catch(() => {})
  const s2 = await st(H2)
  out.hostDup = brief(s2)
  log('d) host profile as guest', JSON.stringify(out.hostDup))
  check('10d: host profile joining as guest is refused, room unaffected', s2.role === 'none' && (await st(host)).room.phase.kind === 'reveal', s2.error)
  await shot(H2, 's10b-d-hostdup')
} catch (err) {
  check('FATAL', false, err?.stack ?? String(err))
  for (const p of all) await shot(p, 's10b-FAIL')
} finally {
  summary(`s10b ${JSON.stringify(out)}`)
  await browser.close()
}
