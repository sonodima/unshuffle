import { MAX_ROUND_POINTS, POSITION_WEIGHT } from './constants'

export interface ScoreBreakdown {
  /** Snippets in the exact right position. */
  correct: number
  /** Adjacent pairs in the right sequence. */
  pairs: number
  points: number
  perfect: boolean
}

/**
 * Score an arrangement (order[position] = segment index) for a song cut into n
 * snippets. Exact positions are worth POSITION_WEIGHT of the round (half), correct
 * adjacent pairs the rest — so a run rebuilt in the right sequence but shifted
 * still earns a fair share. An untouched board (see scrambledOrder) scores 0.
 */
export function scoreArrangement(order: readonly number[], n: number): ScoreBreakdown {
  let correct = 0
  let pairs = 0
  for (let p = 0; p < n; p++) {
    if (order[p] === p) correct++
    if (p < n - 1 && order[p + 1] === order[p] + 1) pairs++
  }
  const perfect = correct === n
  const positionPts = (correct / n) * MAX_ROUND_POINTS * POSITION_WEIGHT
  const pairPts = n > 1 ? (pairs / (n - 1)) * MAX_ROUND_POINTS * (1 - POSITION_WEIGHT) : 0
  const points = perfect ? MAX_ROUND_POINTS : Math.round(positionPts + pairPts)
  return { correct, pairs, points, perfect }
}
