// Boundary DP: even snippet lengths vs bar lines. Run: bun test tests/unit/analysis-cut.test.ts
import { describe, expect, test } from 'bun:test'
import { BEAT_WEIGHTS, chooseBoundaries } from '../../src/audio/analysis/cut'
import type { Candidate } from '../../src/audio/analysis/cut'

/** A bare 4/4 beat grid: bar lines 1, half bars 0.45, other beats −0.3. */
function grid(beats: number, bpm: number): Candidate[] {
  const p = 60 / bpm
  return Array.from({ length: beats }, (_, i) => ({
    time: i * p,
    metric: i % 4 === 0 ? 1 : i % 2 === 0 ? 0.45 : -0.3,
    novelty: 0,
    onset: 0.5,
    sustain: 0,
    vocal: 0,
    beat: i,
  }))
}

describe('chooseBoundaries', () => {
  test('61 beats into 8 snippets: an even plan on bar lines / half bars, no 2:1 mix', () => {
    const c = grid(61, 122)
    const sol = chooseBoundaries({ candidates: c, n: 8, start: 0, end: c[60].time, beatsPerBar: 4, barSec: (4 * 60) / 122, weights: BEAT_WEIGHTS })
    expect(sol).not.toBeNull()
    const beats = sol!.path.map((j) => c[j].beat)
    const lens = beats.slice(1).map((b, i) => b - beats[i])
    expect(Math.max(...lens) / Math.min(...lens)).toBeLessThanOrEqual(1.5)
    expect(sol!.ratio).toBeCloseTo(Math.max(...lens) / Math.min(...lens), 6)
    for (const b of beats) expect(b % 2).toBe(0)
  })

  test('balance off → the classic whole-bar DP (2:1 allowed)', () => {
    const c = grid(61, 122)
    const sol = chooseBoundaries({ candidates: c, n: 8, start: 0, end: c[60].time, beatsPerBar: 4, barSec: (4 * 60) / 122, weights: { ...BEAT_WEIGHTS, balance: 0 } })
    const beats = sol!.path.map((j) => c[j].beat)
    for (const b of beats) expect(b % 4).toBe(0)
  })

  test('a held note (vocal) at a bar line moves the cut', () => {
    const c = grid(64, 120)
    const plain = chooseBoundaries({ candidates: c, n: 8, start: 0, end: c[63].time, beatsPerBar: 4, barSec: 2, weights: BEAT_WEIGHTS })!
    const hit = plain.path[4]
    const c2 = c.map((k, j) => (j === hit ? { ...k, vocal: 1 } : k))
    const moved = chooseBoundaries({ candidates: c2, n: 8, start: 0, end: c[63].time, beatsPerBar: 4, barSec: 2, weights: BEAT_WEIGHTS })!
    expect(moved.path).not.toContain(hit)
  })

  test('infeasible → null, n = 1 works', () => {
    const c = grid(5, 120)
    expect(chooseBoundaries({ candidates: c, n: 8, start: 0, end: 2, beatsPerBar: 4, barSec: 2, weights: BEAT_WEIGHTS })).toBeNull()
    const one = chooseBoundaries({ candidates: grid(16, 120), n: 1, start: 0, end: 7.5, beatsPerBar: 4, barSec: 2, weights: BEAT_WEIGHTS })
    expect(one?.path.length).toBe(2)
  })
})
