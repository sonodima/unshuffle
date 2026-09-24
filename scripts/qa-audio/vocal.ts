// QA proxy for "does a cut chop a sung word / sustained note?": centre-panned
// harmonic energy (stereo-similarity mask x HPSS harmonic mask) in 250-4000 Hz,
// measured just before / at / after every internal cut, compared with the same
// measure at every beat of the grid (base rate) and at the neighbouring beats.
import { analyzeAndCut } from '../../src/audio/analysis'
import type { CutPlan } from '../../src/audio/analysis'

const N = 2048
const HOP = 256

function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]] }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang), wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci
        const ai = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr
        re[i + k + len / 2] = re[i + k] - ar; im[i + k + len / 2] = im[i + k] - ai
        re[i + k] += ar; im[i + k] += ai
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t
      }
    }
  }
}

function median(a: Float32Array | number[]): number {
  const s = Array.from(a).sort((x, y) => x - y)
  return s[s.length >> 1]
}

function vocalProxy(buf: AudioBuffer): { fps: number; v: Float32Array } {
  const sr = buf.sampleRate
  const L = buf.getChannelData(0)
  const R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L
  const k0 = Math.round((250 * N) / sr), k1 = Math.round((4000 * N) / sr)
  const nb = k1 - k0
  const frames = Math.floor((L.length - N) / HOP) + 1
  const win = new Float64Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N))
  const C = new Float32Array(frames * nb)
  const lr = new Float64Array(N), li = new Float64Array(N), rr = new Float64Array(N), ri = new Float64Array(N)
  for (let f = 0; f < frames; f++) {
    const o = f * HOP
    for (let i = 0; i < N; i++) { lr[i] = L[o + i] * win[i]; rr[i] = R[o + i] * win[i]; li[i] = 0; ri[i] = 0 }
    fft(lr, li); fft(rr, ri)
    for (let k = k0; k < k1; k++) {
      const pl = lr[k] * lr[k] + li[k] * li[k], pr = rr[k] * rr[k] + ri[k] * ri[k]
      const xr = lr[k] * rr[k] + li[k] * ri[k], xi = li[k] * rr[k] - lr[k] * ri[k]
      const psi = (2 * Math.sqrt(xr * xr + xi * xi)) / (pl + pr + 1e-12)
      const sr_ = (lr[k] + rr[k]) / 2, si = (li[k] + ri[k]) / 2
      C[f * nb + (k - k0)] = Math.sqrt(sr_ * sr_ + si * si) * psi ** 4
    }
  }
  const TW = 21, FW = 17
  const v = new Float32Array(frames)
  const col = new Float32Array(TW)
  const H = new Float32Array(frames * nb)
  for (let k = 0; k < nb; k++) {
    for (let f = 0; f < frames; f++) {
      for (let j = 0; j < TW; j++) col[j] = C[Math.min(frames - 1, Math.max(0, f + j - (TW >> 1))) * nb + k]
      H[f * nb + k] = median(col)
    }
  }
  const row = new Float32Array(FW)
  for (let f = 0; f < frames; f++) {
    let e = 0
    for (let k = 0; k < nb; k++) {
      for (let j = 0; j < FW; j++) row[j] = C[f * nb + Math.min(nb - 1, Math.max(0, k + j - (FW >> 1)))]
      const P = median(row), h = H[f * nb + k]
      const m = (h * h) / (h * h + P * P + 1e-20)
      const c = C[f * nb + k] * m
      e += c * c
    }
    v[f] = 10 * Math.log10(e + 1e-12)
  }
  return { fps: sr / HOP, v }
}

function measure(p: { fps: number; v: Float32Array }, ref: number, t: number) {
  const at = (s: number) => Math.round((s * p.fps) - N / 2 / HOP)
  const avg = (a: number, b: number) => {
    let s = 0, c = 0
    for (let i = Math.max(0, at(a)); i <= Math.min(p.v.length - 1, at(b)); i++) { s += 10 ** (p.v[i] / 10); c++ }
    return 10 * Math.log10(s / Math.max(1, c) + 1e-12) - ref
  }
  const pre = avg(t - 0.06, t - 0.02), post = avg(t + 0.02, t + 0.06), mid = avg(t - 0.012, t + 0.012)
  // "through": loud centred harmonic sound on both sides and no dip at the cut.
  const through = pre > -10 && post > -10 && mid > Math.min(pre, post) - 3
  return { pre: +pre.toFixed(1), mid: +mid.toFixed(1), post: +post.toFixed(1), through }
}

