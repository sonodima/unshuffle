// Pure helpers behind TimerRing / TimerBar (tested in tests/unit/timer.test.ts).

/** Fraction of the countdown left, clamped to 0..1 (0 when there is no total). */
export function timerFraction(ms: number, totalMs: number): number {
  return totalMs > 0 ? Math.min(1, Math.max(0, ms / totalMs)) : 0
}

/**
 * Whether the ring's dash offset must be re-written: only once it has moved at
 * least half a device pixel (the glowing arc is re-rasterized on every write),
 * except at the ends (full / empty), which are always exact.
 */
export function shouldWriteArc(offset: number, lastOffset: number, dpr: number, fraction: number): boolean {
  if (offset === lastOffset) return false
  if (fraction <= 0 || fraction >= 1 || Number.isNaN(lastOffset)) return true
  return Math.abs(offset - lastOffset) >= 0.5 / (dpr || 1)
}

/** TimerBar fill / glow transform: the full-width bar slid left by the elapsed share. */
export function barTransform(fraction: number): string {
  return `translate3d(${((fraction - 1) * 100).toFixed(3)}%,0,0)`
}
