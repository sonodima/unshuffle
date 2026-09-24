// Connection chrome, mounted once by the app shell:
// - top banner while the link is being re-established (non-blocking; under the
//   play HUD when there is one, so timer, round and score stay readable);
// - host-only warning when the signaling server is gone (the game goes on);
// - one blocking dialog when a client lost the host for good. Its copy depends on
//   where the player was (lobby / game / final) and why (network / host gone), and
//   a failed "Riprova" turns the same dialog into "the room is gone" (no second dialog);
// - notice after being dropped out of a room (kicked, room closed, …).

import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { STORE_MESSAGES, useGame } from '../../game/store'
import type { Role } from '../../game/store'
import { msgKey, tm } from '../../i18n'
import type { Msg } from '../../i18n'
import { rich, useT } from '../../i18n/react'
import { Button, Icon, Modal, Spinner, cn } from '../ui'
import type { IconName } from '../ui'
import { exitNoticeCopy, exitReasonFor, isHostGoneMessage, lostContextFor, lostDialogCopy } from './connectionCopy'
import type { DialogCopy, ExitReason, LostCause, LostContext } from './connectionCopy'
import { setBannerBox, useHudBottom } from './hudInset'
import type { BannerBox } from './hudInset'

// ---------------------------------------------------------------------------
// Presentational pieces (props only)

type BannerTone = 'warning' | 'danger' | 'info'

const BANNER_TONE: Record<BannerTone, { ring: string; chip: string; glow: string }> = {
  warning: { ring: 'border-gold/35', chip: 'bg-gold/15 text-gold', glow: 'shadow-[0_10px_40px_-12px_rgb(255_210_63/0.45)]' },
  danger: { ring: 'border-coral/40', chip: 'bg-coral/15 text-coral', glow: 'shadow-[0_10px_40px_-12px_rgb(255_84_112/0.5)]' },
  info: { ring: 'border-cyan/30', chip: 'bg-cyan/15 text-cyan', glow: 'shadow-[0_10px_40px_-12px_rgb(46_230_255/0.4)]' },
}

/** Gap between a pinned HUD and the banner under it. */
const UNDER_HUD_GAP = 8

interface StatusBannerProps {
  tone?: BannerTone
  /** Spinner instead of an icon. */
  busy?: boolean
  icon?: IconName
  title: ReactNode
  detail?: ReactNode
  /** Small trailing text (e.g. elapsed seconds). */
  meta?: ReactNode
  /** A small non-blocking action at the end of the pill (e.g. "Esci" during a long wait). */
  action?: { label: string; onClick(): void }
  onDismiss?(): void
  /** Bottom edge (viewport px) of a pinned HUD to sit under, instead of the top of the screen. */
  belowHud?: number | null
  /** Reports where the banner sits (viewport px) while shown, null when it leaves. */
  onMeasure?(box: BannerBox | null): void
}

