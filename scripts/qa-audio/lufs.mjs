// BS.1770-style loudness helpers (K-weighting, momentary / short-term / integrated) for QA analysis in node.
export function kweight(x, fs) {
  const biquad = (b0, b1, b2, a0, a1, a2) => (s) => {
    const out = new Float32Array(s.length)
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0
    for (let i = 0; i < s.length; i++) {
      const y = (b0 * s[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0
      x2 = x1; x1 = s[i]; y2 = y1; y1 = y; out[i] = y
    }
    return out
  }
  let G = 3.99984385397, Q = 0.7071752369554193, fc = 1681.9744509555319
  let A = 10 ** (G / 40), w0 = (2 * Math.PI * fc) / fs, al = Math.sin(w0) / (2 * Q), c = Math.cos(w0)
  const shelf = biquad(A * ((A + 1) + (A - 1) * c + 2 * Math.sqrt(A) * al), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - 2 * Math.sqrt(A) * al), (A + 1) - (A - 1) * c + 2 * Math.sqrt(A) * al, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - 2 * Math.sqrt(A) * al)
  Q = 0.5003270373253953; fc = 38.13547087613982; w0 = (2 * Math.PI * fc) / fs; al = Math.sin(w0) / (2 * Q); c = Math.cos(w0)
  const hp = biquad((1 + c) / 2, -(1 + c), (1 + c) / 2, 1 + al, -2 * c, 1 - al)
  return hp(shelf(x))
}
const lufsOf = (p) => -0.691 + 10 * Math.log10(p + 1e-20)
/** Momentary (400 ms) power series with 100 ms hop over K-weighted stereo. */
export function momentary(l, r, fs, hopS = 0.1) {
  const kl = kweight(l, fs), kr = kweight(r, fs)
  const blk = Math.round(0.4 * fs), hop = Math.round(hopS * fs)
  const out = []
  for (let i = 0; i + blk <= kl.length; i += hop) {
    let s = 0
    for (let j = i; j < i + blk; j++) s += kl[j] * kl[j] + kr[j] * kr[j]
    out.push({ t: i / fs, p: s / blk })
  }
  return out
}
export function loudness(l, r, fs) {
  const ms = momentary(l, r, fs)
  const g = ms.filter((m) => lufsOf(m.p) > -70)
  const i0 = g.length ? lufsOf(g.reduce((a, b) => a + b.p, 0) / g.length) : -Infinity
  const rel = g.filter((m) => lufsOf(m.p) > i0 - 10)
  const integ = rel.length ? lufsOf(rel.reduce((a, b) => a + b.p, 0) / rel.length) : -Infinity
  let peak = 0
  for (let i = 0; i < l.length; i++) peak = Math.max(peak, Math.abs(l[i]), Math.abs(r[i]))
  return {
    integratedLUFS: +integ.toFixed(1),
    maxMomentaryLUFS: ms.length ? +Math.max(...ms.map((m) => lufsOf(m.p))).toFixed(1) : null,
    peakDbfs: +(20 * Math.log10(peak + 1e-12)).toFixed(1),
  }
}
export const toLufs = lufsOf
/** Decode {f0, b64} Int16 interleaved stereo dump. */
export function fromDump(d) {
  const buf = Buffer.from(d.b64, 'base64')
  const i16 = new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2)
  const n = i16.length / 2
  const l = new Float32Array(n), r = new Float32Array(n)
  for (let i = 0; i < n; i++) { l[i] = i16[2 * i] / 32767; r[i] = i16[2 * i + 1] / 32767 }
  return { f0: d.f0, l, r }
}
/** Onsets (s, relative to start) by 5 ms energy jumps. */
export function onsets(l, r, fs, { minDb = -50, jumpDb = 10, refractoryS = 0.2 } = {}) {
  const win = Math.round(0.005 * fs)
  const out = []
  let prev = -120, lastOn = -1e9
  for (let i = 0; i + win < l.length; i += win) {
    let e = 0
    for (let j = i; j < i + win; j++) e += l[j] * l[j] + r[j] * r[j]
    const db = 10 * Math.log10(e / win + 1e-20)
    if (db > minDb && db - prev > jumpDb && i - lastOn > refractoryS * fs) { out.push(i); lastOn = i }
    prev = db
  }
  return out
}
export function writeWav(path, l, r, fs, fsMod) {
  const n = l.length
  const b = Buffer.alloc(44 + n * 4)
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 4, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22)
  b.writeUInt32LE(fs, 24); b.writeUInt32LE(fs * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 4, 40)
  for (let i = 0; i < n; i++) { b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, l[i])) * 32767), 44 + i * 4); b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, r[i])) * 32767), 46 + i * 4) }
  fsMod.writeFileSync(path, b)
}
