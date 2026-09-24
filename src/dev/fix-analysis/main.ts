// fix-analysis lab (dev only): real-browser checks of the analysis fixes.
//  - window.__fixAnalysis.decode(urls, n): decode each preview in THIS browser, run
//    analyzeAndCut (worker path) and return the host plan's boundaries.
//  - window.__fixAnalysis.realign(urls, plans): realign a host's boundaries to THIS
//    browser's decode (alignCuts / realignSegments) — WebKit vs Chrome offset.
//  - window.__fixAnalysis.visual(url, label, cutsNew, cutsOld): draws waveform + a
//    0–4 kHz spectrogram strip (±0.45 s) around every cut, new vs old.
import { alignCuts, analyzeAndCut, realignSegments } from '../../audio/analysis'
import { getMono } from '../../audio/peaks'

interface DecodeResult {
  url: string
  sampleRate: number
  length: number
  channels: number
  ms: number
  method: string
  bpm: number
  cuts: number[]
  error?: string
}

const ctx = (): OfflineAudioContext => new OfflineAudioContext(2, 1, 44100)
const cache = new Map<string, AudioBuffer>()

async function load(url: string): Promise<AudioBuffer> {
  const hit = cache.get(url)
  if (hit) return hit
  const bytes = await (await fetch(url)).arrayBuffer()
  const buf = await ctx().decodeAudioData(bytes)
  cache.set(url, buf)
  return buf
}

async function decode(urls: string[], n: number): Promise<DecodeResult[]> {
  const out: DecodeResult[] = []
  for (const url of urls) {
    try {
      const buf = await load(url)
      const t0 = performance.now()
      const plan = await analyzeAndCut(buf, n)
      out.push({
        url,
        sampleRate: buf.sampleRate,
        length: buf.length,
        channels: buf.numberOfChannels,
        ms: performance.now() - t0,
        method: plan.method,
        bpm: plan.bpm,
        cuts: plan.segments.map((s) => s.start).concat(plan.segments[plan.segments.length - 1].end),
      })
    } catch (e) {
      out.push({ url, sampleRate: 0, length: 0, channels: 0, ms: 0, method: 'error', bpm: 0, cuts: [], error: String(e) })
    }
  }
  return out
}

async function realign(items: { url: string; cuts: number[] }[]) {
  const out = []
  for (const it of items) {
    const buf = await load(it.url)
    const a = alignCuts(getMono(buf), buf.sampleRate, it.cuts)
    const segs = it.cuts.slice(0, -1).map((start, i) => ({ index: i, start, end: it.cuts[i + 1], beats: 0 }))
    const r = realignSegments(buf, segs)
    out.push({ url: it.url, offsetMs: a.offset * 1000, agree: a.agree, strong: a.strong, changed: a.changed, sameArray: r === segs, first: r[1]?.start ?? null })
  }
  return out
}

function spectroStrip(buf: AudioBuffer, t: number, w: number, h: number): HTMLCanvasElement {
  const sr = buf.sampleRate
  const L = buf.getChannelData(0)
  const R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L
  const span = 0.45
  const n = 2048
  const hop = Math.max(64, Math.floor((2 * span * sr) / w))
  const frames = Math.floor((2 * span * sr) / hop)
  const kMax = Math.round((4000 * n) / sr)
  const cv = document.createElement('canvas')
  cv.width = frames
  cv.height = kMax
  const g = cv.getContext('2d')!
  const img = g.createImageData(frames, kMax)
  const re = new Float64Array(n)
  const im = new Float64Array(n)
  for (let f = 0; f < frames; f++) {
    const o = Math.round((t - span) * sr) + f * hop - n / 2
    for (let i = 0; i < n; i++) {
      const wv = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n)
      const j = o + i
      re[i] = j >= 0 && j < L.length ? ((L[j] + R[j]) / 2) * wv : 0
      im[i] = 0
    }
    fftInPlace(re, im)
    for (let k = 0; k < kMax; k++) {
      const db = 10 * Math.log10(re[k] * re[k] + im[k] * im[k] + 1e-12)
      const v = Math.max(0, Math.min(1, (db + 10) / 60))
      const p = ((kMax - 1 - k) * frames + f) * 4
      img.data[p] = 255 * v ** 1.5
      img.data[p + 1] = 200 * v ** 2.2
      img.data[p + 2] = 60 + 150 * v
      img.data[p + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  g.fillStyle = '#a6ff3f'
  g.fillRect(Math.round(frames / 2), 0, 1, kMax)
  cv.style.cssText = `width:${w}px;height:${h}px;image-rendering:pixelated;border-radius:6px;display:block`
  return cv
}

function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < len / 2; k++) {
        const a = i + k
        const b = a + len / 2
        const tr = re[b] * cr - im[b] * ci
        const ti = re[b] * ci + im[b] * cr
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
        const t = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = t
      }
    }
  }
}