/** Floating status pill (top-center, safe-area aware). Render inside AnimatePresence. */
function StatusBanner({ tone = 'warning', busy, icon = 'wifi-off', title, detail, meta, action, onDismiss, belowHud, onMeasure }: StatusBannerProps) {
  const t = useT()
  const look = BANNER_TONE[tone]
  const under = belowHud != null
  const present = useIsPresent()
  const outerRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef(onMeasure)
  useLayoutEffect(() => {
    measureRef.current = onMeasure
  })

  // Layout values (not the rect): the entrance spring moves the pill, not where it lands.
  useLayoutEffect(() => {
    const report = measureRef.current
    if (!report) return
    if (!present) {
      report(null)
      return
    }
    const outer = outerRef.current
    const pill = pillRef.current
    if (!outer || !pill) return
    const update = () => {
      // The outer strip spans the viewport (inset-x-0): offsets are viewport x.
      const top = parseFloat(getComputedStyle(outer).top)
      measureRef.current?.(Number.isFinite(top) ? { bottom: top + pill.offsetHeight, left: pill.offsetLeft, right: pill.offsetLeft + pill.offsetWidth } : null)
    }
    update()
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null
    ro?.observe(pill)
    window.addEventListener('resize', update)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [present, belowHud])
  useEffect(() => () => measureRef.current?.(null), [])

  return (
    <motion.div
      ref={outerRef}
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: -28, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 520, damping: 34 }}
      // Phones: keep both top corners free, where screens keep their back / leave button
      // (left) and the sound control (right). Under a HUD the whole width is free.
      className={cn(
        'pointer-events-none fixed inset-x-0 z-[750] flex justify-center',
        under ? 'px-safe-3' : 'top-safe-3 px-16 sm:top-safe-5 sm:px-3',
      )}
      style={under ? { top: belowHud + UNDER_HUD_GAP } : undefined}
    >
      <div
        ref={pillRef}
        className={cn(
          'glass-flat pointer-events-auto flex max-w-[min(100%,480px)] items-center gap-3 border bg-ink-900/88! py-2 pr-2 pl-2',
          detail != null ? 'rounded-[26px]' : 'rounded-full',
          !onDismiss && !action && 'pr-5',
          look.ring,
          look.glow,
        )}
      >
        <span className={cn('grid size-9 shrink-0 place-items-center rounded-full', look.chip)}>
          {busy ? <Spinner size={18} label={null} /> : <Icon name={icon} size={18} strokeWidth={2.4} />}
        </span>
        <div className="min-w-0 py-0.5">
          {/* The title may truncate; the meta (elapsed seconds) never does. */}
          <p className="flex min-w-0 items-baseline gap-2 text-[13px] leading-tight font-extrabold text-ink-50 sm:text-sm">
            <span className="min-w-0 truncate">{title}</span>
            {meta != null && <span className="num shrink-0 text-xs font-bold text-ink-400">{meta}</span>}
          </p>
          {detail != null && <p className="line-clamp-2 text-xs leading-snug text-ink-300">{detail}</p>}
        </div>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="hit-slop relative ml-1 h-9 shrink-0 rounded-full bg-white/[0.08] px-3.5 text-xs font-extrabold text-ink-50 ring-1 ring-white/15 transition-colors hover:bg-white/15"
          >
            {action.label}
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            aria-label={t('shell.banner.dismiss')}
            onClick={onDismiss}
            className="grid size-9 shrink-0 place-items-center rounded-full text-ink-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Icon name="x" size={16} strokeWidth={2.6} />
          </button>
        )}
      </div>
    </motion.div>
  )
}

/** The icon + room code + hint well shared by the connection dialogs. */
function DialogWell({ copy, code, pulse }: { copy: DialogCopy; code: string | null; pulse?: boolean }) {
  const t = useT()
  return (
    <motion.div
      key={copy.title}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      className="flex items-center gap-4 rounded-block bg-ink-950/45 p-4 shadow-well"
    >
      <span
        className={cn(
          'relative grid size-12 shrink-0 place-items-center rounded-full',
          copy.tone === 'coral' ? 'bg-coral/15 text-coral' : 'bg-violet/20 text-violet-bright',
        )}
      >
        {pulse && <span aria-hidden className="absolute inset-0 animate-pulse-ring rounded-full border-2 border-coral/50" />}
        <Icon name={copy.icon} size={22} strokeWidth={2.4} />
      </span>
      <div className="min-w-0">
        {code && (
          <p className="eyebrow">{rich(t('shell.dialogRoom', { code }), { b: (c) => <span className="num text-ink-100">{c}</span> })}</p>
        )}
        <p className="mt-1 text-sm leading-snug text-pretty text-ink-200">{copy.hint}</p>
      </div>
    </motion.div>
  )
}

interface ConnectionLostDialogProps {
  open: boolean
  role: Role
  code: string | null
  /** Store error; shown only when no retry is possible (the context copy says the rest). */
  message: Msg | null
  retrying?: boolean
  onRetry?(): void
  /** Leave the room (or, after a failed retry, close the dialog: home is already behind it). */
  onHome(): void
  /** Where the player was. Default 'game'. */
  context?: LostContext
  /** Why the link is gone. Default 'network'. */
  cause?: LostCause
  /** "Riprova" failed: the same dialog explains why, with home as the only way out. */
  failure?: ExitNotice | null
}

