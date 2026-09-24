// Free cuts (the Cleaver): off the beat, through held notes, lengths a little
// uneven, and still a valid plan the host can use.
// Run: bun test ./tests/unit/analysis-free.test.ts
import { describe, expect, test } from 'bun:test'
import { analyzeSync, isValidPlan } from '../../src/audio/analysis/pipeline'
import { analyzeAndCut } from '../../src/audio/analysis'
import type { CutPlan } from '../../src/audio/analysis/types'
import { synthLoop } from '../support/synth'

const SR = 44100

function bounds(plan: CutPlan): number[] {
  return [...plan.segments.map((g) => g.start), plan.segments[plan.segments.length - 1].end]
}

function nearest(times: readonly number[], t: number): number {
  return Math.min(...times.map((x) => Math.abs(x - t)))
}

/** A sung-like tone (vibrato, 3 harmonics) from t0 to t1, soft 30 ms edges. */
function tone(len: number, t0: number, t1: number, f0: number, gain = 0.25): Float32Array {
  const y = new Float32Array(len)
  const a = Math.round(t0 * SR)
  const b = Math.min(len, Math.round(t1 * SR))
  for (let i = a; i < b; i++) {
    const t = (i - a) / SR
    const env = Math.min(1, t / 0.03, (b - i) / SR / 0.03)
    const ph = 2 * Math.PI * f0 * t + 0.6 * Math.sin(2 * Math.PI * 5.5 * t)
    y[i] = gain * env * (Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.3 * Math.sin(3 * ph))
  }
  return y
}

function fakeBuffer(samples: Float32Array, sampleRate: number): AudioBuffer {
  return {
    sampleRate,
    length: samples.length,
    duration: samples.length / sampleRate,
    numberOfChannels: 1,
    getChannelData: () => samples,
    copyFromChannel: () => undefined,
    copyToChannel: () => undefined,
  } as unknown as AudioBuffer
}

describe('free cuts on synthetic loops', () => {
  for (const bpm of [92, 120, 150]) {
    test(`${bpm} BPM: off the beat, balanced, tempo still reported`, () => {
      const s = synthLoop({ bpm })
      const duration = s.samples.length / s.sampleRate
      const beats = s.downbeats.flatMap((d) => [0, 1, 2, 3].map((k) => d + k * s.beat))
      for (const n of [6, 8, 12, 16]) {
        const { plan } = analyzeSync({ samples: s.samples, sampleRate: s.sampleRate, n, style: 'free' })
        expect(isValidPlan(plan, n, duration)).toBe(true)
        expect(plan.method).toBe('free')
        expect(plan.downbeats).toEqual([])
        expect(plan.segments.every((g) => g.beats === 0)).toBe(true)
        const ratio = plan.bpm / bpm
        expect(Math.min(Math.abs(ratio - 1), Math.abs(ratio - 2), Math.abs(ratio - 0.5))).toBeLessThan(0.02)
        // No cut on (or a few ms before) a beat, where the Scalpel would put it.
        for (const b of bounds(plan)) expect(nearest(beats, b)).toBeGreaterThan(0.04)
        const lengths = plan.segments.map((g) => g.end - g.start)
        expect(Math.max(...lengths) / Math.min(...lengths)).toBeLessThan(1.8)
      }
    }, 30000)
  }

  test('deterministic, and different from the Scalpel', () => {
    const s = synthLoop({ bpm: 128 })
    const input = { samples: s.samples, sampleRate: s.sampleRate, n: 8 }
    const a = analyzeSync({ ...input, style: 'free' }).plan
    const b = analyzeSync({ ...input, style: 'free' }).plan
    expect(JSON.stringify(b)).toBe(JSON.stringify(a))
    const scalpel = analyzeSync(input).plan
    expect(scalpel.method).toBe('beat-grid')
    expect(JSON.stringify(bounds(scalpel))).not.toBe(JSON.stringify(bounds(a)))
  })
})

describe('held notes', () => {
  test('the cleaver cuts through them', () => {
    const s = synthLoop({ bpm: 120 })
    const len = s.samples.length
    const bar = s.downbeats
    // Notes held across every other bar line (bars 2, 4, 6, …): the Scalpel steers clear of them.
    const spans: [number, number][] = []
    const notes = new Float32Array(len)
    for (let k = 2; k < bar.length; k += 2) {
      spans.push([bar[k] - 0.7, bar[k] + 0.7])
      const t = tone(len, bar[k] - 0.7, bar[k] + 0.7, 262 + 20 * k, 0.22)
      for (let i = 0; i < len; i++) notes[i] += t[i]
    }
    const x = s.samples.map((v, i) => v + notes[i])
    const zeros = new Float32Array(len)
    for (const n of [6, 8]) {
      const inner = analyzeSync({ samples: x, side: zeros, sampleRate: SR, n, style: 'free' }).plan.segments.slice(1).map((g) => g.start)
      const inside = inner.filter((c) => spans.some(([a, b]) => c > a + 0.05 && c < b - 0.05)).length
      expect(inside).toBeGreaterThanOrEqual(Math.ceil(inner.length / 2))
    }
  }, 30000)
})

describe('public API', () => {
  test('analyzeAndCut caches per style', async () => {
    const s = synthLoop({ bpm: 126 })
    const buf = fakeBuffer(s.samples, s.sampleRate)
    const scalpel = await analyzeAndCut(buf, 8)
    const cleaver = await analyzeAndCut(buf, 8, 'free')
    expect(scalpel.method).toBe('beat-grid')
    expect(cleaver.method).toBe('free')
    expect(isValidPlan(cleaver, 8, buf.duration)).toBe(true)
    expect(JSON.stringify(await analyzeAndCut(buf, 8, 'free'))).toBe(JSON.stringify(cleaver))
    expect(JSON.stringify(await analyzeAndCut(buf, 8, 'beat'))).toBe(JSON.stringify(scalpel))
  })
})
