// realignSegments / alignCuts: host cut plans re-aligned to a peer's own decode
// (WebKit decodes Deezer MP3s 529 samples earlier than Chrome). Run: bun test scripts/analysis/realign.test.ts
import { describe, expect, test } from 'bun:test'
import { analyzeSync } from '../../src/audio/analysis/pipeline'
import { alignCuts, realignSegments } from '../../src/audio/analysis'
import { snapToAttack } from '../../src/audio/analysis/snap'
import { synthLoop } from './synth'

function fakeBuffer(x: Float32Array, sampleRate: number): AudioBuffer {
  return { sampleRate, length: x.length, duration: x.length / sampleRate, numberOfChannels: 1, getChannelData: () => x } as unknown as AudioBuffer
}
/** y[i] = x[i - d]: the same music d samples later (d < 0: earlier). */
function delay(x: Float32Array, d: number): Float32Array {
  const y = new Float32Array(x.length)
  for (let i = 0; i < x.length; i++) {
    const j = i - d
    y[i] = j >= 0 && j < x.length ? x[j] : 0
  }
  return y
}
const segmentsOf = (x: Float32Array, sr: number, n: number) =>
  analyzeSync({ samples: x, sampleRate: sr, n }).plan.segments.map((s, index) => ({ index, ...s }))

describe('realignSegments', () => {
  const s = synthLoop({ bpm: 124 })
  const sr = s.sampleRate
  const host = s.samples

  test('no-op on the decode the plan was made on (same array back)', () => {
    for (const n of [6, 8, 16]) {
      const segs = segmentsOf(host, sr, n)
      expect(realignSegments(fakeBuffer(host, sr), segs)).toBe(segs)
    }
  })

  for (const d of [-529, 529, -576, -1105]) {
    test(`decoder offset of ${d} samples is detected and undone`, () => {
      const local = delay(host, d)
      for (const n of [8, 12, 16]) {
        const segs = segmentsOf(host, sr, n)
        const out = realignSegments(fakeBuffer(local, sr), segs)
        expect(out).not.toBe(segs)
        expect(out.length).toBe(n)
        for (let i = 0; i < n; i++) {
          expect(out[i].index).toBe(i)
          expect(out[i].beats).toBe(segs[i].beats)
          if (i < n - 1) expect(out[i].end).toBe(out[i + 1].start)
          // Every boundary moves by the decoder offset (±1.5 ms of block noise).
          expect(Math.abs(out[i].start - segs[i].start - d / sr)).toBeLessThan(0.0016)
        }
        // On the local decode, each internal cut again sits just before its attack.
        for (let i = 1; i < n; i++) {
          const a = snapToAttack(local, sr, out[i].start + 0.015)
          if (a.strengthDb >= 3) expect(a.attack - out[i].start).toBeGreaterThan(0)
        }
      }
    })
  }

  test('alignCuts reports the offset', () => {
    const segs = segmentsOf(host, sr, 8)
    const cuts = segs.map((g) => g.start).concat(segs[7].end)
    const a = alignCuts(delay(host, -529), sr, cuts)
    expect(a.changed).toBe(true)
    expect(Math.abs(a.offset * sr + 529)).toBeLessThan(45)
    expect(a.agree).toBeGreaterThanOrEqual(5)
    const same = alignCuts(host, sr, cuts)
    expect(same.changed).toBe(false)
    expect(same.cuts).toEqual(cuts)
  })

  test('unsnapped cuts (uniform fallback) on noise stay put', () => {
    let seed = 99
    const noise = new Float32Array(sr * 30).map(() => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5) * 0.4)
    const segs = Array.from({ length: 8 }, (_, i) => ({ index: i, start: (30 * i) / 8, end: (30 * (i + 1)) / 8, beats: 0 }))
    expect(realignSegments(fakeBuffer(noise, sr), segs)).toBe(segs)
  })

  test('garbage in → input back, never throws', () => {
    const segs = segmentsOf(host, sr, 8)
    expect(realignSegments(null, segs)).toBe(segs)
    expect(realignSegments(fakeBuffer(new Float32Array(0), sr), segs)).toBe(segs)
    const gap = segs.map((g, i) => (i === 3 ? { ...g, start: g.start + 0.01 } : g))
    expect(realignSegments(fakeBuffer(delay(host, -529), sr), gap)).toBe(gap)
    const broken = { getChannelData: () => { throw new Error('detached') }, sampleRate: sr, length: 10, numberOfChannels: 1 } as unknown as AudioBuffer
    expect(realignSegments(broken, segs)).toBe(segs)
  })

  test('memoised per input array', () => {
    const segs = segmentsOf(host, sr, 8)
    const buf = fakeBuffer(delay(host, -529), sr)
    const a = realignSegments(buf, segs)
    expect(realignSegments(buf, segs)).toBe(a)
    const t0 = performance.now()
    realignSegments(buf, segs.map((g) => ({ ...g })))
    expect(performance.now() - t0).toBeLessThan(20)
  })
})