/** Blocking dialog: the link to the host is gone (the transport's own retries ran out). */
function ConnectionLostDialog({
  open,
  role,
  code,
  message,
  retrying,
  onRetry,
  onHome,
  context = 'game',
  cause = 'network',
  failure = null,
}: ConnectionLostDialogProps) {
  const t = useT()
  const copy = failure ? exitNoticeCopy(failure.reason, failure.message) : lostDialogCopy(context, cause, role === 'client' && !!onRetry)
  const description = !failure && !copy.canRetry && cause === 'network' && message ? tm(message) : copy.description
  const shownCode = failure?.code ?? code
  return (
    <Modal
      open={open}
      onClose={failure ? onHome : () => {}}
      dismissible={!!failure}
      hideCloseButton
      size="md"
      title={copy.title}
      description={description}
      footer={
        copy.canRetry ? (
          <>
            <Button variant="glass" leftIcon="home" onClick={onHome}>
              {t('shell.action.home')}
            </Button>
            <Button variant="primary" leftIcon="refresh" loading={retrying} onClick={onRetry}>
              {t('shell.action.retry')}
            </Button>
          </>
        ) : (
          <Button variant="primary" leftIcon="home" onClick={onHome}>
            {t('shell.action.home')}
          </Button>
        )
      }
    >
      <DialogWell copy={copy} code={shownCode} pulse={!failure && copy.canRetry} />
    </Modal>
  )
}

interface ExitNotice {
  reason: ExitReason
  /** The store error that came with it (translated where it is shown). */
  message: Msg | null
  code: string | null
}

interface ExitNoticeDialogProps {
  notice: ExitNotice | null
  open: boolean
  onClose(): void
}

