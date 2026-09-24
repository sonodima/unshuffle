// Analysis lab: fetches real Deezer previews, runs analyzeAndCut (worker path)
// for several snippet counts and draws a visual report (waveform, onset and
// kick envelopes, beats, downbeats, structural novelty, cut lines). Results
// are exposed on window.__analysis for the Playwright harness.
//
// URL params: ?set=all (default) | ?q=query1|query2 | ?ids=123,456
//             &n=6,8,12,16  &sr=44100  &only=substring

import { analyzeAndCut, sideOf } from '../../audio/analysis'
import type { CutPlan } from '../../audio/analysis'
import { analyzeSync } from '../../audio/analysis/pipeline'
import type { AnalysisDebug } from '../../audio/analysis/pipeline'
import { computePeaks, getMono } from '../../audio/peaks'
import { findTrack } from './deezer'
import type { DzTrack } from './deezer'
import { LAB_TRACKS } from './tracks'
import type { LabTrack } from './tracks'

interface CutStats {
  n: number
  plan: CutPlan
  workerMs: number
  lengths: number[]
  downbeatPct: number
  beatPct: number
  cutStrength: number
  deterministic: boolean
}

interface TrackResult {
  label: string
  query: string
  refBpm: number
  alt: number[]
  id?: number
  title?: string
  artist?: string
  error?: string
  decodeMs?: number
  duration?: number
  sampleRate?: number
  bpm?: number
  confidence?: number
  method?: string
  verdict?: string
  tempoDecision?: string
  barConfidence?: number
  /** Per-stage main-thread timings (ms) of one synchronous run (n = first count). */
  stageMs?: Record<string, number>
  syncMs?: number[]
  cuts: CutStats[]
}

interface LabState {
  done: boolean
  results: TrackResult[]
}

declare global {
  interface Window {
    __analysis: LabState
  }
}

const params = new URLSearchParams(location.search)
const COUNTS = (params.get('n') ?? '6,8,12,16')
  .split(',')
  .map((v) => parseInt(v, 10))
  .filter((v) => v > 0)
const SAMPLE_RATE = parseInt(params.get('sr') ?? '44100', 10)
const only = params.get('only')?.toLowerCase()

function selectedTracks(): LabTrack[] {
  const q = params.get('q')
  if (q) return q.split('|').map((s) => ({ q: s.trim(), artist: '', bpm: 0, label: s.trim() }))
  const ids = params.get('ids')
  if (ids) return ids.split(',').map((s) => ({ q: s.trim(), artist: '', bpm: 0, label: `#${s.trim()}` }))
  return LAB_TRACKS.filter((t) => !only || t.label.toLowerCase().includes(only))
}

function verdict(bpm: number, ref: number, alt: number[]): string {
  if (!ref) return 'n/d'
  if (!bpm) return 'mancato'
  const ok = (r: number): boolean => Math.abs(bpm / r - 1) < 0.04
  if (ok(ref)) return 'ok'
  if (alt.some(ok)) return 'alt'
  if ([2, 0.5, 1.5, 2 / 3].some((k) => ok(ref * k))) return 'ottava'
  return 'errato'
}

// ---------------------------------------------------------------------------
// Styles

