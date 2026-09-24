// Pure layout rules for the shell's pinned chrome (no DOM, no React: unit-tested).

/** A "HUD" whose bottom is below this share of the viewport is not a pinned bar. */
const HUD_MAX_SHARE = 0.45

/** Bottom edge (viewport px) of a measured HUD rect, or null when it doesn't count as a pinned bar. */
export function hudBottomFrom(rect: { bottom: number; height: number } | null, viewportHeight: number): number | null {
  if (!rect || rect.height <= 0 || rect.bottom <= 0) return null
  if (viewportHeight > 0 && rect.bottom > viewportHeight * HUD_MAX_SHARE) return null
  return Math.round(rect.bottom)
}

export interface BannerBox {
  /** Viewport px. */
  bottom: number
  left: number
  right: number
}

/**
 * Top edge for a toast column spanning [columnLeft, viewport right]: under the HUD and,
 * when they would collide, under the banner. null = nothing pinned up there.
 */
export function stackTop(hud: number | null, banner: BannerBox | null, columnLeft: number): number | null {
  const underBanner = banner && banner.right > columnLeft ? banner.bottom : null
  if (hud === null && underBanner === null) return null
  return Math.max(hud ?? 0, underBanner ?? 0)
}

/** The floating control hides once the page is this far down… */
export const HIDE_AFTER_PX = 24
/** …and comes back only near the top (hysteresis: no flicker around one threshold). */
export const SHOW_BELOW_PX = 8

/** One step of the "scrolled away" state for a page scroll offset. */
export function nextScrolledAway(away: boolean, scrollTop: number): boolean {
  return away ? scrollTop > SHOW_BELOW_PX : scrollTop > HIDE_AFTER_PX
}
