// Minimal float32 / int16 WAV reader for the headless bench.
import { readFileSync } from 'node:fs'

export interface Wav { sampleRate: number; channels: Float32Array[] }

export function readWav(path: string): Wav {
  const buf = readFileSync(path)
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  let off = 12
  let fmt = 0, ch = 1, sr = 44100, bits = 32
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4)
    const size = dv.getUint32(off + 4, true)
    const body = off + 8
    if (id === 'fmt ') {
      fmt = dv.getUint16(body, true); ch = dv.getUint16(body + 2, true)
      sr = dv.getUint32(body + 4, true); bits = dv.getUint16(body + 14, true)
    } else if (id === 'data') {
      const bytes = bits / 8
      const frames = Math.floor(size / (bytes * ch))
      const out = Array.from({ length: ch }, () => new Float32Array(frames))
      for (let i = 0; i < frames; i++) for (let c = 0; c < ch; c++) {
        const p = body + (i * ch + c) * bytes
        out[c][i] = fmt === 3 || bits === 32 ? dv.getFloat32(p, true) : dv.getInt16(p, true) / 32768
      }
      return { sampleRate: sr, channels: out }
    }
    off = body + size + (size & 1)
  }
  throw new Error('no data chunk: ' + path)
}
