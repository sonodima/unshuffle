// Bottom controls of the play phase: the play-all transport and the action slot
// (CONFERMA → confirmed ✓ / time up / spectator note).
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { memo, useRef } from 'react'
import type { ReactNode } from 'react'
import { TransportBar } from '../../components/board'
import { Button, Icon, IconButton, Kbd, cn, shakeElement, useMediaQuery } from '../../components/ui'
import { useOnChange } from './hooks'
import type { Player, PlayerId, Segment } from '../../game/types'
import { rich, useT } from '../../i18n/react'
import { joinNames } from './model'
import { PlayersStrip } from './PlayersStrip'

export type DockState = 'ready' | 'submitted' | 'timeup' | 'spectator'
/** CONFERMA asks for a second press (the board is still the untouched shuffle, worth 0). */
export type ConfirmArm = 'tap' | 'click' | 'key' | null

interface ConfirmDockProps {
  state: DockState
  /** Transport above a full-width CTA (phones) instead of side by side. */
  stacked: boolean
  /** Generous paddings + keyboard hints (big screens). */
  roomy: boolean
  trackKey: string
  segments: Segment[]
  order: number[]
  hues: number[]
  /** Audio failed: the transport is replaced by a retry pill. */
  audioFailed: boolean
  retrying: boolean
  onRetry?: () => void
  onConfirm: () => void
  /** Connected players who still have to confirm. */
  waiting: readonly Player[]
  me: PlayerId
  /** I never confirmed and time ran out (my last arrangement counts). */
  timedOut: boolean
  /** Increments on every confirm: fires the shockwave. */
  burst: number
  /** Keyboard hints row (desktop pointers). */
  showHints: boolean
  /** First press on an untouched board: the button asks to press again. */
  armed?: ConfirmArm
  /** Confirmed while the link to the host is down: the store sends it as soon as it's back. */
  queued?: boolean
}

const SLOT = 'h-[68px] mb-[6px]'

type Translate = ReturnType<typeof useT>

const APPLE = isApple()

/** ⌘ on Apple keyboards, Ctrl elsewhere (both work). */
function modKey(t: Translate): string {
  return APPLE ? '⌘' : t('round.keys.ctrl')
}

function isApple(): boolean {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
  return /mac|iphone|ipad|ipod/i.test(nav.userAgentData?.platform || nav.platform || nav.userAgent || '')
}

// Memoized: the play screen re-renders a few times per second for the clock; the transport doesn't need to.
export const ConfirmDock = memo(function ConfirmDock(props: ConfirmDockProps) {
  const { state, stacked, roomy, trackKey, segments, order, hues, audioFailed, retrying, onRetry, showHints } = props
  const t = useT()
  const reduce = useReducedMotion()
  const keys = { space: t('round.keys.space'), enter: t('round.keys.enter'), mod: modKey(t) }
  const kbd = (c: string) => <Kbd>{c}</Kbd>
  return (
    <motion.footer
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30, delay: 0.1 }}
      className={cn('relative z-20', roomy ? 'px-safe-6 pb-safe-4' : 'px-safe-3 pb-safe-3')}
    >
      <div className={cn('mx-auto flex w-full max-w-[1000px] gap-3', stacked ? 'flex-col' : 'flex-row items-center')}>
        {audioFailed ? (
          <AudioRetryPill retrying={retrying} onRetry={onRetry} compact={stacked} className={stacked ? '' : 'min-w-0 flex-1'} />
        ) : (
          <TransportBar className={stacked ? 'w-full' : 'min-w-0 flex-1'} trackKey={trackKey} segments={segments} order={order} hues={hues} />
        )}
        <ActionSlot {...props} />
      </div>
      {showHints && roomy && (
        <p className="mt-2.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[12px] font-semibold text-ink-400">
          <span className="flex items-center gap-1.5">{rich(t('round.dock.hints.playAll', keys), { kbd })}</span>
          {state === 'ready' ? (
            <>
              <span className="flex items-center gap-1">
                {rich(t('round.dock.hints.confirm', keys), { kbd, action: (c) => <span className="ml-0.5">{c}</span> })}
              </span>
              <span>{t('round.dock.hints.pointer')}</span>
            </>
          ) : (
            <span>{t('round.dock.hints.pointerLocked')}</span>
          )}
        </p>
      )}
    </motion.footer>
  )
})

