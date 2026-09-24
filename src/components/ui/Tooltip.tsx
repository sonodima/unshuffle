import { AnimatePresence, motion } from 'motion/react'
import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from './cn'
import { useCanHover } from './hooks'

export interface TooltipProps {
  content: ReactNode
  /** A single focusable element (button, link...). */
  children: ReactElement
  side?: 'top' | 'bottom'
  /** Hover delay in ms. Default 280. */
  delay?: number
  disabled?: boolean
  /** Optional keyboard hint shown on the right, e.g. "Spazio". */
  shortcut?: string
  className?: string
}

const GAP = 8
const MARGIN = 8

/**
 * Desktop-only hover/focus tooltip (never on touch devices, where hover doesn't
 * exist — make sure the trigger has its own aria-label). Rendered in a portal
 * with fixed positioning, so it is never clipped by overflow:hidden parents.
 */
export function Tooltip({ content, children, side = 'top', delay = 280, disabled, shortcut, className }: TooltipProps) {
  const canHover = useCanHover()
  const id = useId()
  const anchorRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number; side: 'top' | 'bottom' } | null>(null)

  const enabled = canHover && !disabled && content != null && content !== ''

  const show = useCallback(
    (immediate = false) => {
      window.clearTimeout(timer.current)
      if (immediate) setOpen(true)
      else timer.current = window.setTimeout(() => setOpen(true), delay)
    },
    [delay],
  )
  const hide = useCallback(() => {
    window.clearTimeout(timer.current)
    setOpen(false)
    setPos(null)
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])
  useEffect(() => {
    if (!enabled) hide()
  }, [enabled, hide])

  // Measure after the tooltip mounts, then clamp inside the viewport and flip if needed.
  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !tipRef.current) return
    const a = anchorRef.current.getBoundingClientRect()
    const t = tipRef.current.getBoundingClientRect()
    let s = side
    if (s === 'top' && a.top - t.height - GAP < MARGIN) s = 'bottom'
    else if (s === 'bottom' && a.bottom + t.height + GAP > window.innerHeight - MARGIN) s = 'top'
    const top = s === 'top' ? a.top - t.height - GAP : a.bottom + GAP
    const left = Math.min(Math.max(MARGIN, a.left + a.width / 2 - t.width / 2), window.innerWidth - t.width - MARGIN)
    setPos({ left, top, side: s })
  }, [open, side, content])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide()
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, hide])

  if (!enabled) return children

  const child = isValidElement<{ 'aria-describedby'?: string }>(children)
    ? cloneElement(children, { 'aria-describedby': open ? id : undefined })
    : children

  return (
    <span
      ref={anchorRef}
      className="inline-flex"
      onPointerEnter={(e) => e.pointerType === 'mouse' && show()}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={(e) => {
        if ((e.target as HTMLElement).matches?.(':focus-visible')) show(true)
      }}
      onBlur={hide}
    >
      {child}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={tipRef}
                id={id}
                role="tooltip"
                initial={{ opacity: 0, scale: 0.92, y: side === 'top' ? 4 : -4 }}
                animate={{ opacity: pos ? 1 : 0, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.1 } }}
                transition={{ type: 'spring', stiffness: 520, damping: 32 }}
                style={{
                  position: 'fixed',
                  left: pos?.left ?? -9999,
                  top: pos?.top ?? -9999,
                  transformOrigin: pos?.side === 'bottom' ? 'top center' : 'bottom center',
                }}
                className={cn(
                  'pointer-events-none z-[1000] flex max-w-[260px] items-center gap-2 rounded-xl border border-white/10 bg-ink-800/95 px-2.5 py-1.5 text-xs font-semibold text-ink-50 shadow-lift',
                  className,
                )}
              >
                <span className="leading-snug">{content}</span>
                {shortcut && (
                  <kbd className="num rounded-md border border-white/15 bg-white/10 px-1.5 py-px text-[10px] font-semibold text-ink-200">
                    {shortcut}
                  </kbd>
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </span>
  )
}
