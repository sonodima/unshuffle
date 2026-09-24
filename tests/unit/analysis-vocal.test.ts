// Held centred notes (vocals) across a cut: the continuity feature and its use by the cutter.
// Run: bun test tests/unit/analysis-vocal.test.ts
import { describe, expect, test } from 'bun:test'
import { analyzeSync } from '../../src/audio/analysis/pipeline'
import { centreHarmonic, referenceDb, throughAt } from '../../src/audio/analysis/vocal'
import { synthLoop } from '../support/synth'

const SR = 44100

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

describe('centre harmonic continuity', () => {
  const s = synthLoop({ bpm: 120 })
  const len = s.samples.length
  const bar = s.downbeats
  // A note held across the 5th bar line; nothing sung around the 9th.
  const held = tone(len, bar[4] - 0.8, bar[4] + 0.9, 330)
  const mid = s.samples.map((v, i) => v + held[i])
  const zeros = new Float32Array(len)
  const down = (x: Float32Array) => {
    // Plain 2:1 decimation is enough for this test signal (< 4 kHz content matters).
    const y = new Float32Array(x.length >> 1)
    for (let i = 0; i < y.length; i++) y[i] = (x[2 * i] + x[2 * i + 1]) / 2
    return y
  }

  test('a centred held note reads as "through"; a free bar line does not', () => {
    const v = centreHarmonic(down(mid), down(zeros), SR / 2)
    const ref = referenceDb(v, 0.5, 29.5)
    expect(throughAt(v, ref, bar[4] - 0.012)).toBeGreaterThan(0.7)
    expect(throughAt(v, ref, bar[8] - 0.012)).toBeLessThan(0.3)
  })

  test('the same note hard-panned (wide / side) is ignored', () => {
    // Left-only note: mid = L / 2, side = L / 2.
    const side = held.map((v) => v / 2)
    const m2 = s.samples.map((v, i) => v + held[i] / 2)
    const v = centreHarmonic(down(m2), down(side), SR / 2)
    expect(throughAt(v, referenceDb(v, 0.5, 29.5), bar[4] - 0.012)).toBeLessThan(0.3)
    // Same mix analysed as mono (no side): the note counts again.
    const mono = centreHarmonic(down(m2), null, SR / 2)
    expect(throughAt(mono, referenceDb(mono, 0.5, 29.5), bar[4] - 0.012)).toBeGreaterThan(0.7)
  })

  test('the cutter avoids bar lines inside held notes', () => {
    // Notes held across every other bar line (bars 2, 4, 6, …).
    const notes = new Float32Array(len)
    for (let k = 2; k < bar.length; k += 2) {
      const t = tone(len, bar[k] - 0.7, bar[k] + 0.7, 262 + 20 * k, 0.22)
      for (let i = 0; i < len; i++) notes[i] += t[i]
    }
    const x = s.samples.map((v, i) => v + notes[i])
    for (const n of [6, 8]) {
      const p = analyzeSync({ samples: x, side: zeros, sampleRate: SR, n }).plan
      const inner = p.segments.slice(1).map((g) => g.start)
      const inside = inner.filter((c) => bar.some((b, k) => k >= 2 && k % 2 === 0 && Math.abs(b - c) < 0.05)).length
      expect(inside).toBeLessThanOrEqual(1)
    }
  }, 30000)
})

describe('chord changes are not "through"', () => {
  test('sustained pad changing chord exactly on the bar line', () => {
    const len = SR * 8
    const x = new Float32Array(len)
    // Pad: C major for 4 s, then D minor — no common tone (all centred, sustained).
    for (const [t0, t1, fs] of [
      [0, 4, [261.63, 329.63, 392]],
      [4, 8, [293.66, 349.23, 440]],
    ] as [number, number, number[]][]) {
      for (const f0 of fs) {
        const y = tone(len, t0, t1, f0, 0.15)
        for (let i = 0; i < len; i++) x[i] += y[i]
      }
    }
    const held = tone(len, 3, 5, 247, 0.45)
    const withNote = x.map((v, i) => v + held[i])
    const d = (a: Float32Array) => {
      const y = new Float32Array(a.length >> 1)
      for (let i = 0; i < y.length; i++) y[i] = (a[2 * i] + a[2 * i + 1]) / 2
      return y
    }
    const pad = centreHarmonic(d(x), null, SR / 2)
    expect(throughAt(pad, referenceDb(pad, 0.5, 7.5), 4 - 0.012)).toBeLessThan(0.3)
    expect(throughAt(pad, referenceDb(pad, 0.5, 7.5), 2 - 0.012)).toBeGreaterThan(0.7)
    // A (lead) note held across the change still counts.
    const v = centreHarmonic(d(withNote), null, SR / 2)
    expect(throughAt(v, referenceDb(v, 0.5, 7.5), 4 - 0.012)).toBeGreaterThan(0.5)
  })
})
