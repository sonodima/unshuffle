// Sample-accurate refinement of a cut: find the attack nearest to the grid
// time and move the cut a few milliseconds before it, onto the quietest point
// (so the next snippet starts with its full transient and the previous one
// never ends with a chopped attack).

const BLOCK_MS = 1
const SEARCH_MS = 45
const MAX_PREROLL_MS = 30
const MIN_PREROLL_MS = 4

interface SnapResult {
  time: number
  /** Detected attack time (== input time when no clear transient). */
  attack: number
  /** Attack strength in dB (energy ratio after/before). */
  strengthDb: number
}

export function snapToAttack(x: Float32Array, sr: number, time: number): SnapResult {
  const bs = Math.max(1, Math.round((sr * BLOCK_MS) / 1000))
  const center = Math.round((time * sr) / bs)
  const nb = Math.floor(x.length / bs)
  const before = Math.ceil((SEARCH_MS + MAX_PREROLL_MS + 12) / BLOCK_MS)
  const after = Math.ceil((SEARCH_MS + 12) / BLOCK_MS)
  const lo = Math.max(0, center - before)
  const hi = Math.min(nb, center + after)
  if (hi - lo < 16) return { time, attack: time, strengthDb: 0 }

  // Block energies (1 ms), plus a high-passed variant that emphasises clicks.
  const len = hi - lo
  const e = new Float64Array(len)
  const eh = new Float64Array(len)
  for (let b = 0; b < len; b++) {
    const s0 = (lo + b) * bs
    let s = 0
    let h = 0
    for (let i = s0; i < s0 + bs; i++) {
      const v = x[i]
      s += v * v
      const d = i > 0 ? v - x[i - 1] : 0
      h += d * d
    }
    e[b] = s
    eh[b] = h
  }
  const sumRange = (a: Float64Array, from: number, to: number): number => {
    let s = 0
    for (let i = Math.max(0, from); i < Math.min(len, to); i++) s += a[i]
    return s
  }

  // Attack = strongest energy rise (6 ms after vs 10 ms before), favouring the grid time.
  const c = center - lo
  const search = Math.round(SEARCH_MS / BLOCK_MS)
  let bestScore = -Infinity
  let attackBlock = c
  let bestDb = 0
  for (let b = Math.max(10, c - search); b <= Math.min(len - 6, c + search); b++) {
    const post = sumRange(e, b, b + 6) / 6 + 0.5 * (sumRange(eh, b, b + 6) / 6)
    const pre = sumRange(e, b - 10, b) / 10 + 0.5 * (sumRange(eh, b - 10, b) / 10) + 1e-10
    const db = 10 * Math.log10(post / pre)
    const prox = Math.exp(-0.5 * ((b - c) / (22 / BLOCK_MS)) ** 2)
    const score = db * (0.55 + 0.45 * prox)
    if (score > bestScore) {
      bestScore = score
      attackBlock = b
      bestDb = db
    }
  }
  if (bestDb < 3) {
    attackBlock = c
    bestDb = Math.max(0, bestDb)
  }

  // Quietest block 4..30 ms before the attack (mild preference for short pre-roll).
  const minPre = Math.round(MIN_PREROLL_MS / BLOCK_MS)
  const maxPre = Math.round(MAX_PREROLL_MS / BLOCK_MS)
  let cutBlock = Math.max(0, attackBlock - minPre)
  let bestCost = Infinity
  for (let d = 1; d <= maxPre; d++) {
    const b = attackBlock - d
    if (b < 0) break
    const shortPenalty = d < minPre ? 1.5 * ((minPre - d) / minPre) : 0
    const cost = (e[b] + 1e-12) * (1 + shortPenalty + (0.3 * d) / maxPre)
    if (cost < bestCost) {
      bestCost = cost
      cutBlock = b
    }
  }
  // Sample with the smallest magnitude in that block (≈ zero crossing).
  const s0 = (lo + cutBlock) * bs
  let bestSample = s0
  let bestAbs = Infinity
  for (let i = s0; i < Math.min(x.length, s0 + bs); i++) {
    const a = Math.abs(x[i])
    if (a < bestAbs) {
      bestAbs = a
      bestSample = i
    }
  }
  return {
    time: bestSample / sr,
    attack: ((lo + attackBlock) * bs) / sr,
    strengthDb: bestDb,
  }
}
