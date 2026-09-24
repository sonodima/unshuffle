// bun test scripts/reveal
import { describe, expect, test } from 'bun:test'
import { FX_NOW, fxReveal } from '../../src/dev/fixtures'
import { revealFixture } from '../../src/dev/reveal/fixtures'
import {
  breakdownOf,
  buildRevealModel,
  buildTimeline,
  formatPoints,
  boardLabels,
  marksFor,
  roundStats,
  sanitizeOrder,
  secondsUntil,
  shouldSkipChoreography,
  sortedViewMarks,
  streakPitch,
  streaks,
} from '../../src/screens/round/reveal/model'
import { scoreArrangement } from '../../src/game/scoring'

describe('orders & marks', () => {
  test('sanitizeOrder rejects non-permutations', () => {
    expect(sanitizeOrder([0, 1, 2], 3)).toEqual([0, 1, 2])
    expect(sanitizeOrder([0, 0, 2], 3)).toBeNull()
    expect(sanitizeOrder([0, 1], 3)).toBeNull()
    expect(sanitizeOrder([0, 1, 3], 3)).toBeNull()
    expect(sanitizeOrder(null, 3)).toBeNull()
  })
  test('marks per view: ✓/✗ in mine, ✓ or neutral + "era Nº" once sorted', () => {
    const order = [0, 1, 2, 4, 3, 5, 6, 7]
    expect(marksFor(order)).toEqual(['correct', 'correct', 'correct', 'wrong', 'wrong', 'correct', 'correct', 'correct'])
    // Sorted board: position p holds segment p. Segments 3 and 4 were swapped → neutral, labelled.
    expect(sortedViewMarks(order)).toEqual(['correct', 'correct', 'correct', null, null, 'correct', 'correct', 'correct'])
    expect(boardLabels(order, 'correct')).toEqual([null, null, null, 'era 5º', 'era 4º', null, null, null])
    expect(boardLabels(order, 'mine')).toEqual([null, null, null, '→ 5º', '→ 4º', null, null, null])
    // A block keeps its ✓ across both views; every misplaced block gets exactly one label per view.
    const o = [2, 0, 1, 3]
    const mine = marksFor(o)
    const sorted = sortedViewMarks(o)
    expect(sorted.filter((m) => m === 'correct').length).toBe(mine.filter((m) => m === 'correct').length)
    expect(sorted[3]).toBe('correct')
    expect(boardLabels(o, 'correct').filter(Boolean)).toHaveLength(mine.filter((m) => m === 'wrong').length)
    expect(boardLabels(o, 'mine').filter(Boolean)).toHaveLength(mine.filter((m) => m === 'wrong').length)
  })
  test('streaks + pitch', () => {
    expect(streaks(['correct', 'correct', 'wrong', 'correct'])).toEqual([0, 1, -1, 0])
    expect(streakPitch(0)).toBe(1)
    expect(streakPitch(7, 8)).toBeCloseTo(2)
    expect(streakPitch(15, 16)).toBeCloseTo(2)
    expect(streakPitch(40, 16)).toBeCloseTo(2)
    expect(streakPitch(1, 16)).toBe(1)
  })
})

describe('breakdown', () => {
  test('position + pair points add up to the total', () => {
    for (const order of [[0, 1, 2, 4, 3, 5, 6, 7], [1, 0, 2, 3, 6, 7, 4, 5], [5, 2, 7, 0, 3, 6, 1, 4], [0, 1, 2, 3, 4, 5, 6, 7]]) {
      const s = scoreArrangement(order, 8)
      const b = breakdownOf({ playerId: 'x', order, ...s, timeMs: 1, timedOut: false }, 8)
      expect(b.positionPoints + b.pairPoints).toBe(s.points)
    }
  })
})

describe('model from fixtures', () => {
  test('host (partial), guest perfect, spectator, missing', () => {
    const host = buildRevealModel(fxReveal, 'p-host')!
    expect(host.mode).toBe('player')
    expect(host.breakdown?.correct).toBe(6)
    expect(host.myMarks?.length).toBe(8)
    expect(host.rows.map((r) => r.rank)).toEqual([...host.rows.map((r) => r.rank)].sort((a, b) => a - b))
    const perfect = buildRevealModel(fxReveal, 'p-2')!
    expect(perfect.breakdown?.perfect).toBe(true)
    expect(perfect.rows.find((r) => r.player.id === 'p-2')?.top).toBe(true)
    const spectator = buildRevealModel(fxReveal, 'p-5')!
    expect(spectator.mode).toBe('spectator')
    expect(spectator.breakdown).toBeNull()
    const last = revealFixture({ last: true, now: FX_NOW })
    const missing = buildRevealModel(last, 'p-5')!
    expect(missing.mode).toBe('missing')
    expect(missing.isLast).toBe(true)
    expect(buildRevealModel({ ...fxReveal, phase: { kind: 'final' } }, 'p-host')).toBeNull()
  })
  test('previous ranking differs when the round reshuffles the board', () => {
    const room = revealFixture({ now: FX_NOW })
    const m = buildRevealModel(room, 'p-host')!
    expect(m.prevOrder).not.toEqual(m.rows.map((r) => r.player.id))
    expect(m.rows[0].player.id).toBe('p-2')
  })
  test('any snippet count', () => {
    for (const n of [6, 8, 12, 16]) {
      const m = buildRevealModel(revealFixture({ n, now: FX_NOW }), 'p-host')!
      expect(m.n).toBe(n)
      expect(m.myOrder?.length).toBe(n)
    }
  })
  test('round stats', () => {
    const m = buildRevealModel(fxReveal, 'p-host')!
    const s = roundStats(m.rows)!
    expect(s.perfect).toBe(1)
    expect(s.fastest?.name).toBe('Giulia')
  })
})

describe('timeline & time', () => {
  test('beats are ordered', () => {
    for (const n of [6, 8, 12, 16]) {
      const t = buildTimeline(n, true)
      expect(t.marks.length).toBe(n)
      expect(t.board).toBeLessThan(t.marks[0])
      expect(t.marks[n - 1]).toBeLessThan(t.sort)
      expect(t.sort).toBeLessThan(t.score)
      expect(t.score).toBeLessThan(t.lead)
      expect(t.lead).toBeLessThan(t.ranks)
      expect(t.ranks).toBeLessThan(t.done)
      expect(t.ranks).toBeLessThan(5200)
    }
    expect(buildTimeline(8, false).marks).toEqual([])
  })
  test('countdown + skip', () => {
    expect(secondsUntil(null, 0)).toBeNull()
    expect(secondsUntil(10_500, 0)).toBe(11)
    expect(secondsUntil(0, 5000)).toBe(0)
    expect(shouldSkipChoreography(FX_NOW + 20_000, FX_NOW, 25_000)).toBe(false)
    expect(shouldSkipChoreography(FX_NOW + 10_000, FX_NOW, 25_000)).toBe(true)
    expect(shouldSkipChoreography(null, FX_NOW, 25_000)).toBe(false)
  })
  test('points format', () => {
    expect(formatPoints(3571)).toBe('3.571')
    expect(formatPoints(10000)).toBe('10.000')
    expect(formatPoints(0)).toBe('0')
    expect(formatPoints(571.4)).toBe('571')
    expect(formatPoints(-1200)).toBe('-1.200')
  })
})
