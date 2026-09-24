// bun test scripts/fix-reveal/model.test.ts
import { describe, expect, test } from 'bun:test'
import {
  boardHeightFor,
  boardLabels,
  boardOrderFor,
  marksFor,
  segmentAt,
  sortedViewMarks,
} from '../../src/screens/round/reveal/model'
import { fitGrid } from '../../src/components/board/layout'

describe('sorted view (finding: the right order looked wrong)', () => {
  test('misplaced blocks are neutral once sorted, correct ones keep ✓', () => {
    const order = [0, 1, 2, 4, 3, 5, 6, 7]
    expect(sortedViewMarks(order)).toEqual(['correct', 'correct', 'correct', null, null, 'correct', 'correct', 'correct'])
    // Never a 'wrong' in the correct order, for every permutation of 5.
    const perms = (a: number[]): number[][] => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])))
    for (const p of perms([0, 1, 2, 3, 4])) {
      const m = sortedViewMarks(p)
      expect(m.includes('wrong' as never)).toBe(false)
      expect(m.filter((x) => x === 'correct').length).toBe(marksFor(p).filter((x) => x === 'correct').length)
    }
  })
  test('labels: "era Nº" in the correct order, "→ Nº" in mine', () => {
    const order = [2, 0, 1, 3] // position → segment
    expect(boardLabels(order, 'correct')).toEqual(['era 2º', 'era 3º', 'era 1º', null])
    expect(boardLabels(order, 'mine')).toEqual(['→ 3º', '→ 1º', '→ 2º', null])
    expect(boardLabels([0, 1, 2], 'correct')).toEqual([null, null, null])
    expect(boardLabels([0, 1, 2], 'mine')).toEqual([null, null, null])
  })
  test('board order per view', () => {
    expect(boardOrderFor([2, 0, 1], 'correct')).toEqual([0, 1, 2])
    expect(boardOrderFor([2, 0, 1], 'mine')).toEqual([2, 0, 1])
  })
})

describe('song position → segment', () => {
  const segs = [
    { start: 1, end: 3 },
    { start: 3, end: 5 },
    { start: 5, end: 8 },
  ]
  test('inside, boundaries, outside', () => {
    expect(segmentAt(segs, 0.5)).toBe(-1)
    expect(segmentAt(segs, 1)).toBe(0)
    expect(segmentAt(segs, 2.99)).toBe(0)
    expect(segmentAt(segs, 3)).toBe(1)
    expect(segmentAt(segs, 7.9)).toBe(2)
    expect(segmentAt(segs, 8)).toBe(-1)
    expect(segmentAt(null, 2)).toBe(-1)
    expect(segmentAt(segs, Number.NaN)).toBe(-1)
  })
})

describe('board height keeps the play-screen shape', () => {
  test('fitGrid picks 3×2 / 4×2 / 4×3 / 4×4 at the height we give it', () => {
    const want: Record<number, number> = { 6: 3, 8: 4, 12: 4, 16: 4 }
    for (const width of [340, 360, 560, 700, 760, 900, 1100]) {
      for (const n of [6, 8, 12, 16]) {
        const h = boardHeightFor(n, width)
        const g = fitGrid(n, width, h)
        expect(`${n}@${width}:${g.cols}`).toBe(`${n}@${width}:${want[n]}`)
        expect(g.height).toBeLessThanOrEqual(h)
      }
    }
  })
})

describe('round stats', () => {
  test('"Più veloce" ignores timed-out and zero-point confirms', async () => {
    const { roundStats } = await import('../../src/screens/round/reveal/model')
    const row = (name: string, points: number, timeMs: number, timedOut = false) =>
      ({ player: { name }, result: { points, timeMs, timedOut } }) as unknown as Parameters<typeof roundStats>[0][number]
    const s = roundStats([row('Zero', 0, 2000), row('Late', 3000, 1000, true), row('Ok', 1500, 9000), row('Best', 2500, 7000)])!
    expect(s.fastest).toEqual({ name: 'Best', timeMs: 7000 })
    expect(roundStats([row('Zero', 0, 2000)])!.fastest).toBeNull()
    expect(roundStats([])).toBeNull()
  })
})