const css = `
:root { color-scheme: dark; --bg:#07050f; --panel:#120d22; --line:#2a2244; --text:#ece8ff; --dim:#8f86b3;
  --violet:#7b5cff; --magenta:#ff3fd1; --cyan:#2ee6ff; --lime:#a6ff3f; --gold:#ffd23f; --coral:#ff5470; }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--text); font:14px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
header { padding:28px 32px 8px; }
h1 { margin:0; font-size:22px; letter-spacing:.02em; }
header p { margin:6px 0 0; color:var(--dim); }
#summary { margin:16px 32px; overflow-x:auto; }
table { border-collapse:collapse; width:100%; font:12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }
th, td { text-align:left; padding:6px 10px; border-bottom:1px solid var(--line); white-space:nowrap; }
th { color:var(--dim); font-weight:600; position:sticky; top:0; background:var(--bg); }
.chip { display:inline-block; padding:1px 8px; border-radius:999px; font-weight:700; font-size:11px; }
.ok { background:#a6ff3f22; color:var(--lime); } .alt { background:#2ee6ff22; color:var(--cyan); }
.bad { background:#ff547022; color:var(--coral); } .na { background:#ffffff14; color:var(--dim); }
#cards { display:grid; gap:18px; padding:8px 32px 48px; }
.card { background:var(--panel); border:1px solid var(--line); border-radius:16px; padding:16px 18px 14px; }
.card h2 { margin:0; font-size:16px; }
.meta { display:flex; flex-wrap:wrap; gap:6px 16px; margin:6px 0 10px; color:var(--dim); font:12px/1.4 ui-monospace, Menlo, monospace; }
.meta b { color:var(--text); font-weight:600; }
canvas { display:block; width:100%; border-radius:10px; background:#0b0818; cursor:pointer; }
.actions { display:flex; gap:8px; margin-top:10px; flex-wrap:wrap; }
button { background:#1d1636; color:var(--text); border:1px solid var(--line); border-radius:999px; padding:6px 14px; font:600 12px system-ui; cursor:pointer; }
button:hover { border-color:var(--violet); }
.err { color:var(--coral); }
@media (max-width: 700px) { header, #summary, #cards { padding-left:14px; padding-right:14px; margin-left:0; margin-right:0; } }
`

// ---------------------------------------------------------------------------
// Rendering

const COLORS = { wave: '#8b7dff', waveRms: '#c9bfff', onset: '#ff3fd1', kick: '#2ee6ff', beat: '#ffffff22', down: '#ffd23f', cut: '#a6ff3f', dim: '#07050fcc' }
const ROW_H = 22

function segHue(i: number): number {
  return (i * 137.508) % 360
}

