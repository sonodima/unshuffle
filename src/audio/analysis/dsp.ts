// Small numeric helpers shared by the analysis modules. Pure, allocation-light.

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export function mean(a: ArrayLike<number>, from = 0, to = a.length): number {
  if (to <= from) return 0
  let s = 0
  for (let i = from; i < to; i++) s += a[i]
  return s / (to - from)
}

function std(a: ArrayLike<number>): number {
  const m = mean(a)
  let s = 0
  for (let i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m)
  return a.length > 1 ? Math.sqrt(s / (a.length - 1)) : 0
}

/** q in [0, 1]; linear interpolation between order statistics. */
export function percentile(a: ArrayLike<number>, q: number): number {
  if (a.length === 0) return 0
  const s = Float64Array.from(a).sort()
  const pos = clamp(q, 0, 1) * (s.length - 1)
  const i = Math.floor(pos)
  const f = pos - i
  return i + 1 < s.length ? s[i] * (1 - f) + s[i + 1] * f : s[i]
}

/** Centered moving average with a window of 2*radius+1 samples (edges use the available samples). */
export function movingAverage(a: ArrayLike<number>, radius: number): Float32Array {
  const n = a.length
  const out = new Float32Array(n)
  const prefix = new Float64Array(n + 1)
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + a[i]
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - radius)
    const hi = Math.min(n, i + radius + 1)
    out[i] = (prefix[hi] - prefix[lo]) / (hi - lo)
  }
  return out
}

/** Linear interpolation of a series at a fractional index. */
export function sampleAt(a: ArrayLike<number>, x: number): number {
  if (x <= 0) return a[0] ?? 0
  const last = a.length - 1
  if (x >= last) return a[last] ?? 0
  const i = Math.floor(x)
  const f = x - i
  return a[i] * (1 - f) + a[i + 1] * f
}

/** Max of a series in [from, to] (inclusive, clamped). */
export function maxIn(a: ArrayLike<number>, from: number, to: number): number {
  const lo = Math.max(0, Math.floor(from))
  const hi = Math.min(a.length - 1, Math.ceil(to))
  let m = -Infinity
  for (let i = lo; i <= hi; i++) if (a[i] > m) m = a[i]
  return m === -Infinity ? 0 : m
}

/** Sub-sample peak offset in (-0.5, 0.5) from three neighbouring values (parabolic fit). */
export function parabolicOffset(ym1: number, y0: number, yp1: number): number {
  const d = ym1 - 2 * y0 + yp1
  if (d >= 0) return 0
  return clamp((0.5 * (ym1 - yp1)) / d, -0.5, 0.5)
}

/** Convolution with a symmetric kernel (same length output, zero padded). */
export function convolveSymmetric(a: ArrayLike<number>, kernel: ArrayLike<number>): Float32Array {
  const n = a.length
  const r = (kernel.length - 1) >> 1
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let s = 0
    const lo = Math.max(0, i - r)
    const hi = Math.min(n - 1, i + r)
    for (let j = lo; j <= hi; j++) s += a[j] * kernel[j - i + r]
    out[i] = s
  }
  return out
}

export function gaussianKernel(sigma: number, radius = Math.ceil(3 * sigma)): Float32Array {
  const k = new Float32Array(2 * radius + 1)
  let s = 0
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-0.5 * (i / Math.max(1e-6, sigma)) ** 2)
    k[i + radius] = v
    s += v
  }
  for (let i = 0; i < k.length; i++) k[i] /= s
  return k
}

/** z-score normalisation (returns zeros for constant input). */
export function zscore(a: ArrayLike<number>): Float32Array {
  const m = mean(a)
  const s = std(a)
  const out = new Float32Array(a.length)
  if (s < 1e-9) return out
  for (let i = 0; i < a.length; i++) out[i] = (a[i] - m) / s
  return out
}

/**
 * Anti-aliased integer decimation (windowed-sinc low-pass FIR + keep every
 * `factor`-th sample). factor 1 returns the input unchanged. The cutoff sits
 * at the new Nyquist, so for factor 2 it is a half-band filter whose even
 * taps vanish (skipped).
 */
export function decimate(x: Float32Array, factor: number): Float32Array {
  if (factor <= 1) return x
  const half = 8 * factor
  const taps = 2 * half + 1
  const cutoff = 0.5 / factor
  const hAll = new Float64Array(taps)
  let sum = 0
  for (let i = 0; i < taps; i++) {
    const t = i - half
    const sinc = t === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * t) / (Math.PI * t)
    const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (taps - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (taps - 1))
    hAll[i] = sinc * w
    sum += hAll[i]
  }
  // Symmetric FIR: fold mirrored taps and skip the zeros of the half-band case.
  const offs: number[] = []
  const coef: number[] = []
  for (let t = 1; t <= half; t++) {
    const v = hAll[half + t] / sum
    if (Math.abs(v) > 1e-9) {
      offs.push(t)
      coef.push(v)
    }
  }
  const h0 = hAll[half] / sum
  const k = offs.length
  const o = Int32Array.from(offs)
  const h = Float64Array.from(coef)
  const outLen = Math.floor(x.length / factor)
  const out = new Float32Array(outLen)
  const n = x.length
  for (let j = 0; j < outLen; j++) {
    const c = j * factor
    let s = h0 * x[c]
    if (c - half >= 0 && c + half < n) {
      for (let i = 0; i < k; i++) s += h[i] * (x[c - o[i]] + x[c + o[i]])
    } else {
      for (let i = 0; i < k; i++) {
        const a = c - o[i]
        const b = c + o[i]
        s += h[i] * ((a >= 0 ? x[a] : 0) + (b < n ? x[b] : 0))
      }
    }
    out[j] = s
  }
  return out
}

export function dbPow(p: number): number {
  return 10 * Math.log10(p + 1e-12)
}
