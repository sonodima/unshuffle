// Invariants + synthetic ground truth for the analysis pipeline.
// Run: bun test tests/unit/analysis.test.ts
import { describe, expect, test } from 'bun:test'
import { analyzeSync, isValidPlan } from '../../src/audio/analysis/pipeline'
import type { CutPlan } from '../../src/audio/analysis/types'
import { analyzeAndCut } from '../../src/audio/analysis'
import { computePeaks } from '../../src/audio/peaks'
import { synthLoop } from '../support/synth'

function checkPlan(plan: CutPlan, n: number, duration: number): void {
  expect(plan.segments.length).toBe(n)
  for (let i = 0; i < n; i++) {
    const s = plan.segments[i]
    expect(Number.isFinite(s.start)).toBe(true)
    expect(s.end).toBeGreaterThan(s.start)
    expect(s.start).toBeGreaterThanOrEqual(0)
    expect(s.end).toBeLessThanOrEqual(duration)
    if (i < n - 1) expect(s.end).toBe(plan.segments[i + 1].start)
  }
  expect(isValidPlan(plan, n, duration)).toBe(true)
}

/** Minimal AudioBuffer stand-in for code that only reads samples. */
function fakeBuffer(channels: Float32Array[], sampleRate: number): AudioBuffer {
  const length = channels[0].length
  return {
    sampleRate,
    length,
    duration: length / sampleRate,
    numberOfChannels: channels.length,
    getChannelData: (c: number) => channels[c],
    copyFromChannel: () => undefined,
    copyToChannel: () => undefined,
  } as unknown as AudioBuffer
}

