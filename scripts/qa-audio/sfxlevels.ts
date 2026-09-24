// Offline SFX level check: renders every SFX with the app's own renderSfx (same chain, unit volume)
// and compares it with real previews at unit volume (the engine applies the same volume to both buses).
import { renderSfx, SFX_NAMES } from '../../src/audio/sfx'
import type { SfxName } from '../../src/audio/sfx'

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]] } }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a)
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const p = i + k + len / 2; const xr = re[p] * cr - im[p] * ci, xi = re[p] * ci + im[p] * cr; re[p] = re[i + k] - xr; im[p] = im[i + k] - xi; re[i + k] += xr; im[i + k] += xi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t } }
  }
}
const LEN = 4096
function bands(x: Float32Array, sr: number, start: number): number[] {
  const re = new Float64Array(LEN), im = new Float64Array(LEN)
  for (let i = 0; i < LEN; i++) re[i] = (x[start + i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / LEN))
  fft(re, im)
  const out: number[] = []
  for (let f = 80; f < 12000; f *= 2 ** (1 / 3)) {
    const k0 = Math.round((f * 2 ** (-1 / 6) * LEN) / sr), k1 = Math.max(k0 + 1, Math.round((f * 2 ** (1 / 6) * LEN) / sr))
    let e = 0
    for (let k = k0; k < k1; k++) e += re[k] * re[k] + im[k] * im[k]
    out.push(10 * Math.log10(e + 1e-20))
  }
  return out
}
function kw(x: Float32Array, fs: number): Float32Array {
  const bq = (b0: number, b1: number, b2: number, a0: number, a1: number, a2: number) => (s: Float32Array) => { const o = new Float32Array(s.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < s.length; i++) { const y = (b0 * s[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = s[i]; y2 = y1; y1 = y; o[i] = y } return o }
  let G = 3.99984385397, Q = 0.7071752369554193, fc = 1681.9744509555319
  let A = 10 ** (G / 40), w0 = (2 * Math.PI * fc) / fs, al = Math.sin(w0) / (2 * Q), c = Math.cos(w0)
  const sh = bq(A * ((A + 1) + (A - 1) * c + 2 * Math.sqrt(A) * al), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - 2 * Math.sqrt(A) * al), (A + 1) - (A - 1) * c + 2 * Math.sqrt(A) * al, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - 2 * Math.sqrt(A) * al)
  Q = 0.5003270373253953; fc = 38.13547087613982; w0 = (2 * Math.PI * fc) / fs; al = Math.sin(w0) / (2 * Q); c = Math.cos(w0)
  G = 0
  return bq((1 + c) / 2, -(1 + c), (1 + c) / 2, 1 + al, -2 * c, 1 - al)(sh(x))
}
/** Max loudness over windows of `win` s (K-weighted, stereo sum like BS.1770). */
function maxLoud(l: Float32Array, r: Float32Array, fs: number, win: number): number {
  const a = kw(l, fs), b = kw(r, fs)
  const n = Math.round(win * fs), hop = Math.round(0.01 * fs)
  let best = 0
  for (let i = 0; i + n <= a.length; i += hop) { let s = 0; for (let j = i; j < i + n; j++) s += a[j] * a[j] + b[j] * b[j]; best = Math.max(best, s / n) }
  return -0.691 + 10 * Math.log10(best + 1e-20)
}
function integrated(l: Float32Array, r: Float32Array, fs: number): number {
  const a = kw(l, fs), b = kw(r, fs)
  const n = Math.round(0.4 * fs), hop = Math.round(0.1 * fs)
  const ps: number[] = []
  for (let i = 0; i + n <= a.length; i += hop) { let s = 0; for (let j = i; j < i + n; j++) s += a[j] * a[j] + b[j] * b[j]; ps.push(s / n) }
  const L = (p: number) => -0.691 + 10 * Math.log10(p + 1e-20)
  const g = ps.filter((p) => L(p) > -70)
  const i0 = L(g.reduce((x, y) => x + y, 0) / g.length)
  const rel = g.filter((p) => L(p) > i0 - 10)
  return L(rel.reduce((x, y) => x + y, 0) / rel.length)
}

async function run(urls: { label: string; url: string }[]) {
  const sr = 48000
  // In-flow gains used by the app for some sounds.
  const flows: [SfxName, { gain?: number; pitch?: number }][] = SFX_NAMES.map((n) => [n, {}] as [SfxName, { gain?: number; pitch?: number }])
  flows.push(['score', { gain: 0.7, pitch: 1.2 }], ['correct', { gain: 0.9 }], ['wrong', { gain: 0.85 }], ['tick', { gain: 0.6 }])
  const sfx: Record<string, { peakDb: number; loud100: number; loud400: number; bands: number[]; start: number }> = {}
  for (const [name, o] of flows) {
    const b = await renderSfx(name, o, sr)
    const l = b.getChannelData(0), r = b.getChannelData(1)
    let pk = 0, on = 0
    for (let i = 0; i < l.length; i++) { const v = Math.max(Math.abs(l[i]), Math.abs(r[i])); if (v > pk) pk = v; if (!on && v > 1e-3) on = i }
    const mono = l.map((v, i) => (v + r[i]) / 2)
    const key = `${name}${o.gain ? '@g' + o.gain : ''}`
    sfx[key] = { peakDb: 20 * Math.log10(pk), loud100: maxLoud(l, r, sr, 0.1), loud400: maxLoud(l, r, sr, 0.4), bands: bands(mono, sr, on), start: on }
  }
  // Music: previews at unit gain.
  const dec = new OfflineAudioContext(2, 1, sr)
  const music: { label: string; integrated: number; peakDb: number; windows: number[][] }[] = []
  for (const u of urls) {
    try {
      const buf = await dec.decodeAudioData(await (await fetch(u.url)).arrayBuffer())
      const l = buf.getChannelData(0), r = buf.getChannelData(1)
      let pk = 0
      for (let i = 0; i < l.length; i++) pk = Math.max(pk, Math.abs(l[i]), Math.abs(r[i]))
      const mono = l.map((v, i) => (v + r[i]) / 2)
      const windows: number[][] = []
      for (let w = 0; w < 24; w++) windows.push(bands(mono, sr, Math.round((2 + w * 1.1) * sr)))
      music.push({ label: u.label, integrated: integrated(l, r, sr), peakDb: 20 * Math.log10(pk), windows })
    } catch (e) {
      console.warn('decode failed', u.label, e)
    }
  }
  // Audibility proxy: best 1/3-octave band SNR of the SFX (first 85 ms) vs music window (same length).
  const out: Record<string, unknown> = {}
  for (const [k, s] of Object.entries(sfx)) {
    const snrs: number[] = []
    for (const m of music) for (const w of m.windows) snrs.push(Math.max(...s.bands.map((v, i) => v - w[i])))
    snrs.sort((a, b) => a - b)
    out[k] = {
      peakDb: +s.peakDb.toFixed(1),
      loud100ms: +s.loud100.toFixed(1),
      loud400ms: +s.loud400.toFixed(1),
      bestBandSnrMedian: +snrs[snrs.length >> 1].toFixed(1),
      bestBandSnrP10: +snrs[Math.floor(snrs.length * 0.1)].toFixed(1),
      shareAudible: +(snrs.filter((v) => v > -3).length / snrs.length).toFixed(2),
    }
  }
  const ints = music.map((m) => m.integrated).sort((a, b) => a - b)
  return { sfx: out, music: { integratedMedian: +ints[ints.length >> 1].toFixed(1), min: +ints[0].toFixed(1), max: +ints[ints.length - 1].toFixed(1), peaks: music.map((m) => +m.peakDb.toFixed(2)), n: music.length } }
}
;(window as unknown as { __lv: unknown }).__lv = { run }
