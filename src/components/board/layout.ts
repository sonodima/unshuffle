// Pure helpers for the snippet board: grid fitting, order-safe labels, time formatting.
import { formatSeconds } from '../ui/format'

export interface GridLayout {
  cols: number
  rows: number
  /** Block size in CSS px. */
  w: number
  h: number
  gap: number
  /** Total grid size in CSS px. */
  width: number
  height: number
}

interface GridFitOptions {
  /** Upper bound for a block, CSS px. */
  maxW?: number
  maxH?: number
}

const MAX_ASPECT = 2.3

function gapFor(n: number, width: number): number {
  if (width < 560) return n >= 12 ? 7 : 9
  if (width < 900) return 12
  return 14
}

function columnCandidates(n: number): number[] {
  const divisors: number[] = []
  for (let c = 1; c <= n; c++) if (n % c === 0) divisors.push(c)
  // Prime counts would only allow 1 row / 1 column: allow ragged rows instead.
  return divisors.length > 2 ? divisors : Array.from({ length: n }, (_, i) => i + 1)
}

/**
 * Pick the column count and block size that makes blocks as large as possible
 * inside `width × height` while keeping a pleasant aspect ratio. Pass
 * `height = Infinity` when the height is free (layout driven by width only).
 */
export function fitGrid(n: number, width: number, height: number, opts: GridFitOptions = {}): GridLayout {
  const count = Math.max(1, n)
  const W = Math.max(1, width)
  const free = !Number.isFinite(height)
  const gap = gapFor(count, W)
  const phone = W < 560
  const ideal = phone ? 1.15 : 1.3
  const maxW = opts.maxW ?? (phone ? 260 : 300)
  const maxH = opts.maxH ?? (phone ? 230 : 236)

  // Phones may use tall blocks to fill the space between HUD and controls;
  // on wider screens blocks stay landscape so waveforms read well.
  const minAspect = phone ? 0.66 : 1.15
  const candidates = columnCandidates(count)

  let best: GridLayout | null = null
  if (free) {
    // Height is unconstrained: pick the column count whose width is closest to a comfortable target.
    const target = phone ? (count >= 12 ? 100 : 170) : 240
    let bestDist = Infinity
    for (const cols of candidates) {
      const cellW = (W - gap * (cols - 1)) / cols
      if (cellW < 44 && cols > 1) continue
      const dist = Math.abs(Math.log(cellW / target)) + (count % cols === 0 ? 0 : 0.5)
      if (dist < bestDist) {
        bestDist = dist
        const w = Math.min(cellW, maxW)
        best = { cols, rows: Math.ceil(count / cols), w, h: Math.min(maxH, w / ideal), gap, width: 0, height: 0 }
      }
    }
  } else {
    let bestScore = -1
    for (const cols of candidates) {
      const rows = Math.ceil(count / cols)
      const cellW = (W - gap * (cols - 1)) / cols
      const cellH = (Math.max(1, height) - gap * (rows - 1)) / rows
      if (cellW < 44 || cellH < 36) continue
      const cellAspect = cellW / cellH
      const aspect = Math.min(MAX_ASPECT, Math.max(minAspect, cellAspect))
      let w = cellW
      let h = cellH
      if (aspect < cellAspect) w = cellH * aspect
      else h = cellW / aspect
      const s = Math.min(1, maxW / w, maxH / h)
      w *= s
      h *= s
      const shape = Math.exp(-0.8 * Math.log(aspect / ideal) ** 2)
      const ragged = count % cols === 0 ? 1 : 0.7
      const score = w * h * shape * ragged
      if (score > bestScore) {
        bestScore = score
        best = { cols, rows, w, h, gap, width: 0, height: 0 }
      }
    }
  }
  if (!best) {
    // Container too small for anything sensible: shrink a 2-column layout to fit.
    const cols = Math.min(count, 2)
    const rows = Math.ceil(count / cols)
    const w = Math.max(24, (W - gap * (cols - 1)) / cols)
    const h = free ? w / ideal : Math.max(24, (Math.max(1, height) - gap * (rows - 1)) / rows)
    best = { cols, rows, w, h, gap, width: 0, height: 0 }
  }
  best.w = Math.floor(best.w)
  best.h = Math.floor(best.h)
  best.width = best.cols * best.w + (best.cols - 1) * best.gap
  best.height = best.rows * best.h + (best.rows - 1) * best.gap
  return best
}

/** Top-left of the block at `position`, relative to the grid. */
export function slotOffset(layout: GridLayout, position: number): { x: number; y: number } {
  const col = position % layout.cols
  const row = Math.floor(position / layout.cols)
  return { x: col * (layout.w + layout.gap), y: row * (layout.h + layout.gap) }
}

/**
 * Letter per segment index (A, B, C…) assigned by ascending hue. Hues are random
 * per round, so the letters never leak the correct order.
 */
export function snippetLetters(hues: readonly number[]): string[] {
  const idx = hues.map((_, i) => i)
  idx.sort((a, b) => hues[a] - hues[b] || a - b)
  const letters = new Array<string>(hues.length)
  idx.forEach((segment, rank) => {
    letters[segment] = rank < 26 ? String.fromCharCode(65 + rank) : String(rank + 1)
  })
  return letters
}

/** 7.4 → "0:07" (digits of the current language). */
export function formatTime(seconds: number): string {
  return formatSeconds(seconds + 1e-6)
}
