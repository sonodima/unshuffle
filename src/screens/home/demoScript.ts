// Pure data + choreography for the decorative "shuffle → unshuffle" demo on
// Home and in the HowToPlay illustrations. No React, no audio.

/** Random-looking hues (never correlated with the correct order, like the real board). */
export const DEMO_HUES = [312, 22, 190, 95, 258, 140, 48, 5, 222, 168, 335, 72]
/** Letters printed on the demo blocks (by block id). */
export const DEMO_LETTERS = ['K', 'D', 'R', 'A', 'Z', 'M', 'F', 'T', 'B', 'W', 'P', 'H']

/** A single insertion move: take the block at `from` and insert it at `to`. */
export interface DemoMove {
  id: number
  from: number
  to: number
}

export function identity(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i)
}

export function applyMove(order: readonly number[], from: number, to: number): number[] {
  const next = [...order]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/**
 * The moves a tidy player would make: repeatedly take the block that belongs
 * in the first wrong slot and drop it there. Always ends sorted.
 */
export function planSort(order: readonly number[]): DemoMove[] {
  const moves: DemoMove[] = []
  let current = [...order]
  for (let p = 0; p < current.length; p++) {
    if (current[p] === p) continue
    const from = current.indexOf(p)
    moves.push({ id: p, from, to: p })
    current = applyMove(current, from, p)
  }
  return moves
}

function displaced(order: readonly number[]): number {
  let n = 0
  for (let i = 0; i < order.length; i++) if (order[i] !== i) n++
  return n
}

/**
 * A shuffle that looks thoroughly mixed (almost every block out of place) yet
 * sorts in a short, readable number of drags.
 */
export function makeShuffle(n: number, minMoves: number, maxMoves: number, random: () => number = Math.random): number[] {
  const floor = Math.max(2, n - 2)
  let best: number[] | null = null
  for (let attempt = 0; attempt < 400; attempt++) {
    let order = identity(n)
    const k = minMoves + Math.floor(random() * (maxMoves - minMoves + 1))
    for (let m = 0; m < k; m++) {
      const from = Math.floor(random() * n)
      let to = Math.floor(random() * (n - 1))
      if (to >= from) to++
      order = applyMove(order, from, to)
    }
    const steps = planSort(order).length
    if (steps < minMoves || steps > maxMoves) continue
    if (displaced(order) >= floor) return order
    if (!best || displaced(order) > displaced(best)) best = order
  }
  return best ?? [...identity(n)].reverse()
}

/**
 * One continuous "song" envelope sliced into blocks, so a sorted board shows a
 * waveform that flows from block to block. Values are 0.12..1.
 */
export function songEnvelope(blocks: number, barsPerBlock: number): number[][] {
  const total = blocks * barsPerBlock
  const out: number[][] = []
  for (let b = 0; b < blocks; b++) {
    const bars: number[] = []
    for (let j = 0; j < barsPerBlock; j++) {
      const i = b * barsPerBlock + j
      const t = i / total
      const phrase = 0.55 + 0.3 * Math.sin(t * Math.PI * 2 * 1.5 - 0.6) + 0.15 * Math.sin(t * Math.PI * 2 * 4.2)
      const beat = 0.62 + 0.38 * Math.abs(Math.sin((i / 3.2) * Math.PI))
      const grain = pseudoRandom(i * 7.13 + 1.7) * 0.35 + 0.65
      bars.push(clamp(phrase * beat * grain, 0.12, 1))
    }
    out.push(bars)
  }
  return out
}

function pseudoRandom(seed: number): number {
  const v = Math.sin(seed * 12.9898) * 43758.5453
  return v - Math.floor(v)
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
