// Decoder-offset simulation on the corpus (bun). The afconvert (CoreAudio) decode
// plays the WebKit guest; the same samples delayed by 529 samples play the Chrome
// host (QA measured WebKit = Chrome − 529 samples, corr 1.000, same length).
// Usage: bun run scripts/fix-analysis/realign-bench.ts <corpusDir> [delaySamples=529] [filter]
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readWav } from '../analysis/wav'
import { analyzeSync } from '../../src/audio/analysis/pipeline'
import { alignCuts } from '../../src/audio/analysis/realign'

const [dir, delayArg = '529', only] = process.argv.slice(2)
const D = Number(delayArg)
const corpus: { id: number; label: string }[] = JSON.parse(readFileSync(join(dir, 'corpus.json'), 'utf8'))
const shift = (x: Float32Array, d: number): Float32Array => {
  // y[i] = x[i - d] (content later by d samples); d < 0 → earlier.
  const y = new Float32Array(x.length)
  for (let i = 0; i < x.length; i++) {
    const j = i - d
    y[i] = j >= 0 && j < x.length ? x[j] : 0
  }
  return y
}
const tailDb = (x: Float32Array, sr: number, c: number): number => {
  const i = Math.round(c * sr)
  const rms = (a: number, b: number) => {
    let s = 0
    for (let k = Math.max(0, a); k < b; k++) s += x[k] * x[k]
    return Math.sqrt(s / Math.max(1, b - a))
  }
  const tail = rms(i - Math.round(0.008 * sr), i)
  const before = rms(i - Math.round(0.04 * sr), i - Math.round(0.008 * sr))
  return 20 * Math.log10((tail + 1e-9) / (before + 1e-9))
}
const pct = (a: number[], q: number) => {
  const s = a.slice().sort((x, y) => x - y)
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]
}
const stats = { idChanged: 0, plans: 0, offsets: [] as number[], unchangedGuest: 0, maxIdMs: 0 }
const pre = { host: [] as number[], raw: [] as number[], aligned: [] as number[] }
const tails = { host: [] as number[], raw: [] as number[], aligned: [] as number[] }
let ms = 0
for (const t of corpus) {
  if (only && !t.label.toLowerCase().includes(only.toLowerCase())) continue
  const w = readWav(join(dir, `${t.id}.wav`))
  const L = w.channels[0]
  const R = w.channels[1] ?? L
  const sr = w.sampleRate
  const guest = new Float32Array(L.length)
  for (let i = 0; i < L.length; i++) guest[i] = (L[i] + R[i]) / 2
  const host = shift(guest, D)
  for (const n of [8, 16]) {
    const r = analyzeSync({ samples: host, sampleRate: sr, n }, true)
    const cuts = r.plan.segments.map((s) => s.start).concat(r.plan.segments[n - 1].end)
    stats.plans++
    const id = alignCuts(host, sr, cuts)
    if (id.changed) {
      stats.idChanged++
      stats.maxIdMs = Math.max(stats.maxIdMs, Math.abs(id.offset) * 1000)
      console.log('IDENTITY CHANGED', t.label, n, (id.offset * 1000).toFixed(2), `${id.agree}/${id.strong}`)
    }
    const t0 = performance.now()
    const g = alignCuts(guest, sr, cuts)
    ms = Math.max(ms, performance.now() - t0)
    if (!g.changed) stats.unchangedGuest++
    else stats.offsets.push(g.offset * 1000)
    if (r.plan.method !== 'beat-grid') continue
    const att = r.debug!.attacks
    for (let i = 1; i < n; i++) {
      // Host attack (host clock) → guest clock: − D / sr.
      const aGuest = att[i] - D / sr
      pre.host.push((att[i] - cuts[i]) * 1000)
      pre.raw.push((aGuest - cuts[i]) * 1000)
      pre.aligned.push((aGuest - g.cuts[i]) * 1000)
      tails.host.push(tailDb(host, sr, cuts[i]))
      tails.raw.push(tailDb(guest, sr, cuts[i]))
      tails.aligned.push(tailDb(guest, sr, g.cuts[i]))
    }
  }
}
console.log(`delay ${D} samples: plans ${stats.plans}; identity changed ${stats.idChanged} (max ${stats.maxIdMs.toFixed(2)} ms); guest unchanged ${stats.unchangedGuest}`)
if (stats.offsets.length)
  console.log(`guest offsets ms: min ${Math.min(...stats.offsets).toFixed(2)} med ${pct(stats.offsets, 0.5).toFixed(2)} max ${Math.max(...stats.offsets).toFixed(2)} (expected ${(-D / 44.1).toFixed(2)})`)
for (const k of ['host', 'raw', 'aligned'] as const) {
  const p = pre[k]
  const tl = tails[k]
  console.log(
    `${k.padEnd(8)} preroll ms: <0 ${p.filter((v) => v < 0).length}  <4 ${p.filter((v) => v < 4).length}  median ${pct(p, 0.5).toFixed(1)}  of ${p.length} | tail dB p90 ${pct(tl, 0.9).toFixed(1)}  >6dB ${tl.filter((v) => v > 6).length}  >10dB ${tl.filter((v) => v > 10).length}`,
  )
}
console.log(`alignCuts worst time ${ms.toFixed(2)} ms`)
