import { expect, test } from 'bun:test'
import { createRealFft } from '../../src/audio/analysis/fft'

test('real fft power matches naive DFT', () => {
  for (const n of [8, 64, 1024]) {
    const x = new Float32Array(n)
    let s = 12345
    for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; x[i] = s / 0x7fffffff - 0.5 }
    const out = new Float32Array(n / 2 + 1)
    createRealFft(n).power(x, out)
    for (let k = 0; k <= n / 2; k++) {
      let r = 0, im = 0
      for (let t = 0; t < n; t++) { r += x[t] * Math.cos(2 * Math.PI * k * t / n); im -= x[t] * Math.sin(2 * Math.PI * k * t / n) }
      expect(Math.abs(out[k] - (r * r + im * im))).toBeLessThan(1e-3 * Math.max(1, r * r + im * im))
    }
  }
})