/** Explains why we are back home after being dropped out of a room. */
function ExitNoticeDialog({ notice, open, onClose }: ExitNoticeDialogProps) {
  const t = useT()
  const copy = exitNoticeCopy(notice?.reason ?? 'other', notice?.message)
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={copy.title}
      description={copy.description || undefined}
      footer={
        <Button variant="primary" onClick={onClose}>
          {t('shell.action.ok')}
        </Button>
      }
    >
      <DialogWell copy={copy} code={notice?.code ?? null} />
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Connected overlay

function useElapsedSeconds(active: boolean): number {
  const [since, setSince] = useState<number | null>(null)
  const [, force] = useState(0)
  useEffect(() => {
    if (!active) {
      setSince(null)
      return
    }
    setSince(Date.now())
    const id = setInterval(() => force((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [active])
  return since == null ? 0 : Math.max(0, Math.floor((Date.now() - since) / 1000))
}

/** The host warning is informative, not actionable: it steps aside after a while. */
const HOST_WARNING_MS = 9000
/** A reconnect that takes longer than this also says it will resume by itself. */
const RECONNECT_DETAIL_AFTER_S = 5
/**
 * After this the transport is in its slow phase (a retry every ~5 s for up to 3 min, so a
 * phone host that switched apps can come back): say we're waiting, and offer a way out.
 */
const RECONNECT_SLOW_AFTER_S = 30

/** True while `key` is non-null and younger than `ms`; a new key (by identity) shows it again. */
function useAutoHide<K>(key: K | null, ms: number): boolean {
  const [expired, setExpired] = useState<K | null>(null)
  useEffect(() => {
    if (key === null) {
      setExpired(null)
      return
    }
    const id = setTimeout(() => setExpired(key), ms)
    return () => clearTimeout(id)
  }, [key, ms])
  return key !== null && expired !== key
}

export function ConnectionOverlay() {
  const t = useT()
  const role = useGame((s) => s.role)
  const connection = useGame((s) => s.connection)
  const error = useGame((s) => s.error)
  const inRoom = useGame((s) => s.room !== null)
  const code = useGame((s) => s.room?.code ?? s.roomCode)
  const phaseKind = useGame((s) => s.room?.phase.kind ?? null)
  const hud = useHudBottom()

  const [retrying, setRetrying] = useState(false)
  const retryingRef = useRef(false)
  const [failure, setFailure] = useState<ExitNotice | null>(null)
  const [notice, setNotice] = useState<ExitNotice | null>(null)
  const [noticeOpen, setNoticeOpen] = useState(false)

  // Dropped out of a room (reject, or a failed rejoin): explain why once.
  useEffect(
    () =>
      useGame.subscribe((s, prev) => {
        if (prev.room && !s.room && s.role === 'none' && s.error) {
          const next: ExitNotice = { reason: exitReasonFor(s.error, s.connection), message: s.error, code: prev.room.code }
          // Our own "Riprova" failed: the lost dialog turns into the answer (no second dialog).
          if (retryingRef.current) setFailure(next)
          else {
            setNotice(next)
            setNoticeOpen(true)
          }
        }
      }),
    [],
  )

  const linkDown = inRoom && role !== 'none' && (connection === 'reconnecting' || connection === 'connecting')
  const lost = inRoom && role !== 'none' && (connection === 'closed' || connection === 'error')
  const cause: LostCause = isHostGoneMessage(error) ? 'host-gone' : 'network'
  const context = lostContextFor(phaseKind ? { kind: phaseKind } : null)
  const dialogOpen = lost || retrying || failure !== null
  const hostWarningActive = inRoom && role === 'host' && connection === 'open' && !!error
  const hostWarning = useAutoHide(hostWarningActive ? error : null, HOST_WARNING_MS)
  const elapsed = useElapsedSeconds(linkDown && !dialogOpen)

  const leave = () => {
    retryingRef.current = false
    setRetrying(false)
    setFailure(null)
    try {
      useGame.getState().leave()
    } catch (err) {
      console.warn('[shell] leave failed', err)
    }
  }

  const retry = () => {
    if (retryingRef.current) return
    retryingRef.current = true
    setRetrying(true)
    let pending: Promise<void>
    try {
      pending = Promise.resolve(useGame.getState().rejoin())
    } catch (err) {
      pending = Promise.reject(err)
    }
    // Failures surface through the store (room dropped + error) → `failure` above.
    pending
      .catch(() => {})
      .finally(() => {
        retryingRef.current = false
        setRetrying(false)
      })
  }

  /** Clear the store error only if it is still the one we are showing (Home may have a newer one). */
  const clearShownError = (message: Msg | null | undefined) => {
    try {
      const st = useGame.getState()
      if (message && st.error === message) st.clearError()
    } catch {
      // ignore
    }
  }

  const closeFailure = () => {
    const shown = failure
    setFailure(null)
    clearShownError(shown?.message)
  }

  const closeNotice = () => {
    setNoticeOpen(false)
    clearShownError(notice?.message)
  }

  const meta = elapsed >= 2 ? t('shell.banner.elapsed', { seconds: elapsed }) : undefined
  let banner: ReactNode = null
  if (linkDown && !dialogOpen) {
    banner =
      role === 'host' ? (
        <StatusBanner
          key="link"
          busy
          tone="warning"
          title={t('shell.banner.hostReconnecting')}
          detail={t('shell.banner.hostReconnectingDetail')}
          meta={meta}
          belowHud={hud}
          onMeasure={setBannerBox}
        />
      ) : connection === 'connecting' ? (
        <StatusBanner key="link" busy tone="warning" title={t('shell.banner.connecting')} meta={meta} belowHud={hud} onMeasure={setBannerBox} />
      ) : (
        <StatusBanner
          key="link"
          busy
          tone="warning"
          title={t(elapsed >= RECONNECT_SLOW_AFTER_S ? 'shell.banner.hostSilent' : 'shell.banner.lost')}
          // Short enough for the phone pill between the header's corner buttons.
          detail={t(
            elapsed >= RECONNECT_SLOW_AFTER_S
              ? 'shell.banner.hostSilentDetail'
              : elapsed >= RECONNECT_DETAIL_AFTER_S
                ? 'shell.banner.lostDetailLong'
                : 'shell.banner.lostDetail',
          )}
          meta={meta}
          action={elapsed >= RECONNECT_SLOW_AFTER_S ? { label: t('shell.banner.leave'), onClick: leave } : undefined}
          belowHud={hud}
          onMeasure={setBannerBox}
        />
      )
  } else if (hostWarning) {
    const signaling = msgKey(error) === STORE_MESSAGES.signalingLost
    banner = (
      <StatusBanner
        key="host-warn"
        tone="warning"
        icon={signaling ? 'wifi-off' : 'alert'}
        title={t(signaling ? 'shell.banner.signalingTitle' : 'shell.banner.warning')}
        detail={signaling ? t('shell.banner.signalingDetail') : tm(error)}
        onDismiss={() => clearShownError(error)}
        belowHud={hud}
        onMeasure={setBannerBox}
      />
    )
  }

  return (
    <>
      <AnimatePresence>{banner}</AnimatePresence>
      <ConnectionLostDialog
        open={dialogOpen}
        role={role}
        code={code}
        message={error}
        retrying={retrying}
        onRetry={retry}
        onHome={failure ? closeFailure : leave}
        context={context}
        cause={cause}
        failure={failure}
      />
      <ExitNoticeDialog notice={notice} open={noticeOpen && !dialogOpen} onClose={closeNotice} />
    </>
  )
}