function drawReport(canvas: HTMLCanvasElement, buffer: AudioBuffer, cuts: CutStats[], dbg: AnalysisDebug, highlight: number): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const cssW = canvas.clientWidth || 1200
  const waveH = 110
  const envH = 64
  const novH = 18
  const rowsH = cuts.length * (ROW_H + 6)
  const cssH = 18 + waveH + 8 + envH + 6 + novH + 10 + rowsH
  canvas.width = Math.round(cssW * dpr)
  canvas.height = Math.round(cssH * dpr)
  canvas.style.height = `${cssH}px`
  const g = canvas.getContext('2d')
  if (!g) return
  g.scale(dpr, dpr)
  const dur = buffer.duration
  // Left gutter for the n-labels of the segment rows.
  const padX = 34
  const W = cssW - padX - 8
  const x = (t: number): number => padX + (t / dur) * W
  const plan = cuts.find((c) => c.n === highlight)?.plan ?? cuts[0].plan

  // Waveform (peaks normalised to the whole buffer).
  const top = 18
  const mid = top + waveH / 2
  const bins = Math.max(64, Math.floor(W))
  const pk = computePeaks(buffer, 0, dur, bins)
  for (let i = 0; i < bins; i++) {
    const px = padX + (i / bins) * W
    const a = pk.max[i] * (waveH / 2 - 2)
    const r = pk.rms[i] * (waveH / 2 - 2)
    g.fillStyle = COLORS.wave
    g.fillRect(px, mid - a, Math.max(1, W / bins), a * 2)
    g.fillStyle = COLORS.waveRms
    g.fillRect(px, mid - r, Math.max(1, W / bins), r * 2)
  }

  // Envelopes.
  const envTop = top + waveH + 8
  const drawEnv = (env: Float32Array, color: string, scale: number): void => {
    let mx = 0
    for (let i = 0; i < env.length; i++) if (env[i] > mx) mx = env[i]
    mx = Math.max(1e-9, mx * scale)
    g.strokeStyle = color
    g.lineWidth = 1
    g.beginPath()
    for (let i = 0; i < env.length; i++) {
      const t = i / dbg.fps + dbg.onsetShift
      const y = envTop + envH - Math.min(1, env[i] / mx) * (envH - 2)
      if (i === 0) g.moveTo(x(t), y)
      else g.lineTo(x(t), y)
    }
    g.stroke()
  }
  g.globalAlpha = 0.75
  drawEnv(dbg.low, COLORS.kick, 0.8)
  g.globalAlpha = 1
  drawEnv(dbg.onset, COLORS.onset, 0.8)

  // Beats, downbeats, bar numbers.
  const gridBottom = envTop + envH
  g.lineWidth = 1
  for (const b of plan.beats) {
    g.strokeStyle = COLORS.beat
    g.beginPath()
    g.moveTo(x(b), top)
    g.lineTo(x(b), gridBottom)
    g.stroke()
  }
  g.font = '600 10px ui-monospace, Menlo, monospace'
  g.textBaseline = 'top'
  plan.downbeats.forEach((d, i) => {
    g.strokeStyle = COLORS.down
    g.globalAlpha = 0.55
    g.beginPath()
    g.moveTo(x(d), top)
    g.lineTo(x(d), gridBottom)
    g.stroke()
    g.globalAlpha = 1
    g.fillStyle = COLORS.down
    g.fillText(String(i + 1), x(d) + 2, 3)
  })

  // Novelty per beat.
  const novTop = gridBottom + 6
  const bw = Math.max(2, (W / Math.max(1, plan.beats.length)) * 0.6)
  dbg.novelty.forEach((v, i) => {
    const b = plan.beats[i]
    if (b === undefined) return
    g.fillStyle = `rgba(255,210,63,${0.25 + 0.75 * v})`
    g.fillRect(x(b) - bw / 2, novTop + novH * (1 - v), bw, novH * v)
  })

  // Unusable edges.
  g.fillStyle = COLORS.dim
  g.fillRect(padX, top, x(plan.usableStart) - padX, gridBottom - top)
  g.fillRect(x(plan.usableEnd), top, padX + W - x(plan.usableEnd), gridBottom - top)

  // Segment rows (one per n).
  let rowTop = novTop + novH + 10
  g.textBaseline = 'middle'
  for (const c of cuts) {
    c.plan.segments.forEach((s, i) => {
      const x0 = x(s.start)
      const x1 = x(s.end)
      g.fillStyle = `hsl(${segHue(i)} 80% 58% / ${c.n === highlight ? 0.95 : 0.6})`
      g.beginPath()
      g.roundRect(x0 + 1, rowTop, Math.max(1, x1 - x0 - 2), ROW_H, 5)
      g.fill()
      g.fillStyle = '#07050f'
      const label = c.plan.method === 'beat-grid' ? String(s.beats) : (s.end - s.start).toFixed(1)
      if (x1 - x0 > 16) g.fillText(label, x0 + 5, rowTop + ROW_H / 2 + 1)
    })
    g.fillStyle = '#ece8ff'
    g.fillText(`n${c.n}`, 4, rowTop + ROW_H / 2 + 1)
    rowTop += ROW_H + 6
  }

  // Cut lines of the highlighted plan across the whole report.
  g.strokeStyle = COLORS.cut
  g.lineWidth = 1.5
  const bounds = [...plan.segments.map((s) => s.start), plan.segments[plan.segments.length - 1].end]
  for (const b of bounds) {
    g.beginPath()
    g.moveTo(x(b), top)
    g.lineTo(x(b), gridBottom + novH + 6)
    g.stroke()
  }
}

// ---------------------------------------------------------------------------
// Playback (click a segment to hear it; "ordine giusto" plays them gapless)

let ctx: AudioContext | null = null
let playing: AudioBufferSourceNode[] = []
function audio(): AudioContext {
  ctx ??= new AudioContext()
  void ctx.resume()
  return ctx
}
function stopAll(): void {
  for (const s of playing) {
    try {
      s.stop()
    } catch {
      // not started
    }
  }
  playing = []
}
function playSegments(buffer: AudioBuffer, segs: { start: number; end: number }[]): void {
  stopAll()
  const ac = audio()
  let when = ac.currentTime + 0.05
  for (const s of segs) {
    const src = ac.createBufferSource()
    src.buffer = buffer
    src.connect(ac.destination)
    src.start(when, s.start, s.end - s.start)
    when += s.end - s.start
    playing.push(src)
  }
}

// ---------------------------------------------------------------------------

