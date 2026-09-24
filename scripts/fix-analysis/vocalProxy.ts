// Evaluation-only port of the QA vocal-continuity proxy (scripts/qa-audio/vocal.ts):
// centre-panned harmonic energy (stereo-similarity mask × HPSS harmonic mask) in
// 250–4000 Hz, hop 256, and a "through" verdict per cut time. Cached on disk.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const N = 2048
const HOP = 256

function fft(re: Float64Array, im: Float64Array): void {
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
        const ar = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci
        const ai = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr
        re[i + k + len / 2] = re[i + k] - ar
        im[i + k + len / 2] = im[i + k] - ai
        re[i + k] += ar
        im[i + k] += ai
        const t = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = t
      }
    }
  }
}

function median(a: Float32Array): number {
  const s = Float32Array.from(a).sort()
  return s[s.length >> 1]
}

export interface Proxy {
  fps: number
  v: Float32Array
  ref: number
  /** Masked centred harmonic power per frame × bin (frame-major), when computed. */
  m?: Float32Array
  nb?: number
  k0?: number
}

export function vocalProxy(L: Float32Array, R: Float32Array, sr: number, cachePath?: string, withMatrix = false): Proxy {
  if (cachePath && existsSync(cachePath) && (!withMatrix || existsSync(cachePath + '.m'))) {
    const b = readFileSync(cachePath)
    const v = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
    const sorted = Float32Array.from(v).sort()
    const out: Proxy = { fps: sr / HOP, v, ref: sorted[Math.floor(sorted.length * 0.95)] }
    if (withMatrix) {
      const mb = readFileSync(cachePath + '.m')
      out.m = new Float32Array(mb.buffer.slice(mb.byteOffset, mb.byteOffset + mb.byteLength))
      out.k0 = Math.round((250 * N) / sr)
      out.nb = Math.round((4000 * N) / sr) - out.k0
    }
    return out
  }
  const k0 = Math.round((250 * N) / sr)
  const k1 = Math.round((4000 * N) / sr)
  const nb = k1 - k0
  const frames = Math.floor((L.length - N) / HOP) + 1
  const win = new Float64Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N))
  const C = new Float32Array(frames * nb)
  const lr = new Float64Array(N)
  const li = new Float64Array(N)
  const rr = new Float64Array(N)
  const ri = new Float64Array(N)
  for (let f = 0; f < frames; f++) {
    const o = f * HOP
    for (let i = 0; i < N; i++) {
      lr[i] = L[o + i] * win[i]
      rr[i] = R[o + i] * win[i]
      li[i] = 0
      ri[i] = 0
    }
    fft(lr, li)
    fft(rr, ri)
    for (let k = k0; k < k1; k++) {
      const pl = lr[k] * lr[k] + li[k] * li[k]
      const pr = rr[k] * rr[k] + ri[k] * ri[k]
      const xr = lr[k] * rr[k] + li[k] * ri[k]
      const xi = li[k] * rr[k] - lr[k] * ri[k]
      const psi = (2 * Math.sqrt(xr * xr + xi * xi)) / (pl + pr + 1e-12)
      const sr_ = (lr[k] + rr[k]) / 2
      const si = (li[k] + ri[k]) / 2
      C[f * nb + (k - k0)] = Math.sqrt(sr_ * sr_ + si * si) * psi ** 4
    }
  }
  const TW = 21
  const FW = 17
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
  const M = new Float32Array(frames * nb)
  for (let f = 0; f < frames; f++) {
    let e = 0
    for (let k = 0; k < nb; k++) {
      for (let j = 0; j < FW; j++) row[j] = C[f * nb + Math.min(nb - 1, Math.max(0, k + j - (FW >> 1)))]
      const P = median(row)
      const h = H[f * nb + k]
      const m = (h * h) / (h * h + P * P + 1e-20)
      const c = C[f * nb + k] * m
      e += c * c
      M[f * nb + k] = c * c
    }
    v[f] = 10 * Math.log10(e + 1e-12)
  }
  if (cachePath) {
    writeFileSync(cachePath, Buffer.from(v.buffer))
    writeFileSync(cachePath + '.m', Buffer.from(M.buffer))
  }
  const sorted = Float32Array.from(v).sort()
  return { fps: sr / HOP, v, ref: sorted[Math.floor(sorted.length * 0.95)], m: M, nb, k0 }
}

/**
 * Stricter QA-style verdict (evaluation only): a HELD note — the same bins
 * (±3 % pitch) loud on both sides of the cut, carrying ≥ half of the local
 * centred harmonic energy, and no dip at the cut. Chord changes of sustained
 * pads do not count.
 */
export function heldThrough(p: Proxy, t: number): boolean {
  if (!p.m || !p.nb || p.k0 === undefined) return false
  const nb = p.nb
  const at = (s: number) => Math.round(s * p.fps - N / 2 / HOP)
  const band = (a: number, b: number) => {
    const out = new Float64Array(nb)
    const lo = Math.max(0, at(a))
    const hi = Math.min(p.v.length - 1, at(b))
    for (let f = lo; f <= hi; f++) for (let k = 0; k < nb; k++) out[k] += p.m[f * nb + k] / (hi - lo + 1)
    return out
  }
  const pre = band(t - 0.06, t - 0.02)
  const post = band(t + 0.02, t + 0.06)
  const mid = band(t - 0.012, t + 0.012)
  let cont = 0, held = 0, tp = 0, tq = 0
  for (let k = 0; k < nb; k++) {
    const d = Math.floor(0.03 * (p.k0 + k))
    let pk = 0
    for (let j = Math.max(0, k - d); j <= Math.min(nb - 1, k + d); j++) pk = Math.max(pk, pre[j])
    const c = Math.min(pk, post[k])
    cont += c
    held += Math.min(c, mid[k])
    tp += pre[k]
    tq += post[k]
  }
  const db = (x: number) => 10 * Math.log10(x + 1e-12)
  return db(cont) - p.ref > -10 && cont / Math.min(tp, tq) >= 0.5 && db(held) > db(cont) - 3
}

/** QA verdict: loud centred harmonic sound on both sides of `t` and no dip at it. */
export function through(p: Proxy, t: number): boolean {
  const at = (s: number) => Math.round(s * p.fps - N / 2 / HOP)
  const avg = (a: number, b: number) => {
    let s = 0
    let c = 0
    for (let i = Math.max(0, at(a)); i <= Math.min(p.v.length - 1, at(b)); i++) {
      s += 10 ** (p.v[i] / 10)
      c++
    }
    return 10 * Math.log10(s / Math.max(1, c) + 1e-12) - p.ref
  }
  const pre = avg(t - 0.06, t - 0.02)
  const post = avg(t + 0.02, t + 0.06)
  const mid = avg(t - 0.012, t + 0.012)
  return pre > -10 && post > -10 && mid > Math.min(pre, post) - 3
}
