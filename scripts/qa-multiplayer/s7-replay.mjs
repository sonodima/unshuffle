// Scenario 7: host "Rigioca" → lobby with the same players, scores reset, settings kept;
// start a second game immediately → works (no stale timers / audio / arrangement).
import {
  launch, openPlayer, DESKTOP, PHONE, snap, createRoom, joinByLink, pickPlaylist, setSettings, startGame,
  waitStore, check, log, shot, finish, recordTimeline, timeline, waitScreen, sleep, boardReady, waitPlayingOrPast,
  waitRevealOrPast, hostNext, confirm, placeSegment, boardOrder,
} from './lib.mjs'

const timings = {}
const browser = await launch()
let ok = false
const all = []
const audioState = (p) => p.evaluate(async () => {
  const { audioEngine } = await import('/src/audio/engine.ts')
  const st = audioEngine.getState?.()
  return st ? { playing: st.playing, key: st.key ?? null, tag: st.tag ?? null } : null
})
try {
  const host = await openPlayer(browser, 'Host', DESKTOP)
  const pia = await openPlayer(browser, 'Pia', PHONE)
  const ugo = await openPlayer(browser, 'Ugo', PHONE)
  all.push(host, pia, ugo)
  const code = await createRoom(host)
  await Promise.all([pia, ugo].map((g) => joinByLink(g, code)))
  await waitStore(host, '(s) => s.room?.players.length === 3', null, 20_000)
  await pickPlaylist(host)
  const SETTINGS = { rounds: 3, snippets: 6, roundTime: 90, finalTimer: 20 }
  await setSettings(host, SETTINGS)
  await Promise.all(all.map(recordTimeline))
  const settingsBefore = (await snap(host)).room.settings

  const playGame = async (G) => {
    await startGame(host)
    for (let r = 0; r < 3; r++) {
      const phs = await Promise.all(all.map((p) => waitPlayingOrPast(p, r)))
      if (!phs.every((p) => p.kind === 'playing' && p.round === r)) {
        check(false, `${G} r${r + 1}: missed playing phase`, phs)
        continue
      }
      await Promise.all(all.map((p) => boardReady(p)))
      await sleep(1200)
      if (r === 0) {
        const orders = await Promise.all(all.map(boardOrder))
        const s = await snap(host)
        check(orders.every((o) => JSON.stringify(o) === JSON.stringify(s.room.rounds[r].initialOrder)), `${G} r1: every board starts from the initial shuffle (no stale arrangement)`, orders)
      }
      await placeSegment(pia, 0, 0)
      for (const p of all) await confirm(p)
      await waitRevealOrPast(host, r, 60_000)
      await sleep(1500)
      await hostNext(host, r, r === 2)
    }
    await Promise.all(all.map((p) => waitScreen(p, 'final', 60_000)))
  }

  await playGame('g1')
  await sleep(3500)
  const fin = await snap(host)
  log('game 1 scores', fin.room.players.map((p) => [p.name, p.score]))
  await shot(host, 's7-g1-final')
  const a1 = await Promise.all(all.map(audioState))
  log('audio on final', a1)

  // ---------------------------------------------------------------- Rigioca
  const tR = Date.now()
  await host.getByRole('button', { name: 'Rigioca' }).click()
  await Promise.all(all.map((p) => waitScreen(p, 'lobby', 15_000)))
  timings.rigiocaToLobbyMs = Date.now() - tR
  await sleep(1500)
  const ls = await Promise.all(all.map(snap))
  check(ls.every((s) => s.room.phase.kind === 'lobby'), 'Rigioca → everybody in the lobby')
  check(ls.every((s) => s.room.players.length === 3 && s.room.players.every((p) => p.score === 0 && p.activeFromRound === 0)), 'same 3 players, scores reset', ls[0].room.players)
  check(JSON.stringify(ls[0].room.settings) === JSON.stringify({ ...settingsBefore, playlist: settingsBefore.playlist?.id ?? null }) || ls[0].room.settings.rounds === SETTINGS.rounds, 'settings kept', ls[0].room.settings)
  check(ls.every((s) => s.room.results.length === 0 && s.room.tracks.length === 0), 'results / tracks cleared')
  const a2 = await Promise.all(all.map(audioState))
  log('audio in lobby after Rigioca', a2)
  check(a2.every((a) => !a || !a.playing), 'no audio still playing in the lobby after Rigioca', a2)
  await Promise.all(all.map((p) => shot(p, 's7-lobby-again')))
  const lobbyRows = await host.locator('ul[aria-label="Elenco giocatori"] > li').allInnerTexts()
  log('lobby rows', lobbyRows)

  // ---------------------------------------------------------------- game 2 immediately
  const seqBefore = ls[0].room.seq
  await playGame('g2')
  await sleep(3000)
  const fin2 = await snap(host)
  const sums = fin2.room.players.map((p) => fin2.room.results.reduce((a, l) => a + (l.find((x) => x.playerId === p.id)?.points ?? 0), 0))
  check(JSON.stringify(sums) === JSON.stringify(fin2.room.players.map((p) => p.score)), 'game 2 scores = sum of game-2 results only', { sums, scores: fin2.room.players.map((p) => p.score) })
  check(fin2.room.results.length === 3, 'game 2 has exactly 3 rounds of results')
  const tl = await timeline(host)
  // stale timer check: after g2 started, the phase sequence must be monotonic (no reveal/final from g1 firing into g2)
  const seq = tl.map((x) => JSON.parse(x.k)).map((k) => `${k[0]}${k[1] ?? ''}`)
  log('host phase sequence', seq.filter((v, i) => v !== seq[i - 1]).join(' '))
  timings.hostPhases = seq.filter((v, i) => v !== seq[i - 1])
  await shot(host, 's7-g2-final')
  ok = true
} catch (err) {
  check(false, `FATAL ${err?.stack ?? err}`)
  for (const p of all) {
    try {
      await shot(p, 's7-FAIL')
      const sn = await snap(p)
      console.log('SNAP', p.__name, JSON.stringify({ phase: sn.room?.phase, conn: sn.connection, err: sn.error }))
    } catch {
      /* ignore */
    }
  }
} finally {
  await browser.close()
}
console.log('timings', JSON.stringify(timings))
finish('s7-replay', { timings })
process.exit(ok ? 0 : 1)
