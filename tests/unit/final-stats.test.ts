import { expect, test } from 'bun:test'
import { computeFinalSummary, computeHeadline, formatAccuracy, joinNames } from '../../src/screens/final/stats'
import { LAB_ROOMS } from '../fixtures/final'
import { fxFinal } from '../fixtures/room'
import { scoreArrangement } from '../../src/game/scoring'
import type { RoomState, RoundResult } from '../../src/game/types'

test('final: standings, awards, headline', () => {
  const s = computeFinalSummary(LAB_ROOMS.final)
  console.log(s.standings.map((x) => `${x.rank} ${x.player.name} ${x.score} perf=${x.perfectRounds} acc=${formatAccuracy(x, s.snippets)} avg=${x.avgConfirmMs} to=${x.timeouts}`))
  console.log(s.awards.map((a) => `${a.title}: ${a.winners.map((w) => w.name)} ${a.value}`))
  console.log(s.rounds.map((r) => `${r.index} ${r.track?.title} top=${r.topIds}`))
  expect(s.standings[0].player.name).toBe('Giulia')
  expect(s.roundsPlayed).toBe(5)
  expect(s.maxScore).toBe(25000)
  expect(computeHeadline(s, 'p-host')).toEqual({ title: 'Giulia vince!', subtitle: expect.stringContaining('Sei 2º su 5'), tone: 'lose' })
  expect(computeHeadline(s, 'p-2').title).toBe('Hai vinto!')
  console.log(computeHeadline(s, 'p-2'), computeHeadline(s, 'p-host'))
})

test('variants', () => {
  for (const [k, room] of Object.entries(LAB_ROOMS)) {
    const s = computeFinalSummary(room)
    console.log(k, JSON.stringify(computeHeadline(s, 'p-host')), s.awards.map((a) => `${a.title}:${a.winners.map((w) => w.name).join('+')}:${a.value}`).join(' | '))
  }
  const tie = computeFinalSummary(LAB_ROOMS.tie)
  expect(tie.winners.length).toBe(2)
  expect(computeHeadline(tie, 'p-host').subtitle).toBe('Hai vinto insieme a Giulia')
  expect(computeHeadline(tie, 'p-3').subtitle).toBe('Tommy e Giulia vincono a pari merito')
  expect(computeHeadline(computeFinalSummary(LAB_ROOMS.zero), 'p-host').tone).toBe('zero')
  expect(computeHeadline(computeFinalSummary(LAB_ROOMS.solo), 'p-host').tone).toBe('solo')
  expect(joinNames(['a', 'b', 'c'])).toBe('a, b e c')
  const fx = computeFinalSummary(fxFinal)
  expect(fx.rounds.length).toBe(5)
})

// --- QA fixes: solo / zero headlines, awards need 2+ players, speed awards ignore 0-point rounds

function res(playerId: string, order: number[], timeMs: number, timedOut = false): RoundResult {
  return { playerId, order, ...scoreArrangement(order, order.length), timeMs, timedOut }
}
const MESS = [5, 2, 7, 0, 3, 6, 1, 4]
function withTotals(room: RoomState): RoomState {
  return { ...room, players: room.players.map((p) => ({ ...p, score: room.results.reduce((s, r) => s + (r.find((x) => x.playerId === p.id)?.points ?? 0), 0) })) }
}

test('solo at zero: singular headline, no awards', () => {
  const room = withTotals({ ...LAB_ROOMS.solo, results: LAB_ROOMS.solo.results.map((r) => r.map((x) => res(x.playerId, MESS, 2800))) })
  const s = computeFinalSummary(room)
  expect(s.standings[0].score).toBe(0)
  expect(computeHeadline(s, 'p-host')).toEqual({ title: 'Zero punti!', subtitle: 'Riprova: la prossima la rimetti in ordine.', tone: 'zero' })
  expect(s.awards).toEqual([])
})

test('solo with points: solo headline, no comparative awards', () => {
  const s = computeFinalSummary(LAB_ROOMS.solo)
  expect(computeHeadline(s, 'p-host').tone).toBe('solo')
  expect(s.awards).toEqual([])
})

test('several players at zero still say "Tutti a zero!"', () => {
  const h = computeHeadline(computeFinalSummary(LAB_ROOMS.zero), 'p-host')
  expect(h.title).toBe('Tutti a zero!')
  expect(h.tone).toBe('zero')
})

test('awards need at least two players who actually played', () => {
  const duo = LAB_ROOMS.duo
  // Giulia joined too late to play any round.
  const room = withTotals({ ...duo, results: duo.results.map((r) => r.filter((x) => x.playerId === 'p-host')) })
  const s = computeFinalSummary(room)
  expect(s.standings.length).toBe(2)
  expect(s.awards).toEqual([])
})

test('Fulmine ignores instant 0-point confirms', () => {
  const base = LAB_ROOMS.final
  // DJ Pinguino confirms the untouched board after 2.6 s every round.
  const room = withTotals({ ...base, results: base.results.map((r) => r.map((x) => (x.playerId === 'p-3' ? res('p-3', MESS, 2600) : x))) })
  const s = computeFinalSummary(room)
  const dj = s.standings.find((x) => x.player.id === 'p-3')!
  expect(dj.avgConfirmMs).toBe(2600)
  expect(dj.avgScoringConfirmMs).toBeNull()
  const fast = s.awards.find((a) => a.id === 'lightning')!
  expect(fast.winners.map((w) => w.id)).not.toContain('p-3')
  // The fastest scoring confirmer wins it (Tommy: 52.1, 33.9, 41.5, 27.3, 36.8 → 38.3 s; Giulia 41.5 s).
  expect(fast.winners.map((w) => w.id)).toEqual(['p-host'])
  expect(fast.value).toBe('in media 38,3\u00a0s')
})

test('a round scored with points counts toward Fulmine, timeouts never do', () => {
  const s = computeFinalSummary(LAB_ROOMS.final)
  for (const row of s.standings) {
    if (row.avgScoringConfirmMs != null) expect(row.avgConfirmMs).not.toBeNull()
  }
  const marco = s.standings.find((x) => x.player.id === 'p-4')!
  // Marco ran out of time in three of his five rounds.
  expect(marco.timeouts).toBe(3)
})
