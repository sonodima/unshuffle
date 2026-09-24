// Scenario 10: two browsers joining with the SAME profile (localStorage copied).
import {
  launch, openPlayer, DESKTOP, PHONE, snap, createRoom, joinByLink, pickPlaylist, setSettings, startGame,
  waitStore, check, log, shot, finish, sleep, boardReady, waitPlayingOrPast, BASE, waitScreen,
} from './lib.mjs'

const browser = await launch()
let ok = false
const all = []
const out = {}
try {
  const host = await openPlayer(browser, 'Host', DESKTOP)
  const a = await openPlayer(browser, 'Twin', PHONE)
  all.push(host, a)
  const code = await createRoom(host)
  await joinByLink(a, code)
  const prof = (await snap(a))
  // Second browser with the same localStorage profile.
  const b = await openPlayer(browser, 'Twin2', PHONE, { profile: { id: prof.profileId, name: 'Twin' }, url: null })
  all.push(b)
  await joinByLink(b, code).catch(() => {})
  await sleep(2500)
  let [sh, sa, sb] = await Promise.all([host, a, b].map(snap))
  out.lobby = { hostPlayers: sh.room.players.map((p) => [p.name, p.connected]), a: { role: sa.role, conn: sa.connection, err: sa.error }, b: { role: sb.role, conn: sb.connection, err: sb.error } }
  log('same profile in lobby', out.lobby)
  check(sh.room.players.length === 2, 'host roster: still one entry for the shared profile')
  check(sb.role === 'client' && sb.connection === 'open', 'newest tab owns the seat')
  check(sa.role === 'none' && /altra scheda/.test(sa.error ?? ''), 'older tab is told it is connected elsewhere', sa.error)
  await shot(a, 's10-old-tab')
  const dlg = await a.locator('[role="dialog"]').allInnerTexts()
  log('old tab dialog', dlg)
  // Old tab tries to come back: ping-pong?
  await a.goto(`${BASE}#/r/${code}`, { waitUntil: 'load' })
  await waitScreen(a, 'home')
  await sleep(300)
  await a.getByRole('button', { name: /^Entra/ }).first().tap()
  await sleep(3500)
  ;[sh, sa, sb] = await Promise.all([host, a, b].map(snap))
  out.pingpong = { a: [sa.role, sa.connection, sa.error], b: [sb.role, sb.connection, sb.error], players: sh.room.players.length }
  log('old tab rejoins', out.pingpong)
  await shot(b, 's10-new-tab-after-old-rejoined')
  // During a game: both tabs alive, B joins again mid-round
  await pickPlaylist(host)
  await setSettings(host, { rounds: 3, snippets: 6, roundTime: 60, finalTimer: 30 })
  await startGame(host)
  await waitPlayingOrPast(host, 0)
  await sleep(2000)
  ;[sh, sa, sb] = await Promise.all([host, a, b].map(snap))
  out.inGame = { a: [sa.role, sa.connection, sa.room?.phase.kind], b: [sb.role, sb.connection, sb.room?.phase.kind], players: sh.room.players.map((p) => [p.name, p.connected]) }
  log('in game', out.inGame)
  ok = true
} catch (err) {
  check(false, `FATAL ${err?.stack ?? err}`)
  for (const p of all) await shot(p, 's10-FAIL')
} finally {
  await browser.close()
}
console.log(JSON.stringify(out, null, 1))
finish('s10-dup', { out })
process.exit(ok ? 0 : 1)