function stats(plan: CutPlan, n: number, workerMs: number, dbg: AnalysisDebug, sync: CutPlan): CutStats {
  const bounds = [...plan.segments.map((s) => s.start), plan.segments[plan.segments.length - 1].end]
  // A boundary "is on" a grid point when it sits up to 90 ms before it (the
  // cut is snapped before the attack) or 30 ms after.
  const near = (b: number, list: number[]): boolean => list.some((d) => d - b >= -0.03 && d - b <= 0.09)
  const mean = dbg.onset.reduce((a, v) => a + v, 0) / Math.max(1, dbg.onset.length) || 1e-9
  const strength =
    bounds.reduce((acc, b) => {
      const f0 = Math.floor((b - dbg.onsetShift) * dbg.fps)
      let m = 0
      for (let i = f0; i <= f0 + Math.ceil(0.07 * dbg.fps); i++) if (dbg.onset[i] > m) m = dbg.onset[i]
      return acc + m
    }, 0) /
    bounds.length /
    mean
  const same =
    sync.segments.length === plan.segments.length &&
    sync.segments.every((s, i) => s.start === plan.segments[i].start && s.end === plan.segments[i].end)
  return {
    n,
    plan,
    workerMs,
    lengths: plan.segments.map((s) => +(s.end - s.start).toFixed(3)),
    downbeatPct: plan.downbeats.length ? bounds.filter((b) => near(b, plan.downbeats)).length / bounds.length : 0,
    beatPct: plan.beats.length ? bounds.filter((b) => near(b, plan.beats)).length / bounds.length : 0,
    cutStrength: +strength.toFixed(2),
    deterministic: same,
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  if (text !== undefined) e.textContent = text
  return e
}

function chipClass(v: string): string {
  return v === 'ok' ? 'ok' : v === 'alt' ? 'alt' : v === 'n/d' ? 'na' : 'bad'
}

function renderSummary(results: TrackResult[]): void {
  const box = document.getElementById('summary')
  if (!box) return
  const rows = results
    .map((r) => {
      const c8 = r.cuts.find((c) => c.n === 8)
      const pct = (v: number): string => `${Math.round(v * 100)}%`
      return `<tr><td>${r.label}</td><td>${r.refBpm || '–'}</td><td>${r.bpm?.toFixed(1) ?? '–'}</td>
        <td><span class="chip ${chipClass(r.verdict ?? 'n/d')}">${r.verdict ?? (r.error ? 'errore' : '…')}</span></td>
        <td>${r.confidence?.toFixed(2) ?? '–'}</td><td>${r.method ?? '–'}</td>
        <td>${r.cuts.map((c) => pct(c.downbeatPct)).join(' / ') || '–'}</td>
        <td>${r.cuts.map((c) => c.cutStrength.toFixed(1)).join(' / ') || '–'}</td>
        <td>${c8 ? c8.plan.segments.map((s) => (s.end - s.start).toFixed(1)).join(' ') : '–'}</td>
        <td>${r.cuts.map((c) => Math.round(c.workerMs)).join(' / ') || '–'}</td></tr>`
    })
    .join('')
  box.innerHTML = `<table><thead><tr><th>Brano</th><th>BPM rif.</th><th>BPM</th><th>esito</th><th>conf.</th><th>metodo</th>
    <th>tagli su battere (${COUNTS.join('/')})</th><th>forza attacco ×media</th><th>durate n8 (s)</th><th>worker ms</th></tr></thead><tbody>${rows}</tbody></table>`
}

async function run(): Promise<void> {
  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)
  const app = document.getElementById('app')!
  app.innerHTML = `<header><h1>UNSHUFFLE · analisi & tagli</h1>
    <p>Anteprime Deezer reali → analyzeAndCut (worker) per n = ${COUNTS.join(', ')}. Clicca una riga di spezzoni per ascoltarla; “ordine giusto” suona i tagli di fila.</p></header>
    <div id="summary"></div><div id="cards"></div>`
  const cards = document.getElementById('cards')!
  const state: LabState = { done: false, results: [] }
  window.__analysis = state
  const decoder = new OfflineAudioContext(2, 1, SAMPLE_RATE)

  for (const t of selectedTracks()) {
    const r: TrackResult = { label: t.label, query: t.q, refBpm: t.bpm, alt: t.alt ?? [], cuts: [] }
    state.results.push(r)
    const card = el('section', { class: 'card', id: `card-${state.results.length - 1}` })
    card.appendChild(el('h2', {}, t.label))
    const meta = el('div', { class: 'meta' }, 'Carico…')
    card.appendChild(meta)
    cards.appendChild(card)
    try {
      let dz: DzTrack
      try {
        dz = await findTrack(t.q, t.artist, t.title)
      } catch {
        await new Promise((res) => setTimeout(res, 1200))
        dz = await findTrack(t.q, t.artist, t.title)
      }
      r.id = dz.id
      r.title = dz.title
      r.artist = dz.artist.name
      const t0 = performance.now()
      const bytes = await (await fetch(dz.preview)).arrayBuffer()
      const buffer = await decoder.decodeAudioData(bytes)
      r.decodeMs = Math.round(performance.now() - t0)
      r.duration = buffer.duration
      r.sampleRate = buffer.sampleRate

      let debug: AnalysisDebug | undefined
      for (const n of COUNTS) {
        const w0 = performance.now()
        const plan = await analyzeAndCut(buffer, n)
        const workerMs = performance.now() - w0
        const s0 = performance.now()
        // Same input as the worker (mono + side channel), or the determinism check can't hold.
        const sync = analyzeSync({ samples: getMono(buffer), side: sideOf(buffer), sampleRate: buffer.sampleRate, n }, true)
        ;(r.syncMs ??= []).push(Math.round(performance.now() - s0))
        debug ??= sync.debug
        r.stageMs ??= sync.debug?.timings
        if (sync.debug) r.cuts.push(stats(plan, n, workerMs, sync.debug, sync.plan))
      }
      const first = r.cuts[0].plan
      r.bpm = first.bpm
      r.confidence = first.confidence
      r.method = first.method
      r.verdict = verdict(first.bpm, t.bpm, t.alt ?? [])
      r.tempoDecision = debug?.tempoDecision
      r.barConfidence = debug?.barPhase?.confidence

      const v = r.verdict
      meta.innerHTML = `<span>${dz.artist.name} – <b>${dz.title}</b> (#${dz.id})</span>
        <span>BPM <b>${first.bpm.toFixed(1)}</b> / rif. ${t.bpm || '–'} <span class="chip ${chipClass(v)}">${v}</span></span>
        <span>conf. <b>${first.confidence.toFixed(2)}</b></span><span>metodo <b>${first.method}</b></span>
        <span>battere conf. <b>${debug?.barPhase ? debug.barPhase.confidence.toFixed(2) : '–'}</b></span>
        <span>regione <b>${first.usableStart.toFixed(2)}–${first.usableEnd.toFixed(2)}s</b></span>
        <span>worker <b>${r.cuts.map((c) => Math.round(c.workerMs)).join('/')}</b> ms</span>
        <span>${debug?.tempoDecision ?? ''}</span>`
      const canvas = el('canvas')
      card.appendChild(canvas)
      const actions = el('div', { class: 'actions' })
      let highlight = COUNTS.includes(8) ? 8 : COUNTS[0]
      for (const c of r.cuts) {
        const b = el('button', {}, `▶ ordine giusto n${c.n}`)
        b.onclick = () => {
          highlight = c.n
          drawReport(canvas, buffer, r.cuts, debug!, highlight)
          playSegments(buffer, c.plan.segments)
        }
        actions.appendChild(b)
      }
      const stop = el('button', {}, '■ stop')
      stop.onclick = stopAll
      actions.appendChild(stop)
      card.appendChild(actions)
      drawReport(canvas, buffer, r.cuts, debug!, highlight)
      canvas.onclick = (e) => {
        const rect = canvas.getBoundingClientRect()
        const t = ((e.clientX - rect.left - 34) / (rect.width - 42)) * buffer.duration
        const c = r.cuts.find((c) => c.n === highlight) ?? r.cuts[0]
        const seg = c.plan.segments.find((s) => t >= s.start && t < s.end)
        if (seg) playSegments(buffer, [seg])
      }
      window.addEventListener('resize', () => drawReport(canvas, buffer, r.cuts, debug!, highlight))
    } catch (err) {
      r.error = err instanceof Error ? err.message : String(err)
      meta.innerHTML = `<span class="err">Errore: ${r.error}</span>`
    }
    renderSummary(state.results)
  }
  state.done = true
  document.body.dataset.done = '1'
}

void run()
