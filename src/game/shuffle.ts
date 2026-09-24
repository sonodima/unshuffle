// Randomness helpers for round setup.

/** Uniform random int in [0, max). Uses crypto when available. */
export function randomInt(max: number): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    return buf[0] % max
  }
  return Math.floor(Math.random() * max)
}

export function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Random arrangement of 0..n-1 with no snippet in its correct position and no
 * correct adjacent pair (order[p+1] !== order[p] + 1), so an untouched board scores 0.
 */
export function scrambledOrder(n: number): number[] {
  const base = Array.from({ length: n }, (_, i) => i)
  if (n < 4) return n <= 1 ? base : [...base.slice(1), base[0]].reverse()
  for (let attempt = 0; attempt < 10_000; attempt++) {
    const order = shuffleInPlace([...base])
    let ok = true
    for (let p = 0; p < n && ok; p++) {
      if (order[p] === p) ok = false
      else if (p < n - 1 && order[p + 1] === order[p] + 1) ok = false
    }
    if (ok) return order
  }
  // Statistically unreachable for n >= 4; deterministic valid fallback.
  return base.map((_, p) => (p * 2 + 1) % n).reverse()
}

/** Hues (0..360) for n snippets: evenly spread around the wheel, randomly assigned. */
export function randomHues(n: number): number[] {
  const offset = randomInt(360)
  const hues = Array.from({ length: n }, (_, i) => Math.round((offset + (i * 360) / n) % 360))
  return shuffleInPlace(hues)
}
