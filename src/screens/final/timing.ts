// Podium entrance choreography, shared by the podium and the view (sounds, confetti).

/** Entrance timeline (seconds) shared with the view, so sounds and confetti land on cue. */
export const PODIUM_TIMING = {
  riseStart: 0.35,
  riseStagger: 0.14,
  dropStart: 1.0,
  dropStagger: 0.32,
  /** Fall duration before the avatar touches the block. */
  fall: 0.46,
} as const

/** Place (0 = first) → seconds until its avatar lands. Places drop 3rd → 2nd → 1st. */
export function landingTime(place: number, count: number, reduced: boolean): number {
  if (reduced) return 0.25
  const order = Math.max(0, Math.min(count, 3) - 1 - place)
  return PODIUM_TIMING.dropStart + order * PODIUM_TIMING.dropStagger + PODIUM_TIMING.fall
}