async function run(urls: { id: number; label: string; url: string }[], counts: number[]) {
  const dec = new OfflineAudioContext(2, 1, 44100)
  const out: unknown[] = []
  for (const t of urls) {
    try {
      const buf = await dec.decodeAudioData(await (await fetch(t.url)).arrayBuffer())
      const p = vocalProxy(buf)
      const sorted = Array.from(p.v).sort((a, b) => a - b)
      const ref = sorted[Math.floor(sorted.length * 0.95)]
      const res: Record<string, unknown> = { id: t.id, label: t.label }
      for (const n of counts) {
        const plan: CutPlan = await analyzeAndCut(buf, n)
        const inner = plan.segments.slice(1).map((s) => s.start)
        const cuts = inner.map((c) => ({ t: +c.toFixed(3), ...measure(p, ref, c) }))
        const beats = plan.beats.filter((b) => b > plan.usableStart + 0.5 && b < plan.usableEnd - 0.5)
        const beatThrough = beats.length ? beats.filter((b) => measure(p, ref, b - 0.012).through).length / beats.length : null
        // Avoidable: a through-cut whose neighbouring beat (±1) is not through.
        let avoidable = 0
        for (const c of cuts) {
          if (!c.through || !plan.beats.length) continue
          const i = plan.beats.reduce((bi, b, k) => (Math.abs(b - c.t) < Math.abs(plan.beats[bi] - c.t) ? k : bi), 0)
          const alt = [plan.beats[i - 1], plan.beats[i + 1]].filter((b) => b !== undefined)
          if (alt.some((b) => !measure(p, ref, b - 0.012).through)) avoidable++
        }
        res[`n${n}`] = { method: plan.method, through: cuts.filter((c) => c.through).length, of: cuts.length, beatThroughRate: beatThrough === null ? null : +beatThrough.toFixed(2), avoidable, cuts }
      }
      out.push(res)
      console.log('done', t.label)
    } catch (e) {
      out.push({ id: t.id, label: t.label, error: String(e) })
    }
  }
  return out
}

;(window as unknown as { __qa: unknown }).__qa = { run }

/** Spectrogram (0-5 kHz, full stereo mid) of ±0.6 s around each given time, cut line drawn. */
async function spectro(url: string, times: number[], title: string) {
  const dec = new OfflineAudioContext(2, 1, 44100)
  const buf = await dec.decodeAudioData(await (await fetch(url)).arrayBuffer())
  const sr = buf.sampleRate
  const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L
  const n = 2048, hop = 128, span = 0.6
  const kMax = Math.round((5000 * n) / sr)
  const wrap = document.createElement('div')
  wrap.style.cssText = 'display:flex;gap:8px;background:#000;padding:8px;color:#fff;font:12px monospace;flex-wrap:wrap'
  const h = document.createElement('div'); h.textContent = title; h.style.width = '100%'; wrap.appendChild(h)
  for (const t of times) {
    const frames = Math.floor((2 * span * sr) / hop)
    const cv = document.createElement('canvas')
    cv.width = frames; cv.height = kMax
    const g = cv.getContext('2d')!
    const img = g.createImageData(frames, kMax)
    const re = new Float64Array(n), im = new Float64Array(n)
    for (let f = 0; f < frames; f++) {
      const o = Math.round((t - span) * sr) + f * hop - n / 2
      for (let i = 0; i < n; i++) { const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n); const s = o + i >= 0 && o + i < L.length ? (L[o + i] + R[o + i]) / 2 : 0; re[i] = s * w; im[i] = 0 }
      fft(re, im)
      for (let k = 0; k < kMax; k++) {
        const db = 10 * Math.log10(re[k] * re[k] + im[k] * im[k] + 1e-12)
        const v = Math.max(0, Math.min(255, ((db + 10) / 60) * 255))
        const p = ((kMax - 1 - k) * frames + f) * 4
        img.data[p] = v; img.data[p + 1] = v * 0.8; img.data[p + 2] = 255 - v * 0.6; img.data[p + 3] = 255
      }
    }
    g.putImageData(img, 0, 0)
    g.fillStyle = '#a6ff3f'; g.fillRect(Math.round(frames / 2), 0, 1, kMax)
    const box = document.createElement('div')
    const lab = document.createElement('div'); lab.textContent = `cut @ ${t.toFixed(3)} s (±${span}s, 0-5 kHz)`
    cv.style.cssText = 'width:420px;height:240px;image-rendering:pixelated'
    box.appendChild(lab); box.appendChild(cv); wrap.appendChild(box)
  }
  document.body.appendChild(wrap)
  return wrap
}
;(window as unknown as { __qa: Record<string, unknown> }).__qa.spectro = spectro
