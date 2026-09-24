// Tick audibility over the music actually recorded in-app (rec-ticks-reveal-*.wav):
// per 1/3-octave band, SFX vs music energy in the 60 ms after each SFX onset.
import { readFileSync } from 'node:fs'
import { onsets } from './lufs.mjs'
const rd = (p) => {
  const b = readFileSync(new URL(p, import.meta.url))
  const n = (b.length - 44) / 4
  const l = new Float32Array(n), r = new Float32Array(n)
  for (let i = 0; i < n; i++) { l[i] = b.readInt16LE(44 + 4 * i) / 32767; r[i] = b.readInt16LE(46 + 4 * i) / 32767 }
  return { l, r, sr: b.readUInt32LE(24) }
}
export function fft(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]] } }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a)
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const p = i + k + len / 2; const xr = re[p] * cr - im[p] * ci, xi = re[p] * ci + im[p] * cr; re[p] = re[i + k] - xr; im[p] = im[i + k] - xi; re[i + k] += xr; im[i + k] += xi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t } }
  }
}
export function bands(x, sr, start, len = 4096) {
  const re = new Float64Array(len), im = new Float64Array(len)
  for (let i = 0; i < len; i++) { const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / len); re[i] = (x[start + i] ?? 0) * w }
  fft(re, im)
  const out = []
  for (let f = 80; f < 12000; f *= 2 ** (1 / 3)) {
    const k0 = Math.round((f * 2 ** (-1 / 6) * len) / sr), k1 = Math.max(k0 + 1, Math.round((f * 2 ** (1 / 6) * len) / sr))
    let e = 0
    for (let k = k0; k < k1; k++) e += re[k] * re[k] + im[k] * im[k]
    out.push({ f: Math.round(f), db: 10 * Math.log10(e + 1e-20) })
  }
  return out
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const s = rd('./rec-ticks-reveal-sfx.wav'), m = rd('./rec-ticks-reveal-music.wav')
  const sr = s.sr
  const mono = (x) => x.l.map((v, i) => (v + x.r[i]) / 2)
  const sm = mono(s), mm = mono(m)
  const ons = onsets(s.l, s.r, sr, { minDb: -55, jumpDb: 10, refractoryS: 0.06 })
  for (const i of ons) {
    const len = 4096 // ~85 ms
    const bs = bands(sm, sr, i, len), bm = bands(mm, sr, i, len)
    let best = { snr: -Infinity }
    bs.forEach((b, k) => { const snr = b.db - bm[k].db; if (snr > best.snr) best = { snr, f: b.f } })
    // also music without duck? report music band at the tick's strongest band
    const top = bs.reduce((a, b) => (b.db > a.db ? b : a))
    const k = bs.indexOf(top)
    console.log(`t=${(i / sr).toFixed(2)}s  bestBandSNR ${best.snr.toFixed(1)} dB @${best.f} Hz | sfx strongest band ${top.f} Hz: sfx ${(top.db).toFixed(1)} vs music ${bm[k].db.toFixed(1)} → ${(top.db - bm[k].db).toFixed(1)} dB`)
  }
}