function armHint(t: Translate, arm: Exclude<ConfirmArm, null>): string {
  if (arm === 'tap') return t('round.dock.armTap')
  if (arm === 'click') return t('round.dock.armClick')
  return t('round.dock.armKey', { mod: modKey(t), enter: t('round.keys.enter') })
}

/** "In attesa di Giulia e Marco" (up to two names), else a count. */
function waitingText(t: Translate, waiting: readonly Player[]): string {
  return waiting.length <= 2
    ? t('round.dock.waitingFor', { names: joinNames(waiting.map((p) => p.name)) })
    : t('round.dock.waitingForCount', { count: waiting.length })
}

function ActionSlot({ state, stacked, onConfirm, waiting, me, timedOut, burst, armed = null, queued = false }: ConfirmDockProps) {
  const t = useT()
  const reduce = useReducedMotion()
  const lg = useMediaQuery('(min-width: 1024px)')
  // Side-by-side slot is 320px below lg: three avatars leave room for the title.
  const asideMax = stacked || lg ? 4 : 3
  const confirmRef = useRef<HTMLButtonElement>(null)
  useOnChange(armed, (a) => {
    if (a) shakeElement(confirmRef.current)
  })
  const enter = reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 8 }
  const leave = reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92, transition: { duration: 0.14 } }
  const spring = { type: 'spring', stiffness: 520, damping: 26 } as const
  return (
    <div className={cn('relative shrink-0', stacked ? 'w-full' : 'w-[320px] lg:w-[340px]')}>
      {/* Shockwave on confirm */}
      <AnimatePresence>
        {burst > 0 && !reduce && (
          <motion.span
            key={burst}
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[68px] rounded-full border-2 border-lime"
            initial={{ opacity: 0.9, scale: 1 }}
            animate={{ opacity: 0, scale: 1.25 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            style={{ boxShadow: '0 0 30px rgb(166 255 63 / 0.6)' }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence mode="popLayout" initial={false}>
        {state === 'ready' && (
          <motion.div key="confirm" initial={enter} animate={{ opacity: 1, scale: 1, y: 0 }} exit={leave} transition={spring}>
            <Button
              ref={confirmRef}
              size="xl"
              fullWidth
              variant={armed ? 'secondary' : 'primary'}
              leftIcon={armed ? 'alert' : 'check'}
              sound={false}
              onClick={onConfirm}
              aria-keyshortcuts="Meta+Enter Control+Enter"
              data-armed={armed || undefined}
              className={armed ? 'px-5!' : undefined}
            >
              {armed ? (
                <span className="flex flex-col items-start gap-1 text-left">
                  <span className={cn('leading-none', stacked || lg ? 'text-[15px]' : 'text-[13.5px]')}>{t('round.dock.unchanged')}</span>
                  <span className="font-sans text-[12px] leading-none font-bold tracking-normal normal-case opacity-85">
                    {armHint(t, armed)}
                  </span>
                </span>
              ) : (
                t('round.dock.confirm')
              )}
            </Button>
          </motion.div>
        )}
        {state === 'submitted' && queued && (
          <motion.div key="queued" initial={enter} animate={{ opacity: 1, scale: 1, y: 0 }} exit={leave} transition={spring}>
            <StatusPanel
              tone="cyan"
              icon={
                <span className="grid size-10 place-items-center rounded-full bg-cyan/15 text-cyan shadow-[inset_0_0_0_1px_rgb(46_230_255/0.4)]">
                  <Icon name="wifi-off" size={20} strokeWidth={2.4} />
                </span>
              }
              title={t('round.dock.confirmed')}
              body={<span className="rs-dots">{t('round.dock.queued')}</span>}
            />
          </motion.div>
        )}
        {state === 'submitted' && !queued && (
          <motion.div key="submitted" initial={enter} animate={{ opacity: 1, scale: 1, y: 0 }} exit={leave} transition={spring}>
            <StatusPanel
              tone="lime"
              icon={
                <motion.span
                  initial={reduce ? false : { scale: 0, rotate: -40 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 600, damping: 16, delay: 0.05 }}
                  className="grid size-10 place-items-center rounded-full bg-lime text-ink-950 shadow-[0_0_20px_rgb(166_255_63/0.6)]"
                >
                  <Icon name="check" size={22} strokeWidth={3.4} />
                </motion.span>
              }
              title={t('round.dock.confirmed')}
              body={waiting.length > 0 ? <span className="rs-dots">{waitingText(t, waiting)}</span> : t('round.dock.allConfirmed')}
              aside={
                waiting.length > 0 ? <PlayersStrip players={waiting} me={me} size="xs" overlap max={asideMax} className="shrink-0" label={t('round.dock.stillPlaying')} /> : null
              }
            />
          </motion.div>
        )}
        {state === 'timeup' && (
          <motion.div key="timeup" initial={enter} animate={{ opacity: 1, scale: 1, y: 0 }} exit={leave} transition={spring}>
            <StatusPanel
              tone="coral"
              icon={
                <span className="grid size-10 place-items-center rounded-full bg-coral text-white shadow-[0_0_20px_rgb(255_84_112/0.55)]">
                  <Icon name="clock" size={21} strokeWidth={2.6} />
                </span>
              }
              title={t('round.dock.timeUp')}
              body={timedOut ? t('round.dock.timedOut') : t('round.dock.computing')}
            />
          </motion.div>
        )}
        {state === 'spectator' && (
          <motion.div key="spectator" initial={enter} animate={{ opacity: 1, scale: 1, y: 0 }} exit={leave} transition={spring}>
            <StatusPanel
              tone="cyan"
              icon={
                <span className="grid size-10 place-items-center rounded-full bg-cyan/15 text-cyan shadow-[inset_0_0_0_1px_rgb(46_230_255/0.4)]">
                  <Icon name="eye" size={21} strokeWidth={2.4} />
                </span>
              }
              title={t('round.dock.spectator')}
              body={t('round.dock.spectatorBody')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const TONES = {
  lime: 'border-lime/35 bg-linear-to-r from-lime/[0.12] to-transparent shadow-[0_0_0_1px_rgb(166_255_63/0.12),0_16px_40px_-18px_rgb(166_255_63/0.55)]',
  coral: 'border-coral/40 bg-linear-to-r from-coral/[0.14] to-transparent shadow-[0_0_0_1px_rgb(255_84_112/0.12),0_16px_40px_-18px_rgb(255_84_112/0.55)]',
  cyan: 'border-cyan/30 shadow-[0_16px_40px_-18px_rgb(46_230_255/0.4)]',
} as const

const TITLE_TONES = { lime: 'text-lime', coral: 'text-coral', cyan: 'text-cyan' } as const

function StatusPanel({ tone, icon, title, body, aside }: { tone: keyof typeof TONES; icon: ReactNode; title: string; body: ReactNode; aside?: ReactNode }) {
  return (
    <div role="status" className={cn('glass-flat flex items-center gap-3 rounded-full py-2 pr-5 pl-3', SLOT, TONES[tone])}>
      {icon}
      <div className="min-w-0 flex-1">
        <p className={cn('display display-skew truncate pr-1 text-[15px] leading-tight', TITLE_TONES[tone])}>{title}</p>
        <p className="truncate text-[13px] font-semibold text-ink-200">{body}</p>
      </div>
      {aside}
    </div>
  )
}

function AudioRetryPill({ retrying, onRetry, compact, className }: { retrying: boolean; onRetry?: () => void; compact: boolean; className?: string }) {
  const t = useT()
  return (
    <div role="alert" className={cn('glass-flat flex h-[82px] items-center gap-3 rounded-full border-coral/35 py-2 pl-2.5', compact ? 'pr-3' : 'pr-4', className)}>
      <span className="grid size-[60px] shrink-0 place-items-center rounded-full bg-coral/15 text-coral shadow-[inset_0_0_0_1px_rgb(255_84_112/0.35)]">
        <Icon name="wifi-off" size={24} strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] leading-tight font-extrabold text-white">{t('round.dock.audioFailed')}</p>
        <p className="mt-0.5 truncate text-[12px] font-semibold text-ink-300">{t('round.dock.audioFailedBody')}</p>
      </div>
      {onRetry &&
        (compact ? (
          <IconButton icon="refresh" label={t('round.dock.retryAudio')} variant="danger" size="md" loading={retrying} onClick={onRetry} tooltip={false} />
        ) : (
          <Button size="sm" variant="danger" leftIcon="refresh" loading={retrying} onClick={onRetry} className="shrink-0">
            {t('round.retry')}
          </Button>
        ))}
    </div>
  )
}
