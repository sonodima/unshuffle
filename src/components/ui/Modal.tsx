import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react'
import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../../i18n/react'
import { cn } from './cn'
import { useIsWide } from './hooks'
import { Icon } from './Icon'

export interface ModalProps {
  open: boolean
  onClose(): void
  title?: ReactNode
  description?: ReactNode
  children?: ReactNode
  /** Sticky action area (buttons). Stacks full-width on phones. */
  footer?: ReactNode
  /** Max width of the centered dialog: sm 400 · md 480 · lg 640. Default md. */
  size?: 'sm' | 'md' | 'lg'
  /** auto = bottom sheet < 640px, centered dialog above (default) · center · sheet. */
  presentation?: 'auto' | 'center' | 'sheet'
  /** Esc, backdrop click and drag-down close it. Default true. */
  dismissible?: boolean
  /** Element to focus on open (default: first focusable in the body on desktop, the dialog itself on touch). */
  initialFocusRef?: RefObject<HTMLElement | null>
  hideCloseButton?: boolean
  /** Extra classes for the dialog surface. */
  className?: string
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),[contenteditable="true"]'

// Only the topmost open dialog reacts to Esc / owns the focus trap.
const stack: string[] = []
let scrollLocks = 0
let savedOverflow = ''

function lockScroll() {
  if (scrollLocks++ === 0) {
    savedOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
  }
}
function unlockScroll() {
  if (--scrollLocks === 0) document.documentElement.style.overflow = savedOverflow
}

const MAX_W = { sm: 'sm:max-w-[400px]', md: 'sm:max-w-[480px]', lg: 'sm:max-w-[640px]' } as const