function waveform(buf: AudioBuffer, cutsNew: number[], cutsOld: number[], width: number): HTMLCanvasElement {
  const dpr = window.devicePixelRatio || 1
  const h = 96
  const cv = document.createElement('canvas')
  cv.width = Math.round(width * dpr)
  cv.height = Math.round(h * dpr)
  cv.style.cssText = `width:${width}px;height:${h}px;display:block`
  const g = cv.getContext('2d')!
  g.scale(dpr, dpr)
  const x = getMono(buf)
  const dur = buf.duration
  g.fillStyle = '#15102a'
  g.fillRect(0, 0, width, h)
  g.fillStyle = '#8b7bff'
  const per = Math.floor(x.length / width)
  for (let px = 0; px < width; px++) {
    let m = 0
    for (let i = px * per; i < (px + 1) * per; i++) m = Math.max(m, Math.abs(x[i]))
    const y = m * (h / 2 - 4)
    g.fillRect(px, h / 2 - y, 1, 2 * y)
  }
  const line = (t: number, color: string, top: boolean) => {
    g.fillStyle = color
    g.fillRect(Math.round((t / dur) * width), top ? 0 : h / 2, 2, h / 2)
  }
  for (const t of cutsOld) line(t, '#ff6b5e', false)
  for (const t of cutsNew) line(t, '#a6ff3f', true)
  return cv
}

async function visual(url: string, label: string, cutsNew: number[], cutsOld: number[], note = ''): Promise<void> {
  const buf = await load(url)
  const root = document.getElementById('app')!
  const card = document.createElement('section')
  card.className = 'card'
  const w = Math.min(1400, root.clientWidth - 32)
  const h2 = document.createElement('h2')
  h2.textContent = label
  const p = document.createElement('p')
  const lens = (c: number[]) => c.slice(1).map((v, i) => (v - c[i]).toFixed(2))
  p.innerHTML = `<b style="color:#a6ff3f">nuovo</b> ${lens(cutsNew).join(' · ')} s<br><b style="color:#ff6b5e">prima</b> ${lens(cutsOld).join(' · ')} s${note ? `<br>${note}` : ''}`
  card.append(h2, p, waveform(buf, cutsNew, cutsOld, w))
  const rows = document.createElement('div')
  rows.className = 'rows'
  for (const [name, cuts, color] of [
    ['nuovo', cutsNew, '#a6ff3f'],
    ['prima', cutsOld, '#ff6b5e'],
  ] as const) {
    const row = document.createElement('div')
    row.className = 'row'
    const tag = document.createElement('div')
    tag.className = 'tag'
    tag.style.color = color
    tag.textContent = name
    row.append(tag)
    for (const t of cuts.slice(1, -1)) {
      const cell = document.createElement('figure')
      const cap = document.createElement('figcaption')
      cap.textContent = `${t.toFixed(3)} s`
      cell.append(spectroStrip(buf, t, 150, 110), cap)
      row.append(cell)
    }
    rows.append(row)
  }
  card.append(rows)
  root.append(card)
}

declare global {
  interface Window {
    __fixAnalysis: { ready: boolean; decode: typeof decode; realign: typeof realign; visual: typeof visual }
  }
}
window.__fixAnalysis = { ready: true, decode, realign, visual }
document.getElementById('app')!.innerHTML = '<header><h1>fix-analysis lab</h1><p>Tagli nuovi (verde) contro i vecchi (corallo): forma d’onda e spettrogramma 0–4 kHz ±0,45 s attorno a ogni taglio.</p></header>'
