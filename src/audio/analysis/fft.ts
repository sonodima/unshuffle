// Real-input FFT (radix-2, iterative) computing a power spectrum.
// A real frame of size N is packed into an N/2-point complex FFT and split
// afterwards, which halves the work compared to a naive complex transform.

interface RealFft {
  readonly size: number
  /**
   * Power spectrum |X[k]|^2 for k = 0..N/2 of `input` (length N).
   * `out` must have length N/2 + 1. `input` is not modified.
   */
  power(input: Float32Array, out: Float32Array): void
}

export function createRealFft(size: number): RealFft {
  if (size < 4 || (size & (size - 1)) !== 0) throw new Error(`FFT size must be a power of two, got ${size}`)
  const m = size >> 1
  const bits = Math.log2(m)

  const rev = new Uint32Array(m)
  for (let i = 0; i < m; i++) {
    let r = 0
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b)
    rev[i] = r
  }
  // Twiddles of the M-point complex FFT.
  const cosM = new Float64Array(m >> 1 || 1)
  const sinM = new Float64Array(m >> 1 || 1)
  for (let i = 0; i < m >> 1; i++) {
    cosM[i] = Math.cos((2 * Math.PI * i) / m)
    sinM[i] = -Math.sin((2 * Math.PI * i) / m)
  }
  // Twiddles of the final real split (W_N^k).
  const cosN = new Float64Array(m + 1)
  const sinN = new Float64Array(m + 1)
  for (let k = 0; k <= m; k++) {
    cosN[k] = Math.cos((2 * Math.PI * k) / size)
    sinN[k] = -Math.sin((2 * Math.PI * k) / size)
  }
  const re = new Float64Array(m)
  const im = new Float64Array(m)

  function power(input: Float32Array, out: Float32Array): void {
    for (let i = 0; i < m; i++) {
      const j = rev[i]
      re[j] = input[2 * i]
      im[j] = input[2 * i + 1]
    }
    for (let len = 2; len <= m; len <<= 1) {
      const half = len >> 1
      const step = m / len
      for (let start = 0; start < m; start += len) {
        for (let k = 0; k < half; k++) {
          const wr = cosM[k * step]
          const wi = sinM[k * step]
          const a = start + k
          const b = a + half
          const tr = re[b] * wr - im[b] * wi
          const ti = re[b] * wi + im[b] * wr
          re[b] = re[a] - tr
          im[b] = im[a] - ti
          re[a] += tr
          im[a] += ti
        }
      }
    }
    for (let k = 0; k <= m; k++) {
      const k1 = k === m ? 0 : k
      const k2 = k === 0 ? 0 : m - k
      const zr = re[k1]
      const zi = im[k1]
      const cr = re[k2]
      const ci = -im[k2]
      const er = (zr + cr) * 0.5
      const ei = (zi + ci) * 0.5
      const or = (zi - ci) * 0.5
      const oi = -(zr - cr) * 0.5
      const wr = cosN[k]
      const wi = sinN[k]
      const xr = er + wr * or - wi * oi
      const xi = ei + wr * oi + wi * or
      out[k] = xr * xr + xi * xi
    }
  }

  return { size, power }
}

/** Periodic Hann window. */
export function hann(size: number): Float32Array {
  const w = new Float32Array(size)
  for (let i = 0; i < size; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size)
  return w
}
