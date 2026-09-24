// bun test scripts/board/waveLevels.test.ts
import { describe, expect, test } from 'bun:test'
import {
  LEVEL_FLOOR,
  aggregate,
  barHeights,
  levelRange,
  mapLevel,
  quantile,
  toDb,
  trackLevels,
} from '../../src/components/board/waveLevels'
import type { Peaks } from '../../src/audio/peaks'

const fakeBuffer = (duration: number) => ({ duration }) as unknown as AudioBuffer

/** A synthetic "track": per-5ms-bin RMS/peak following a loudness curve (linear, 0..1). */
function fakePeaksFn(level: (t: number) => number, crest = 2) {
  let calls = 0
  const fn = (buffer: AudioBuffer, start: number, end: number, bins: number): Peaks => {
    calls++
    const n = Math.max(1, Math.floor(bins))
    const rms = new Float32Array(n)
    const max = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const t = start + ((i + 0.5) * (end - start)) / n
      rms[i] = level(t)
      max[i] = Math.min(1, level(t) * crest)
    }
    return { rms, max }
  }
  return { fn, calls: () => calls }
}

describe('dB helpers', () => {
  test('toDb', () => {
    expect(toDb(1)).toBeCloseTo(0)
    expect(toDb(0.1)).toBeCloseTo(-20)
    expect(toDb(0)).toBe(-100)
    expect(toDb(-1)).toBe(-100)
  })
  test('quantile nearest rank', () => {
    const s = [1, 2, 3, 4, 5]
    expect(quantile(s, 0)).toBe(1)
    expect(quantile(s, 1)).toBe(5)
    expect(quantile(s, 0.5)).toBe(3)
    expect(quantile([], 0.5)).toBe(0)
  })
})

describe('levelRange', () => {
  test('percentiles of the dB values', () => {
    const vals = Array.from({ length: 1000 }, (_, i) => 10 ** (-(i % 100) / 5 / 20)) // 0..-19.8 dB, uniform
    const r = levelRange(vals)
    expect(r.hi).toBeGreaterThan(-0.5)
    expect(r.lo).toBeLessThan(-18)
    expect(r.lo).toBeGreaterThan(-20)
  })
  test('flat master gets a minimal span centred on its level', () => {
    const r = levelRange(new Array(500).fill(0.5))
    expect(r.hi - r.lo).toBeCloseTo(6)
    expect((r.hi + r.lo) / 2).toBeCloseTo(toDb(0.5), 3)
  })
  test('digital silence does not flatten everything', () => {
    const vals = [...new Array(300).fill(0), ...new Array(700).fill(0.5)]
    const r = levelRange(vals)
    expect(r.hi - r.lo).toBeLessThanOrEqual(36.0001)
  })
  test('all silent', () => {
    const r = levelRange(new Array(100).fill(0))
    expect(Number.isFinite(r.lo) && Number.isFinite(r.hi)).toBe(true)
    expect(mapLevel(0, r)).toBe(LEVEL_FLOOR)
  })
})

describe('mapLevel', () => {
  const r = { lo: -20, hi: -8 }
  test('monotonic, floored, capped', () => {
    let prev = 0
    for (let db = -40; db <= 0; db += 0.5) {
      const h = mapLevel(10 ** (db / 20), r)
      expect(h).toBeGreaterThanOrEqual(prev)
      expect(h).toBeGreaterThanOrEqual(LEVEL_FLOOR)
      expect(h).toBeLessThanOrEqual(1)
      prev = h
    }
    expect(mapLevel(10 ** (-8 / 20), r)).toBeCloseTo(1)
    expect(mapLevel(10 ** (-30 / 20), r)).toBe(LEVEL_FLOOR)
    expect(mapLevel(10 ** (-14 / 20), r)).toBeCloseTo(0.5 ** 1.6, 4)
  })
})

describe('aggregate', () => {
  test('RMS by mean square, peak by max', () => {
    const fine: Peaks = { rms: new Float32Array([0.1, 0.3, 0.2, 0.2, 0.5]), max: new Float32Array([0.2, 0.6, 0.3, 0.9, 1]) }
    const a = aggregate(fine, 2)
    expect(a.rms.length).toBe(2)
    expect(a.rms[0]).toBeCloseTo(Math.sqrt((0.01 + 0.09) / 2))
    expect(a.rms[1]).toBeCloseTo(0.2)
    expect(a.max[0]).toBeCloseTo(0.6)
    expect(a.max[1]).toBeCloseTo(0.9)
    const t = aggregate(fine, 1, 1, 4)
    expect([...t.rms].map((v) => +v.toFixed(2))).toEqual([0.3, 0.2, 0.2])
  })
})

describe('trackLevels', () => {
  // A compressed "pop master": loud (−9..−6 dB) everywhere, with a quieter break at 12–15 s.
  const level = (t: number) => 10 ** ((t > 12 && t < 15 ? -18 : -9 + 3 * Math.sin(t * 5)) / 20)
  test('one fine pass per buffer, cached per bin factor', () => {
    const { fn, calls } = fakePeaksFn(level)
    const buf = fakeBuffer(30)
    const a = trackLevels(buf, 0.064, fn)
    const b = trackLevels(buf, 0.065, fn)
    const c = trackLevels(buf, 0.2, fn)
    expect(a).not.toBeNull()
    expect(b).toBe(a!) // same factor → same object
    expect(c).not.toBe(a!)
    expect(calls()).toBe(1)
    expect(trackLevels(fakeBuffer(30), 0.064, fn)).not.toBe(a!) // other buffer → new pass
    expect(calls()).toBe(2)
  })
  test('range spans the track loudness, the break maps low and loud parts high', () => {
    const { fn } = fakePeaksFn(level)
    const buf = fakeBuffer(30)
    const lv = trackLevels(buf, 0.064, fn)!
    expect(lv.rms.hi).toBeGreaterThan(-6.5)
    expect(lv.rms.lo).toBeLessThan(-11)
    const block = (t0: number) => fn(buf, t0, t0 + 3.7, 58)
    const loud = barHeights(block(2), lv)
    const brk = barHeights(block(11.5), lv)
    const mean = (a: Float32Array) => a.reduce((s, v) => s + v, 0) / a.length
    expect(mean(loud.core)).toBeGreaterThan(mean(brk.core) + 0.15)
    // the loud block is not a flat full-height comb any more
    const tall = [...loud.core].filter((v) => v > 0.85).length / loud.core.length
    expect(tall).toBeLessThan(0.5)
    for (let i = 0; i < loud.core.length; i++) expect(loud.halo[i]).toBeGreaterThanOrEqual(loud.core[i])
  })
  test('unusable input', () => {
    const { fn } = fakePeaksFn(level)
    expect(trackLevels(fakeBuffer(0), 0.05, fn)).toBeNull()
    expect(trackLevels(fakeBuffer(30), 0, fn)).toBeNull()
  })
})
