// Listening history (src/game/history.ts): fading play counts, digest and validation.
import { beforeEach, describe, expect, test } from 'bun:test'
import { MemoryStorage } from '../support/host-harness'
import {
  DIGEST_MAX_ENTRIES,
  HISTORY_HALF_LIFE_DAYS,
  localDigest,
  recordPlay,
  sanitizeDigest,
  toDigest,
  weightAt,
  withPlay,
  type History,
} from '../../src/game/history'

const DAY = 86_400_000
const T0 = 1_800_000_000_000

describe('history', () => {
  beforeEach(() => {
    ;(globalThis as { localStorage?: Storage }).localStorage = new MemoryStorage()
  })

  test('a play fades by half every half-life', () => {
    const e = { w: 1, t: T0 }
    expect(weightAt(e, T0)).toBe(1)
    expect(weightAt(e, T0 + HISTORY_HALF_LIFE_DAYS * DAY)).toBeCloseTo(0.5)
    expect(weightAt(e, T0 + 2 * HISTORY_HALF_LIFE_DAYS * DAY)).toBeCloseTo(0.25)
  })

  test('plays add up (faded); a replay within minutes is the same play', () => {
    let h: History = {}
    h = withPlay(h, 7, T0)
    expect(h['7']).toEqual({ w: 1, t: T0 })
    h = withPlay(h, 7, T0 + 60_000) // reload during the reveal
    expect(h['7']).toEqual({ w: 1, t: T0 })
    h = withPlay(h, 7, T0 + HISTORY_HALF_LIFE_DAYS * DAY)
    expect(h['7'].w).toBeCloseTo(1.5)
  })

  test('long-faded songs are forgotten', () => {
    const h = withPlay(withPlay({}, 1, T0), 2, T0 + 400 * DAY)
    expect(Object.keys(h)).toEqual(['2'])
  })

  test('digest: rounded, heaviest first, bounded', () => {
    let h: History = {}
    for (let i = 0; i < DIGEST_MAX_ENTRIES + 50; i++) h = withPlay(h, 1000 + i, T0 - i * 60 * 60_000)
    const d = toDigest(h, T0)
    expect(Object.keys(d)).toHaveLength(DIGEST_MAX_ENTRIES)
    expect(d['1000']).toBe(1)
    expect(Object.values(d).every((w) => Math.round(w * 100) === w * 100)).toBe(true)
  })

  test('sanitizeDigest drops junk from peers', () => {
    expect(sanitizeDigest(null)).toEqual({})
    expect(sanitizeDigest([1, 2])).toEqual({})
    expect(sanitizeDigest({ '12': 1.5, x: 1, '-3': 1, '4': 0, '5': 'a', '6': Infinity, '7': 1e6 })).toEqual({ '12': 1.5, '7': 100 })
  })

  test('recordPlay / localDigest persist in localStorage; broken storage is ignored', () => {
    recordPlay(42, T0)
    expect(localDigest(T0)).toEqual({ '42': 1 })
    localStorage.setItem('unshuffle:history', '{not json')
    expect(localDigest(T0)).toEqual({})
    recordPlay(43, T0)
    expect(localDigest(T0)).toEqual({ '43': 1 })
  })
})
