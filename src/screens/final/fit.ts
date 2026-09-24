// Fit-to-width for display type that must never spill out of its box (headline, podium names).
import { useLayoutEffect, type RefObject } from 'react'

interface FitWordsOptions {
  /** Smallest font size (px) before long words are allowed to break anywhere. */
  min: number
  /** First let the box use its parent's full width (drops a max-width) before shrinking. */
  widen?: boolean
}

/**
 * Shrinks the element's font until no single word overflows its box, so names never break
 * mid-word; below `min` it lets a word break anywhere rather than overflow and get clipped.
 * `deps` is anything that changes the text or its type (e.g. the text plus its size class).
 */
export function useFitWords(ref: RefObject<HTMLElement | null>, deps: string, { min, widen = false }: FitWordsOptions) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const over = () => el.scrollWidth > el.clientWidth + 1
    const fit = () => {
      el.style.fontSize = ''
      el.style.maxWidth = ''
      el.style.overflowWrap = ''
      let size = parseFloat(getComputedStyle(el).fontSize)
      if (!Number.isFinite(size)) return
      if (widen && over()) el.style.maxWidth = '100%'
      while (over() && size > min) {
        size = Math.max(min, Math.floor(size * 0.94))
        el.style.fontSize = `${size}px`
      }
      // Last resort (e.g. 16 W's on a 360px phone): break the word instead of clipping it.
      if (over()) el.style.overflowWrap = 'anywhere'
    }
    fit()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null
    ro?.observe(el.parentElement ?? el)
    let alive = true
    void document.fonts?.ready.then(() => {
      if (alive) fit()
    })
    return () => {
      alive = false
      ro?.disconnect()
    }
  }, [ref, deps, min, widen])
}
