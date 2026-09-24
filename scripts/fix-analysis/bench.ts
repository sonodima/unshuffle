// Headless corpus bench for the cutting quality (bun). Corpus: stereo WAVs made by
// fetch-corpus.mjs. Usage:
//   bun run scripts/fix-analysis/bench.ts <corpusDir> <tag> [filter]
// Writes scripts/fix-analysis/out/<tag>.json and prints per-n summaries.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { readWav } from '../analysis/wav'
import { analyzeSync } from '../../src/audio/analysis/pipeline'
import { heldThrough, through, vocalProxy } from './vocalProxy'
import { BEAT_WEIGHTS, ONSET_WEIGHTS } from '../../src/audio/analysis/cut'

Object.assign(BEAT_WEIGHTS, JSON.parse(process.env.BW ?? '{}'))
Object.assign(ONSET_WEIGHTS, JSON.parse(process.env.OW ?? '{}'))

const [dir, tag = 'run', only] = process.argv.slice(2)
if (!dir) throw new Error('corpusDir?')
const NS = (process.env.NS ?? '6,8,12,16').split(',').map(Number)
const corpus: { id: number; label: string; bpm: number }[] = JSON.parse(readFileSync(join(dir, 'corpus.json'), 'utf8'))

interface Row {
  id: number
  label: string
  n: number
  method: string
  bpm: number
  ratio: number
  minLen: number
  maxLen: number
  lens: string
  onDown: number
  onBeat: number
  strong: number
  weak: number
  spacing: number
  through: number
  held: number
  heldBase: number
  of: number
  baseRate: number
  ms: number
  cuts: number[]
}
const rows: Row[] = []
const med = (a: number[]) => {
  const s = a.slice().sort((x, y) => x - y)
  return s.length ? s[s.length >> 1] : NaN
}
for (const t of corpus) {
  if (only && !t.label.toLowerCase().includes(only.toLowerCase())) continue
  const w = readWav(join(dir, `${t.id}.wav`))
  const L = w.channels[0]
  const R = w.channels[1] ?? L
  const mono = new Float32Array(L.length)
  const side = new Float32Array(L.length)
  for (let i = 0; i < L.length; i++) {
    mono[i] = (L[i] + R[i]) / 2
    side[i] = (L[i] - R[i]) / 2
  }
  const proxy = vocalProxy(L, R, w.sampleRate, join(dir, `${t.id}.vproxy`), true)
  for (const n of NS) {
    const t0 = performance.now()
    const input = { samples: mono, sampleRate: w.sampleRate, n, side: process.env.NOSIDE ? null : side }
    const r = analyzeSync(input, true)
    const ms = performance.now() - t0
    const p = r.plan
    const d = r.debug
    const lens = p.segments.map((s) => s.end - s.start)
    const grid = d?.gridBoundaries ?? []
    const beatSet = p.beats
    const onDown = grid.length ? grid.filter((g) => p.downbeats.some((v) => Math.abs(v - g) < 1e-6)).length / grid.length : 0
    const onBeat = grid.length ? grid.filter((g) => beatSet.some((v) => Math.abs(v - g) < 1e-6)).length / grid.length : 0
    // Metrical position of each grid boundary: bar line / half bar = strong, other beats = weak.
    const beatIdx = (g: number) => p.beats.findIndex((v) => Math.abs(v - g) < 1e-6)
    const downIdx = p.downbeats.map((d) => beatIdx(d)).filter((i) => i >= 0)
    const spacing = downIdx.length > 1 ? downIdx[1] - downIdx[0] : 4
    let strong = 0
    let weak = 0
    for (const g of grid) {
      const bi = beatIdx(g)
      if (bi < 0 || !downIdx.length) continue
      const k = ((((bi - downIdx[0]) % spacing) + spacing) % spacing)
      if (k === 0 || k === spacing / 2) strong++
      else weak++
    }
    const inner = p.segments.slice(1).map((s) => s.start)
    const thr = inner.filter((c) => through(proxy, c)).length
    const held = inner.filter((c) => heldThrough(proxy, c)).length
    const bb = p.beats.filter((b) => b > p.usableStart + 0.5 && b < p.usableEnd - 0.5)
    const baseRate = bb.length ? bb.filter((b) => through(proxy, b - 0.012)).length / bb.length : NaN
    const heldBase = bb.length ? bb.filter((b) => heldThrough(proxy, b - 0.012)).length / bb.length : NaN
    rows.push({
      id: t.id,
      label: t.label,
      n,
      method: p.method,
      bpm: p.bpm,
      ratio: Math.max(...lens) / Math.min(...lens),
      minLen: Math.min(...lens),
      maxLen: Math.max(...lens),
      lens: p.method === 'beat-grid' ? p.segments.map((s) => s.beats).join(',') : lens.map((v) => v.toFixed(2)).join(','),
      onDown,
      onBeat,
      spacing,
      strong: grid.length ? strong / grid.length : 0,
      weak: grid.length ? weak / grid.length : 0,
      through: thr,
      held,
      heldBase,
      of: inner.length,
      baseRate,
      ms,
      cuts: p.segments.map((s) => s.start).concat(p.segments[n - 1].end),
    })
  }
}
for (const r of rows) if (r.method === 'beat-grid' && r.spacing !== 4 && r.spacing !== 8) console.log('meter', r.spacing, r.label, 'n' + r.n, r.lens)
mkdirSync(join(import.meta.dir, 'out'), { recursive: true })
writeFileSync(join(import.meta.dir, 'out', `${tag}.json`), JSON.stringify(rows, null, 1))
for (const n of NS) {
  const rs = rows.filter((r) => r.n === n)
  const ratios = rs.map((r) => r.ratio)
  const thr = rs.reduce((a, r) => a + r.through, 0)
  const of = rs.reduce((a, r) => a + r.of, 0)
  const base = rs.filter((r) => Number.isFinite(r.baseRate))
  const held = rs.reduce((a, r) => a + r.held, 0)
  console.log(
    `n=${String(n).padStart(2)}  tracks ${rs.length}  ratio med ${med(ratios).toFixed(2)} p90 ${med(ratios.filter((v) => v >= med(ratios))).toFixed(2)} ≥1.9: ${ratios.filter((v) => v >= 1.9).length}  ≥1.6: ${ratios.filter((v) => v >= 1.6).length}` +
      `  onDown ${(100 * med(rs.map((r) => r.onDown))).toFixed(0)}% (mean ${(100 * rs.reduce((a, r) => a + r.onDown, 0) / rs.length).toFixed(0)}%)  strong ${(100 * rs.reduce((a, r) => a + r.strong, 0) / rs.length).toFixed(0)}% weak ${(100 * rs.reduce((a, r) => a + r.weak, 0) / rs.length).toFixed(1)}%` +
      `  through ${thr}/${of} = ${((100 * thr) / of).toFixed(0)}% (base ${((100 * base.reduce((a, r) => a + r.baseRate, 0)) / base.length).toFixed(0)}%)  held ${((100 * held) / of).toFixed(1)}% (base ${((100 * base.reduce((a, r) => a + r.heldBase, 0)) / base.length).toFixed(1)}%)  minLen ${Math.min(...rs.map((r) => r.minLen)).toFixed(2)}s  ms med ${med(rs.map((r) => r.ms)).toFixed(0)} max ${Math.max(...rs.map((r) => r.ms)).toFixed(0)}`,
  )
}
