// The one leaderboard order, as a dependency-free module: the store-backed selectors,
// the round HUD model and the final screen stats all rank with it.

/** What a leaderboard row is ranked by. */
export interface RankKey {
  score: number
  /** Rounds with a result. */
  roundsPlayed: number
  /** Sum of confirmation times over those rounds. */
  totalTimeMs: number
}

/**
 * THE leaderboard order (every ranking in the game should use it): score desc; on equal
 * score whoever played more rounds first — a spectator or a late joiner never outranks
 * someone who actually played just because their total time is smaller — then lower total
 * confirmation time (with equal rounds played that is the same as a lower average).
 * 0 = same rank.
 */
export function compareStanding(a: RankKey, b: RankKey): number {
  return b.score - a.score || b.roundsPlayed - a.roundsPlayed || a.totalTimeMs - b.totalTimeMs
}
