// Harshness / spectral balance of the rendered SFX (scripts/engine/sfx/*.wav): centroid, share of energy 2-5 kHz and > 5 kHz, peak, duration.
import { readFileSync, readdirSync } from 'node:fs'
import { fft } from './masking.mjs'
const dir = new URL('../engine/sfx/', import.meta.url)
const rd = (p) => {
  const b = readFileSync(p)
  let o = 12, fmt = null, data = null
  while (o < b.length) { const id = b.toString('ascii', o, o + 4), sz = b.readUInt32LE(o + 4); if (id === 'fmt ') fmt = { ch: b.readUInt16LE(o + 10), sr: b.readUInt32LE(o + 12), bits: b.readUInt16LE(o + 22), tag: b.readUInt16LE(o + 8) }; if (id === 'data') data = b.subarray(o + 8, o + 8 + sz); o += 8 + sz + (sz & 1) }
  const n = data.length / (fmt.bits / 8) / fmt.ch
  const x = new Float32Array(n)
  for (let i = 0; i < n; i++) { let s = 0; for (let c = 0; c < fmt.ch; c++) { const k = (i * fmt.ch + c) * (fmt.bits / 8); s += fmt.bits === 16 ? data.readInt16LE(k) / 32768 : fmt.tag === 3 ? data.readFloatLE(k) : data.readInt32LE(k) / 2147483648 } x[i] = s / fmt.ch }
  return { x, sr: fmt.sr }
}
for (const f of readdirSync(dir).filter((f) => f.endsWith('.wav')).sort()) {
  const { x, sr } = rd(new URL(f, dir))
  let pk = 0, last = 0
  for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > pk) pk = a; if (a > 1e-3) last = i }
  const N = 1 << Math.ceil(Math.log2(Math.max(2048, last + 1)))
  const re = new Float64Array(N), im = new Float64Array(N)
  for (let i = 0; i < Math.min(N, x.length); i++) re[i] = x[i]
  fft(re, im)
  let e = 0, ec = 0, e25 = 0, e5 = 0
  for (let k = 1; k < N / 2; k++) { const fr = (k * sr) / N, p = re[k] * re[k] + im[k] * im[k]; e += p; ec += p * fr; if (fr >= 2000 && fr < 5000) e25 += p; if (fr >= 5000) e5 += p }
  console.log(f.padEnd(18), `peak ${(20 * Math.log10(pk)).toFixed(1)} dBFS`, `dur ${((last / sr) * 1000).toFixed(0)} ms`, `centroid ${(ec / e).toFixed(0)} Hz`, `2-5k ${((100 * e25) / e).toFixed(1)}%`, `>5k ${((100 * e5) / e).toFixed(1)}%`)
}
