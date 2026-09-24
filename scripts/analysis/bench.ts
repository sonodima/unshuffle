// Headless benchmark of the analysis pipeline on cached previews (bun).
// Usage: bun run scripts/analysis/bench.ts [filter] [--verbose]
import { readWav } from './wav'
import { analyzeSync } from '../../src/audio/analysis/pipeline'
import { maxIn } from '../../src/audio/analysis/dsp'
import { slipAmount } from '../../src/audio/analysis/beats'

const resolved = JSON.parse(await Bun.file(import.meta.dir + '/cache/resolved.json').text())
const args = process.argv.slice(2)
const verbose = args.includes('--verbose')
const only = args.find((a) => !a.startsWith('--'))
const NS = [6, 8, 12, 16]

function bpmVerdict(bpm: number, ref: number, alt: number[] = []): string {
  if (!ref) return bpm ? '  n/a' : '  n/a'
  if (!bpm) return ' MISS'
  const ok = (r: number) => Math.abs(bpm / r - 1) < 0.04
  if (ok(ref)) return '   ok'
  if (alt.some(ok)) return '  alt'
  if ([2, 0.5, 1.5, 2 / 3].some((k) => ok(ref * k))) return ' OCT!'
  return ' BAD!'
}

const rows: string[] = []
let okCount = 0, altCount = 0, refCount = 0
for (const t of resolved) {
  if (only && !t.label.toLowerCase().includes(only.toLowerCase())) continue
  const w = readWav(`${import.meta.dir}/cache/${t.id}.wav`)
  const x = w.channels[0]
  const per: string[] = []
  let first: ReturnType<typeof analyzeSync> | null = null
  let ms = 0
  for (const n of NS) {
    const t0 = performance.now()
    const r = analyzeSync({ samples: x, sampleRate: w.sampleRate, n }, true)
    ms = performance.now() - t0
    if (!first) first = r
    const p = r.plan
    const d = r.debug!
    const db = new Set(p.downbeats.map((v) => v.toFixed(4)))
    const grid = d.gridBoundaries
    const onDown = grid.filter((g) => p.downbeats.some((v) => Math.abs(v - g) < 1e-6)).length / grid.length
    const med = d.onset.reduce((a, b) => a + b, 0) / d.onset.length || 1e-9
    const atCuts = grid.map((g) => maxIn(d.onset, (g - d.onsetShift) * d.fps - 2, (g - d.onsetShift) * d.fps + 2))
    const cutStrength = atCuts.reduce((a, b) => a + b, 0) / atCuts.length / med
    const lens = p.segments.map((s) => (p.method === 'beat-grid' ? s.beats.toString() : (s.end - s.start).toFixed(1)))
    per.push(`n${n}: ${(onDown * 100).toFixed(0).padStart(3)}%db x${cutStrength.toFixed(1)} [${lens.join(' ')}]`)
    void db
  }
  const p = first!.plan
  const d = first!.debug!
  const verdict = bpmVerdict(p.bpm, t.bpm, t.alt)
  if (t.bpm) { refCount++; if (verdict === '   ok') okCount++; if (verdict === '  alt') altCount++ }
  const bar = d.barPhase
  const slip = p.beats.length > 8 ? slipAmount(p.beats.filter((b) => b >= p.usableStart && b <= p.usableEnd)) : 0
  rows.push(`${t.label.slice(0, 34).padEnd(34)} ${String(t.bpm || '-').padStart(5)} ${p.bpm.toFixed(1).padStart(6)}${verdict} c${p.confidence.toFixed(2)} ${p.method.padEnd(9)} bar ${bar ? bar.confidence.toFixed(2) + '/' + bar.halfBarConfidence.toFixed(2) : '   -     '} slip ${slip.toFixed(2)} u[${p.usableStart.toFixed(2)},${p.usableEnd.toFixed(2)}] ${ms.toFixed(0)}ms`)
  if (verbose) {
    rows.push('    ' + d.tempoDecision + ' | bar ' + (bar ? bar.scores.map((v) => v.toFixed(2)).join(',') : '-') + ' | ' + JSON.stringify(Object.fromEntries(Object.entries(d.confidenceParts).map(([k, v]) => [k, +v.toFixed(2)]))) + ' | ' + JSON.stringify(Object.fromEntries(Object.entries(d.timings).map(([k, v]) => [k, +v.toFixed(1)]))))
    for (const s of per) rows.push('    ' + s)
  }
}
console.log(rows.join('\n'))
console.log(`\nBPM: ${okCount}/${refCount} exact, ${altCount} acceptable alt`)
