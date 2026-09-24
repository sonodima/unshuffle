// "Has the on-stage screen been scrolled down?" for chrome pinned over the top of
// the page (the floating sound control): it belongs to the page's header area and
// steps aside once content scrolls under it, like an inline header control would.
// Screens scroll inside their own full-height containers, so this listens to scroll
// events in the capture phase and only considers page-sized vertical scrollers in
// the live screen frame (not inner lists, not the frame that is leaving).

import { useEffect, useState } from 'react'
import { useGame } from '../../game/store'
import { nextScrolledAway } from './layout'
import { useCurrentScreen } from './shellState'

/** Scrollers shorter than this share of the viewport are inner lists, not the page. */
const PAGE_SHARE = 0.6

function pageScroller(target: EventTarget | null): Element | null {
  const el = target instanceof Element ? target : null
  if (!el) return null
  const frame = el.closest('[data-screen-frame]')
  if (!frame || frame.hasAttribute('inert')) return null
  if (el.scrollHeight <= el.clientHeight + 1) return null
  if (el.clientHeight < (window.innerHeight || 0) * PAGE_SHARE) return null
  return el
}

/** True while the live screen is scrolled past the top (reset on every screen / phase change). */
export function useScrolledAway(active: boolean): boolean {
  const screen = useCurrentScreen()
  const phase = useGame((s) => (s.room ? `${s.room.phase.kind}:${'round' in s.room.phase ? s.room.phase.round : ''}` : 'none'))
  const [away, setAway] = useState(false)

  useEffect(() => {
    // New screen or phase = new content, back at the top.
    setAway(false)
    if (!active || typeof document === 'undefined') return
    let current = false
    let last: Element | null = null
    const onScroll = (e: Event) => {
      const el = e.target === last ? last : pageScroller(e.target)
      if (!el) return
      last = el
      const next = nextScrolledAway(current, el.scrollTop)
      if (next === current) return
      current = next
      setAway(next)
    }
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => document.removeEventListener('scroll', onScroll, { capture: true })
  }, [active, screen, phase])

  return active && away
}
