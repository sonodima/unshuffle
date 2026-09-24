// Experiment: beat-lag self-similarity S(L) of beat-synchronous chroma/timbre
// vectors, to see whether 3- and 5-beat bars are separable from 4/4 (bun).
// Usage: bun run scripts/fix-analysis/meter-probe.ts <corpusDir> [filter]
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readWav } from '../analysis/wav'
import { analyzeSync } from '../../src/audio/analysis/pipeline'
import { decimate } from '../../src/audio/analysis/dsp'
import { bandFlux, computeFeatures } from '../../src/audio/analysis/features'
import { normalizeOnset } from '../../src/audio/analysis/beats'
import { highpassOnset } from '../../src/audio/analysis/tempo'
import { beatFeatures } from '../../src/audio/analysis/structure'

const [dir, only] = process.argv.slice(2)
const corpus: { id: number; label: string }[] = JSON.parse(readFileSync(join(dir, 'corpus.json'), 'utf8'))
const cos = (a: Float32Array, b: Float32Array) => {
  let d = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  return na > 0 && nb > 0 ? d / Math.sqrt(na * nb) : 0
}
for (const t of corpus) {
  if (only && !t.label.toLowerCase().includes(only.toLowerCase())) continue
  const w = readWav(join(dir, `${t.id}.wav`))
  const L = w.channels[0], R = w.channels[1] ?? L
  const m = new Float32Array(L.length)
  for (let i = 0; i < L.length; i++) m[i] = (L[i] + R[i]) / 2
  const { plan } = analyzeSync({ samples: m, sampleRate: w.sampleRate, n: 8 })
  if (plan.method !== 'beat-grid') { console.log(t.label.slice(0, 30).padEnd(30), plan.method); continue }
  const xs = decimate(m, 2)
  const f = computeFeatures(xs, w.sampleRate / 2)
  const kick = normalizeOnset(highpassOnset(bandFlux(f, 30, 110), f.fps))
  const snare = normalizeOnset(highpassOnset(bandFlux(f, 180, 5000), f.fps))
  const beats = plan.beats.filter((b) => b >= plan.usableStart && b <= plan.usableEnd)
  const bf = beatFeatures(f, beats, { low: kick, high: snare })
  const v = bf.vectors
  const S: number[] = []
  for (let lag = 1; lag <= 12; lag++) {
    let s = 0, c = 0
    for (let i = 0; i + lag < v.length; i++) { s += cos(v[i], v[i + lag]); c++ }
    S.push(c ? s / c : 0)
  }
  // Meter score: multiples of P vs the rest (lags 2..12).
  const score = (P: number) => {
    const on: number[] = [], off: number[] = []
    for (let lag = 2; lag <= 12; lag++) (lag % P === 0 ? on : off).push(S[lag - 1])
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length
    return mean(on) - mean(off)
  }
  console.log(t.label.slice(0, 30).padEnd(30), plan.bpm.toFixed(0).padStart(4), 'S', S.map((x) => x.toFixed(2)).join(' '), '| m3', score(3).toFixed(3), 'm4', score(4).toFixed(3), 'm5', score(5).toFixed(3), 'm6', score(6).toFixed(3))
}
