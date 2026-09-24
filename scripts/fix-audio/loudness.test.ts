// bun test scripts/fix-audio/loudness.test.ts — BS.1770 loudness + normalisation trim (src/audio/engine.ts).
import { describe, expect, test } from 'bun:test'
import { TARGET_LUFS, loudnessGainDb, measureLoudness } from '../../src/audio/engine'
import type { PcmData } from '../../src/audio/engine'

function pcm(sampleRate: number, channels: Float32Array[]): PcmData {
  return { numberOfChannels: channels.length, sampleRate, length: channels[0].length, getChannelData: (c) => channels[c] }
}
function sine(sr: number, seconds: number, amp: number, hz = 997): Float32Array {
  const x = new Float32Array(Math.round(sr * seconds))
  for (let i = 0; i < x.length; i++) x[i] = amp * Math.sin((2 * Math.PI * hz * i) / sr)
  return x
}
const concat = (...xs: Float32Array[]) => {
  const out = new Float32Array(xs.reduce((a, x) => a + x.length, 0))
  let o = 0
  for (const x of xs) {
    out.set(x, o)
    o += x.length
  }
  return out
}

describe('measureLoudness (BS.1770-4)', () => {
  for (const sr of [44100, 48000]) {
    test(`${sr} Hz: 0 dBFS 997 Hz sine in one channel reads -3.01 LUFS`, async () => {
      const l = sine(sr, 5, 1)
      const r = new Float32Array(l.length)
      const m = await measureLoudness(pcm(sr, [l, r]))
      expect(Math.abs(m.lufs - -3.01)).toBeLessThan(0.05)
      expect(Math.abs(m.peakDb)).toBeLessThan(0.01)
    })
    test(`${sr} Hz: EBU 3341 case 1 — stereo 1 kHz at -23 dBFS reads -23.0`, async () => {
      const a = Math.pow(10, -23 / 20)
      const m = await measureLoudness(pcm(sr, [sine(sr, 20, a, 1000), sine(sr, 20, a, 1000)]))
      expect(Math.abs(m.lufs - -23)).toBeLessThan(0.1)
    })
  }
  test('mono counts as identical L/R (it plays on both speakers)', async () => {
    const a = Math.pow(10, -20 / 20)
    const mono = await measureLoudness(pcm(48000, [sine(48000, 5, a)]))
    const stereo = await measureLoudness(pcm(48000, [sine(48000, 5, a), sine(48000, 5, a)]))
    expect(Math.abs(mono.lufs - stereo.lufs)).toBeLessThan(0.01)
    expect(Math.abs(stereo.lufs - -20)).toBeLessThan(0.1)
  })
  test('EBU 3341 case 3/4 style gating: quiet passages and silence do not drag the reading down', async () => {
    const sr = 48000
    const loud = sine(sr, 10, Math.pow(10, -20 / 20), 1000)
    const quiet = sine(sr, 10, Math.pow(10, -40 / 20), 1000)
    const silent = new Float32Array(sr * 10)
    const a = concat(loud, quiet, silent)
    const m = await measureLoudness(pcm(sr, [a, a]))
    expect(Math.abs(m.lufs - -20)).toBeLessThan(0.1)
  })
  test('silence and too-short buffers: -Infinity, no trim', async () => {
    const z = await measureLoudness(pcm(48000, [new Float32Array(48000 * 3), new Float32Array(48000 * 3)]))
    expect(z.lufs).toBe(-Infinity)
    expect(z.gainDb).toBe(0)
    const short = await measureLoudness(pcm(48000, [sine(48000, 0.3, 0.5)]))
    expect(short.lufs).toBe(-Infinity)
    expect(short.gainDb).toBe(0)
  })
  test('slicing (yield after every block) gives the same result', async () => {
    const sr = 44100
    const l = sine(sr, 8, 0.3, 440)
    const r = sine(sr, 8, 0.2, 3000)
    const a = await measureLoudness(pcm(sr, [l, r]), 1e9)
    const b = await measureLoudness(pcm(sr, [l, r]), 0)
    expect(b.lufs).toBeCloseTo(a.lufs, 9)
    expect(b.peakDb).toBeCloseTo(a.peakDb, 9)
  })
  test('K-weighting: 100 Hz reads lower and 4 kHz higher than 1 kHz at the same level', async () => {
    const sr = 48000
    const at = async (hz: number) => (await measureLoudness(pcm(sr, [sine(sr, 5, 0.1, hz), sine(sr, 5, 0.1, hz)]))).lufs
    const k1 = await at(1000)
    expect(await at(100)).toBeLessThan(k1 - 0.3)
    expect(await at(4000)).toBeGreaterThan(k1 + 2)
  })
  test('a 30 s stereo preview is measured in well under 100 ms of CPU', async () => {
    const sr = 44100
    const l = sine(sr, 30, 0.5, 220)
    const r = sine(sr, 30, 0.5, 330)
    const t0 = performance.now()
    await measureLoudness(pcm(sr, [l, r]), 1e9)
    expect(performance.now() - t0).toBeLessThan(100)
  })
})

describe('loudnessGainDb', () => {
  test('target is streaming level', () => expect(TARGET_LUFS).toBe(-14))
  test('loud masters are turned down to the target', () => {
    expect(loudnessGainDb(-5.5, 0.9)).toBeCloseTo(-8.5, 5) // Annalisa
    expect(loudnessGainDb(-9.1, 0.5)).toBeCloseTo(-4.9, 5) // Mahmood
  })
  test('quiet masters are boosted only up to -1 dBFS peak', () => {
    expect(loudnessGainDb(-15.4, -2.7)).toBeCloseTo(1.4, 5) // Pausini: full boost fits
    expect(loudnessGainDb(-15, -1.7)).toBeCloseTo(0.7, 5) // Vasco: capped by the peak
    expect(loudnessGainDb(-24, -5.6)).toBeCloseTo(4.6, 5) // Miles Davis: capped
    expect(loudnessGainDb(-19.2, -0.6)).toBe(0) // Eagles live: no headroom → untouched, never cut
    expect(loudnessGainDb(-15.4, 0)).toBe(0) // Bad Bunny
  })
  test('clamped to [-12, +6] dB', () => {
    expect(loudnessGainDb(-40, -30)).toBe(6)
    expect(loudnessGainDb(3, 0)).toBe(-12)
  })
  test('unmeasurable → 0', () => {
    expect(loudnessGainDb(-Infinity, -Infinity)).toBe(0)
    expect(loudnessGainDb(NaN, 0)).toBe(0)
  })
})