describe('synthetic loops (known tempo and bar phase)', () => {
  for (const bpm of [84, 100, 120, 128, 150, 172]) {
    test(`${bpm} BPM`, () => {
      const s = synthLoop({ bpm })
      const duration = s.samples.length / s.sampleRate
      for (const n of [6, 8, 12, 16]) {
        const { plan } = analyzeSync({ samples: s.samples, sampleRate: s.sampleRate, n })
        checkPlan(plan, n, duration)
        expect(plan.method).toBe('beat-grid')
        const ratio = plan.bpm / bpm
        expect(Math.min(Math.abs(ratio - 1), Math.abs(ratio - 2), Math.abs(ratio - 0.5))).toBeLessThan(0.02)
        // Cut on the true bar lines (cuts sit a few ms before the attack).
        const bounds = [...plan.segments.map((g) => g.start), plan.segments[n - 1].end]
        const onBar = bounds.filter((b) => s.downbeats.some((d) => d - b >= -0.01 && d - b <= 0.035)).length
        const halfBars = bounds.filter((b) =>
          s.downbeats.some((d) => Math.abs(d + 2 * s.beat - b - 0.012) <= 0.03 || Math.abs(d - b - 0.012) <= 0.03),
        ).length
        // Every cut on a bar line or a half bar; mostly bar lines when a bar is
        // shorter than the snippet target (an even plan may use 1½-bar snippets).
        const barSec = (4 * 60) / plan.bpm
        const target = duration / n
        if (barSec < target) expect(onBar / bounds.length).toBeGreaterThanOrEqual(0.6)
        expect(halfBars / bounds.length).toBeGreaterThanOrEqual(0.9)
      }
    }, 30000)
  }

  test('even snippets: no 2:1 mixes at 6–8 snippets', () => {
    // Chord stabs (nothing held across the half bar): a 30 s preview always
    // allows an even plan on bar lines / half bars at these counts. (A chord
    // held for the whole bar makes half-bar cuts chop it; then whole bars win.)
    for (const bpm of [84, 100, 120, 128, 150, 172]) {
      const s = synthLoop({ bpm, stabs: true })
      for (const n of [6, 8]) {
        const { plan } = analyzeSync({ samples: s.samples, sampleRate: s.sampleRate, n })
        const lens = plan.segments.map((g) => g.end - g.start)
        expect(Math.max(...lens) / Math.min(...lens)).toBeLessThan(1.56)
        const bounds = [...plan.segments.map((g) => g.start), plan.segments[n - 1].end]
        const onGrid = bounds.filter((b) => s.downbeats.some((d) => Math.abs(d - b - 0.012) <= 0.03 || Math.abs(d + 2 * s.beat - b - 0.012) <= 0.03)).length
        expect(onGrid / bounds.length).toBeGreaterThanOrEqual(0.85)
      }
    }
  }, 60000)

  test('deterministic', () => {
    const s = synthLoop({ bpm: 118 })
    const a = analyzeSync({ samples: s.samples, sampleRate: s.sampleRate, n: 8 }).plan
    const b = analyzeSync({ samples: s.samples, sampleRate: s.sampleRate, n: 8 }).plan
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  for (const sr of [22050, 32000, 48000, 96000]) {
    test(`sample rate ${sr}`, () => {
      const s = synthLoop({ bpm: 124, sampleRate: sr })
      const { plan } = analyzeSync({ samples: s.samples, sampleRate: sr, n: 8 })
      checkPlan(plan, 8, s.samples.length / sr)
      expect(Math.abs(plan.bpm / 124 - 1)).toBeLessThan(0.02)
    })
  }
})

describe('robustness', () => {
  const sr = 44100
  test('every n from 1 to 24 on music', () => {
    const s = synthLoop({ bpm: 110 })
    for (let n = 1; n <= 24; n++) checkPlan(analyzeSync({ samples: s.samples, sampleRate: sr, n }).plan, n, 30)
  }, 60000)
  test('silence → uniform', () => {
    const plan = analyzeSync({ samples: new Float32Array(sr * 30), sampleRate: sr, n: 8 }).plan
    checkPlan(plan, 8, 30)
    expect(plan.method).toBe('uniform')
  })
  test('white noise', () => {
    let seed = 7
    const x = new Float32Array(sr * 30).map(() => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5) * 0.5)
    checkPlan(analyzeSync({ samples: x, sampleRate: sr, n: 12 }).plan, 12, 30)
  })
  test('sustained drone (no onsets)', () => {
    const x = new Float32Array(sr * 30).map((_, i) => 0.3 * Math.sin((2 * Math.PI * 220 * i) / sr))
    checkPlan(analyzeSync({ samples: x, sampleRate: sr, n: 16 }).plan, 16, 30)
  })
  test('very short and empty inputs', () => {
    for (const len of [0, 1, 100, sr / 2, sr * 2]) {
      const plan = analyzeSync({ samples: new Float32Array(len).fill(0.1), sampleRate: sr, n: 6 }).plan
      expect(plan.segments.length).toBe(6)
      if (len >= 100) checkPlan(plan, 6, len / sr)
    }
  })
  test('NaN / Infinity samples do not throw', () => {
    const s = synthLoop({ bpm: 120 })
    s.samples[1000] = NaN
    s.samples[5000] = Infinity
    const plan = analyzeSync({ samples: s.samples, sampleRate: sr, n: 8 }).plan
    expect(plan.segments.length).toBe(8)
  })
  test('silent intro is trimmed', () => {
    const s = synthLoop({ bpm: 120 })
    s.samples.fill(0, 0, sr * 2)
    const plan = analyzeSync({ samples: s.samples, sampleRate: sr, n: 8 }).plan
    checkPlan(plan, 8, 30)
    expect(plan.segments[0].start).toBeGreaterThan(1.9)
  })
})

describe('public API', () => {
  test('analyzeAndCut resolves with a valid plan and caches per buffer', async () => {
    const s = synthLoop({ bpm: 126 })
    const buf = fakeBuffer([s.samples, s.samples], s.sampleRate)
    const a = await analyzeAndCut(buf, 8)
    checkPlan(a, 8, buf.duration)
    const b = await analyzeAndCut(buf, 8)
    expect(b).not.toBe(a)
    expect(JSON.stringify(b)).toBe(JSON.stringify(a))
  })
  test('analyzeAndCut never rejects on garbage', async () => {
    const plan = await analyzeAndCut(null as unknown as AudioBuffer, 8)
    expect(plan.segments.length).toBe(8)
    expect(plan.method).toBe('uniform')
  })
  test('computePeaks: normalised to the whole buffer, cached', () => {
    const x = new Float32Array(44100).map((_, i) => (i < 22050 ? 0.25 : 0.5) * Math.sin(i / 3))
    const buf = fakeBuffer([x], 44100)
    const quiet = computePeaks(buf, 0, 0.5, 32)
    const loud = computePeaks(buf, 0.5, 1, 32)
    expect(Math.max(...loud.max)).toBeCloseTo(1, 1)
    expect(Math.max(...quiet.max)).toBeCloseTo(0.5, 1)
    expect(computePeaks(buf, 0, 0.5, 32)).toBe(quiet)
    expect(computePeaks(buf, 0.9, 0.2, 8).max.length).toBe(8)
  })
})
