import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { useT } from '../../i18n/react'
import { cn } from './cn'
import { Icon, ICON_NAMES, type IconName } from './Icon'

export type ToastTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent'

export interface ToastViewItem {
  id: string | number
  tone: ToastTone
  /** Icon name, emoji string, or node. Defaults per tone. */
  icon?: IconName | ReactNode
  title: ReactNode
  body?: ReactNode
}

export interface ToastViewportProps {
  items: readonly ToastViewItem[]
  onDismiss(id: string | number): void
  /** Max visible; older ones are hidden. Default 4. */
  max?: number
  className?: string
}

const TONE: Record<ToastTone, { icon: IconName; chip: string; bar: string }> = {
  neutral: { icon: 'info', chip: 'bg-white/12 text-ink-50', bar: 'bg-white/40' },
  info: { icon: 'info', chip: 'bg-cyan/18 text-cyan', bar: 'bg-cyan' },
  success: { icon: 'check', chip: 'bg-lime/18 text-lime', bar: 'bg-lime' },
  warning: { icon: 'bolt', chip: 'bg-gold/18 text-gold', bar: 'bg-gold' },
  danger: { icon: 'alert', chip: 'bg-coral/18 text-coral', bar: 'bg-coral' },
  accent: { icon: 'sparkles', chip: 'bg-magenta/18 text-magenta', bar: 'bg-magenta' },
}

const ICON_SET: ReadonlySet<string> = new Set(ICON_NAMES)
function isIconName(x: unknown): x is IconName {
  return typeof x === 'string' && ICON_SET.has(x)
}

/**
 * Presentational toast stack (the connected host maps store events to items).
 * Top-center on phones, top-right on desktop; swipe/drag sideways to dismiss.
 */
export function ToastViewport({ items, onDismiss, max = 4, className }: ToastViewportProps) {
  const t = useT()
  const reduce = useReducedMotion()
  const visible = items.slice(-max).reverse()
  return (
    <section
      aria-label={t('ui.toast.region')}
      aria-live="polite"
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-[900] flex flex-col items-center gap-2 px-3 pt-safe-3 sm:inset-x-auto sm:right-0 sm:items-end sm:px-5 sm:pt-safe-5',
        className,
      )}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {visible.map((item) => {
          const tone = TONE[item.tone] ?? TONE.neutral
          const icon = item.icon ?? tone.icon
          return (
            <motion.div
              key={item.id}
              layout={!reduce}
              role="status"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -24, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, transition: { duration: 0.18 } }}
              transition={{ type: 'spring', stiffness: 480, damping: 34 }}
              drag="x"
              dragSnapToOrigin
              dragElastic={0.6}
              onDragEnd={(_, info) => {
                if (Math.abs(info.offset.x) > 90 || Math.abs(info.velocity.x) > 600) onDismiss(item.id)
              }}
              className="glass-flat pointer-events-auto relative flex w-full max-w-[420px] bg-ink-850/95! cursor-grab touch-pan-y items-center gap-3 overflow-hidden rounded-[20px] py-3 pr-2 pl-3 active:cursor-grabbing sm:w-[380px]"
            >
              <span aria-hidden className={cn('absolute inset-y-3 left-0 w-[3px] rounded-r-full', tone.bar)} />
              <span className={cn('grid size-10 shrink-0 place-items-center rounded-full', tone.chip)}>
                {isIconName(icon) ? (
                  <Icon name={icon} size={20} strokeWidth={2.4} />
                ) : typeof icon === 'string' ? (
                  <span className="emoji text-xl">{icon}</span>
                ) : (
                  icon
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm leading-tight font-extrabold break-words text-ink-50">{item.title}</p>
                {item.body != null && <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-ink-300">{item.body}</p>}
              </div>
              <button
                type="button"
                aria-label={t('ui.toast.dismiss')}
                onClick={() => onDismiss(item.id)}
                className="hit-slop relative grid size-9 shrink-0 place-items-center rounded-full text-ink-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Icon name="x" size={16} strokeWidth={2.6} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </section>
  )
}