/**
 * Accessible dialog. Bottom sheet on phones (drag the handle down to close),
 * centered card on wider screens. Focus trap, Esc, backdrop, scroll lock,
 * focus restore. Always render it; toggle `open` so exit animations play.
 *
 * Short viewports (≤ 500px tall, i.e. phones in landscape): the whole dialog
 * scrolls — the header scrolls away and the footer stays pinned — instead of
 * squeezing the body between a fixed header and footer.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  presentation = 'auto',
  dismissible = true,
  initialFocusRef,
  hideCloseButton = false,
  className,
}: ModalProps) {
  const t = useT()
  const wide = useIsWide()
  const reduce = useReducedMotion()
  const asSheet = presentation === 'sheet' || (presentation === 'auto' && !wide)
  const id = useId()
  const titleId = `${id}-title`
  const descId = `${id}-desc`
  const panelRef = useRef<HTMLDivElement>(null)
  const dragControls = useDragControls()
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const dismissRef = useRef(dismissible)
  dismissRef.current = dismissible

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    stack.push(id)
    lockScroll()

    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current
      if (!panel) return
      // On touch screens focus the dialog itself so no virtual keyboard pops up uninvited.
      const coarse = window.matchMedia?.('(pointer: coarse)').matches
      const firstField = coarse ? null : panel.querySelector<HTMLElement>(`[data-modal-body] :is(${FOCUSABLE})`)
      const target = initialFocusRef?.current ?? firstField ?? panel
      target.focus({ preventScroll: true })
    }, 30)

    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return
      if (e.key === 'Escape' && dismissRef.current) {
        e.stopPropagation()
        closeRef.current()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      // Tabbable only: roving-tabindex groups (radio lists) keep their inactive items at -1.
      const nodes = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (n) => n.tabIndex >= 0 && (n.offsetParent !== null || n === document.activeElement),
      )
      if (nodes.length === 0) {
        e.preventDefault()
        panelRef.current.focus()
        return
      }
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === panelRef.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      } else if (!panelRef.current.contains(active)) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)

    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKey, true)
      const i = stack.lastIndexOf(id)
      if (i !== -1) stack.splice(i, 1)
      unlockScroll()
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus({ preventScroll: true })
    }
  }, [open, id, initialFocusRef])

  if (typeof document === 'undefined') return null

  const spring = reduce ? { duration: 0.15 } : { type: 'spring' as const, stiffness: 420, damping: 36, mass: 0.9 }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[800]" key="modal">
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-ink-950/70 backdrop-blur-[6px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => dismissible && onClose()}
          />
          <div
            className={cn(
              'pointer-events-none absolute inset-0 flex',
              asSheet ? 'items-end justify-center' : 'items-center justify-center p-4 sm:p-6 short:py-2',
            )}
          >
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? titleId : undefined}
              aria-describedby={description ? descId : undefined}
              tabIndex={-1}
              className={cn(
                // Flat glass: the backdrop behind is already blurred, a second blur would be invisible.
                'glass-flat pointer-events-auto relative flex w-full flex-col overflow-hidden bg-ink-900/90! outline-none short:overflow-y-auto short:overscroll-contain',
                asSheet
                  ? 'max-h-[92dvh] rounded-t-[28px] rounded-b-none border-b-0 short:max-h-[calc(100dvh-12px)]'
                  : cn('max-h-[min(88dvh,820px)] rounded-panel short:max-h-[calc(100dvh-16px)]', MAX_W[size]),
                className,
              )}
              initial={asSheet ? { y: '100%' } : { opacity: 0, scale: 0.94, y: 16 }}
              animate={asSheet ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
              exit={asSheet ? { y: '100%', transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } } : { opacity: 0, scale: 0.96, y: 8, transition: { duration: 0.14 } }}
              transition={spring}
              drag={asSheet && dismissible ? 'y' : false}
              dragListener={false}
              dragControls={dragControls}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.05, bottom: 0.7 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 110 || info.velocity.y > 650) onClose()
              }}
            >
              {/* Header (also the drag handle of the sheet) */}
              <div
                className={cn('relative shrink-0', asSheet && dismissible && 'touch-none', asSheet ? 'px-5 pt-3 short:pt-2' : 'px-6 pt-6 short:pt-4')}
                onPointerDown={(e) => asSheet && dismissible && dragControls.start(e)}
              >
                {asSheet && <div aria-hidden className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-white/25 short:mb-2" />}
                {(title || description) && (
                  <div className={cn('pr-12', asSheet ? 'pb-1' : '')}>
                    {title && (
                      <h2 id={titleId} className="display display-skew text-xl leading-tight text-ink-50 sm:text-2xl short:text-lg">
                        {title}
                      </h2>
                    )}
                    {description && (
                      <p id={descId} className="mt-2 text-sm leading-relaxed text-ink-300 short:mt-1 short:text-[13px] short:leading-snug">
                        {description}
                      </p>
                    )}
                  </div>
                )}
                {!hideCloseButton && dismissible && (
                  <button
                    type="button"
                    aria-label={t('ui.modal.close')}
                    onClick={onClose}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={cn(
                      'hit-slop absolute grid size-10 place-items-center rounded-full bg-white/8 text-ink-200 transition-colors hover:bg-white/15 hover:text-white',
                      asSheet ? 'top-4 right-4 short:top-2.5' : 'top-5 right-5 short:top-3',
                    )}
                  >
                    <Icon name="x" size={18} strokeWidth={2.6} />
                  </button>
                )}
              </div>
              <div
                data-modal-body=""
                className={cn(
                  'min-h-0 flex-1 overflow-y-auto overscroll-contain short:flex-none short:overflow-visible',
                  asSheet ? 'px-5 pt-4 pb-5 short:pt-3' : 'px-6 pt-5 pb-6 short:pt-3 short:pb-4',
                  !footer && asSheet && 'pb-safe-6',
                )}
              >
                {children}
              </div>
              {footer && (
                <div
                  className={cn(
                    'flex shrink-0 flex-col-reverse gap-3 border-t border-white/[0.07] bg-ink-950/30 sm:flex-row sm:justify-end',
                    // Short screens: pinned to the bottom of the scrolling dialog, opaque, one row.
                    'short:sticky short:bottom-0 short:z-10 short:flex-row short:justify-end short:bg-ink-900',
                    asSheet ? 'px-5 pt-4 pb-safe-5 [&>*]:w-full short:pt-3 short:pb-safe-3 short:[&>*]:w-auto short:[&>*]:flex-1' : 'px-6 py-4 short:py-3',
                  )}
                >
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
