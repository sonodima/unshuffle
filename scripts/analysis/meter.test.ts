// Meter detection (3 / 4 / 5 beats per bar) and cuts on the real bar lines.
// Run: bun test scripts/analysis/meter.test.ts
import { describe, expect, test } from 'bun:test'
import { analyzeSync } from '../../src/audio/analysis/pipeline'
import { synthLoop } from './synth'

function spacingOf(beats: number[], downbeats: number[]): number {
  const idx = downbeats.map((d) => beats.findIndex((b) => Math.abs(b - d) < 1e-6)).filter((i) => i >= 0)
  return idx.length > 1 ? idx[1] - idx[0] : 0
}

describe('meter', () => {
  const cases: [number, number][] = [
    [3, 96],
    [3, 160],
    [5, 110],
    [5, 150],
    [5, 172],
    [4, 100],
    [4, 128],
  ]
  for (const [bpb, bpm] of cases) {
    test(`${bpb} beats per bar at ${bpm} BPM`, () => {
      const s = synthLoop({ bpm, beatsPerBar: bpb })
      for (const n of [6, 8]) {
        const r = analyzeSync({ samples: s.samples, sampleRate: s.sampleRate, n }, true)
        const p = r.plan
        expect(p.method).toBe('beat-grid')
        expect(spacingOf(p.beats, p.downbeats)).toBe(bpb)
        // Cuts sit a few ms before the real bar lines.
        const bounds = [...p.segments.map((g) => g.start), p.segments[n - 1].end]
        const onBar = bounds.filter((b) => s.downbeats.some((d) => d - b >= -0.01 && d - b <= 0.035)).length / bounds.length
        expect(onBar).toBeGreaterThanOrEqual(0.75)
        if (bpb !== 4) expect(r.debug!.confidenceParts[`meter${bpb}`]).toBeGreaterThan(r.debug!.confidenceParts.meter4 + 0.1)
      }
    }, 30000)
  }
})
