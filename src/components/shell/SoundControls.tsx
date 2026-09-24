// Sound controls: one round glass button that opens a small popover with
// mute, master volume and the UI-sfx switch. Floating in the top-right corner
// by default; a screen can place an inline instance in its own header instead
// (<SoundControls placement="inline" />), which hides the floating one.
// The top-right floating button belongs to the page's header area: it slides
// away while the screen is scrolled down (it would cover content), and comes
// back at the top. Shortcut: M toggles mute (always).

import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { audioEngine } from '../../audio/engine'
import { useAudioUnlocked, usePlayback, useSfxEnabled, useVolume } from '../../audio/usePlayback'
import { useGame } from '../../game/store'
import { Equalizer, Icon, IconButton, Kbd, cn, playSfx, useIsWide, useMediaQuery } from '../ui'
import type { ScreenKey } from './routing'
import { useScrolledAway } from './screenScroll'
import { floatingDock, useCurrentScreen } from './shellState'
import './shell.css'

// ---------------------------------------------------------------------------
// Inline-instance registry (a mounted inline control hides the floating one)

let inlineCount = 0
const inlineListeners = new Set<() => void>()
function setInline(delta: number): void {
  inlineCount = Math.max(0, inlineCount + delta)
  for (const l of [...inlineListeners]) l()
}
function subscribeInline(l: () => void): () => void {
  inlineListeners.add(l)
  return () => {
    inlineListeners.delete(l)
  }
}
const getInline = () => inlineCount

// ---------------------------------------------------------------------------
// Mute with memory of the last audible volume

const UNMUTED_KEY = 'unshuffle:volume-unmuted'
const DEFAULT_UNMUTED = 0.8
const AUDIBLE = 0.02

function readUnmuted(): number {
  try {
    const v = Number(localStorage.getItem(UNMUTED_KEY))
    return Number.isFinite(v) && v > AUDIBLE && v <= 1 ? v : DEFAULT_UNMUTED
  } catch {
    return DEFAULT_UNMUTED
  }
}
function writeUnmuted(v: number): void {
  try {
    localStorage.setItem(UNMUTED_KEY, String(Math.round(v * 1000) / 1000))
  } catch {
    // storage unavailable: unmute falls back to the default level
  }
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}

/** [volume 0..1, muted, setVolume, toggleMute] — defensive over the audio engine. */
function useSoundLevel(): [number, boolean, (v: number) => void, () => void] {
  const [volume, setVol] = useVolume()
  const muted = volume <= AUDIBLE
  const setVolume = useCallback(
    (v: number) => {
      const next = Math.max(0, Math.min(1, v))
      if (next > AUDIBLE) writeUnmuted(next)
      safe(() => setVol(next), undefined)
    },
    [setVol],
  )
  const toggleMute = useCallback(() => {
    const current = safe(() => audioEngine.volume, 0)
    if (current > AUDIBLE) {
      writeUnmuted(current)
      safe(() => setVol(0), undefined)
    } else {
      safe(() => setVol(readUnmuted()), undefined)
    }
  }, [setVol])
  return [volume, muted, setVolume, toggleMute]
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  const tag = el.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag !== 'INPUT') return false
  const type = (el as HTMLInputElement).type
  return !['range', 'checkbox', 'radio', 'button', 'submit'].includes(type)
}

// ---------------------------------------------------------------------------
// Presentational pieces

function Switch({ checked, onChange, label, id }: { checked: boolean; onChange(next: boolean): void; label: string; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200',
        checked ? 'bg-lime shadow-[0_0_18px_-4px_rgb(166_255_63/0.7)]' : 'bg-white/12 shadow-well',
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 700, damping: 34 }}
        className={cn('block size-6 rounded-full shadow-[0_2px_6px_rgb(0_0_0/0.45)]', checked ? 'ml-auto bg-ink-950' : 'bg-ink-100')}
      />
    </button>
  )
}

interface SoundPanelProps {
  volume: number
  muted: boolean
  sfxOn: boolean
  onVolume(v: number): void
  onToggleMute(): void
  onSfx(on: boolean): void
  className?: string
}

/** The popover body. */
function SoundPanel({ volume, muted, sfxOn, onVolume, onToggleMute, onSfx, className }: SoundPanelProps) {
  const sfxId = useId()
  const pct = Math.round((muted ? 0 : volume) * 100)
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-center justify-between">
        <span className="eyebrow">Audio</span>
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-ink-400 pointer-coarse:hidden">
          Muto <Kbd>M</Kbd>
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? 'Riattiva audio' : 'Disattiva audio'}
          aria-pressed={muted}
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-full transition-colors',
            muted ? 'bg-coral/15 text-coral hover:bg-coral/25' : 'bg-white/8 text-ink-50 hover:bg-white/15',
          )}
        >
          <Icon name={muted ? 'mute' : 'volume'} size={20} strokeWidth={2.3} />
        </button>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={pct}
          aria-label="Volume"
          aria-valuetext={`${pct}%`}
          data-muted={muted}
          onChange={(e) => onVolume(Number(e.currentTarget.value) / 100)}
          className="ushf-range min-w-0 flex-1"
          style={{ ['--val' as string]: `${pct}%` }}
        />
        <span className="num w-9 shrink-0 text-right text-xs font-bold text-ink-200">{pct}%</span>
      </div>
      <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] py-2.5 pr-2.5 pl-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-violet/20 text-violet-bright">
          <Icon name="sparkles" size={16} strokeWidth={2.3} />
        </span>
        <label htmlFor={sfxId} className="min-w-0 flex-1 cursor-pointer">
          <span className="block text-sm leading-tight font-extrabold text-ink-50">Effetti sonori</span>
          <span className="block text-xs leading-snug text-ink-400">Click, timer, reazioni</span>
        </label>
        <Switch id={sfxId} checked={sfxOn} onChange={onSfx} label="Effetti sonori" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Connected control

interface SoundControlsProps {
  /** floating = fixed top-right corner (default, mounted once by the app shell) · inline = in the flow of a screen header. */
  placement?: 'floating' | 'inline'
  /** Popover alignment relative to the button (inline only). Default 'end'. */
  align?: 'start' | 'end'
  className?: string
}

export function SoundControls({ placement = 'floating', align = 'end', className }: SoundControlsProps) {
  const inlineMounted = useSyncExternalStore(subscribeInline, getInline, getInline)
  const inline = placement === 'inline'
  const screen = useCurrentScreen()
  const large = useMediaQuery('(min-width: 1180px)')
  const wide = useIsWide()
  const phaseKind = useGame((s) => s.room?.phase.kind ?? null)

  useEffect(() => {
    if (!inline) return
    setInline(1)
    return () => setInline(-1)
  }, [inline])

  if (inline) {
    return (
      <div className={cn('relative inline-flex', className)}>
        <SoundControlsInner align={align} allowPill={false} />
      </div>
    )
  }

  const dock = inlineMounted > 0 ? 'hidden' : floatingDock(screen, large ? 1180 : wide ? 640 : 0, phaseKind)
  return (
    <>
      {/* The M shortcut works even while the floating button is docked away. */}
      <MuteShortcut />
      <AnimatePresence>
        {dock !== 'hidden' && (
          <motion.div
            key={dock}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className={cn('fixed z-[700] flex items-start [--shell-edge:12px] sm:[--shell-edge:20px]', className)}
            style={
              dock === 'bottom-right'
                ? { bottom: 'calc(env(safe-area-inset-bottom, 0px) + var(--shell-edge))', right: 'calc(env(safe-area-inset-right, 0px) + var(--shell-edge))' }
                : { top: 'calc(env(safe-area-inset-top, 0px) + var(--shell-edge))', right: 'calc(env(safe-area-inset-right, 0px) + var(--shell-edge))' }
            }
          >
            <FloatingDock dock={dock} screen={screen} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/** The floating button's body; top-right it scrolls away with the page header. */
function FloatingDock({ dock, screen }: { dock: 'top-right' | 'bottom-right'; screen: ScreenKey }) {
  const away = useScrolledAway(dock === 'top-right')
  return (
    <motion.div
      className="flex items-start"
      initial={false}
      animate={away ? { y: -72, opacity: 0 } : { y: 0, opacity: 1 }}
      transition={away ? { type: 'spring', stiffness: 520, damping: 40 } : { type: 'spring', stiffness: 460, damping: 30 }}
      inert={away}
      aria-hidden={away || undefined}
      style={{ pointerEvents: away ? 'none' : undefined }}
    >
      <SoundControlsInner
        align="end"
        low={dock === 'bottom-right'}
        hidden={away}
        allowPill={dock === 'top-right' && (screen === 'home' || screen === 'lobby')}
      />
    </motion.div>
  )
}

/** Global "M" = mute toggle (never while typing, never with modifiers). */
function MuteShortcut() {
  const [, , , toggleMute] = useSoundLevel()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key !== 'm' && e.key !== 'M') return
      if (isTypingTarget(e.target)) return
      toggleMute()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleMute])
  return null
}

/** The "Attiva audio" pill steps down to a badge after a while (it only repeats what the badge says). */
const PILL_MS = 8000

const FOCUSABLE = 'button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])'

interface Anchor {
  top?: number
  bottom?: number
  left?: number
  right?: number
}

function SoundControlsInner({ align, allowPill, low = false, hidden = false }: { align: 'start' | 'end'; allowPill: boolean; low?: boolean; hidden?: boolean }) {
  const wide = useIsWide()
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const openedByKeyboard = useRef(false)
  const panelId = useId()
  const [volume, muted, setVolume, toggleMute] = useSoundLevel()
  const [sfxOn, setSfx] = useSfxEnabled()
  const unlocked = useAudioUnlocked()
  const inRoom = useGame((s) => s.role !== 'none')
  const playing = usePlayback().playing

  // The popover lives in a portal (inline hosts may clip overflow): pin it under the button.
  useLayoutEffect(() => {
    if (!open) return
    const update = () => {
      const r = buttonRef.current?.getBoundingClientRect()
      if (!r) return
      const vw = document.documentElement.clientWidth || window.innerWidth
      const vh = window.innerHeight
      // Docked low (bottom corner): open upwards.
      const vertical = r.top > vh / 2 ? { bottom: vh - r.top + 10 } : { top: r.bottom + 10 }
      setAnchor(align === 'end' ? { ...vertical, right: Math.max(12, vw - r.right) } : { ...vertical, left: Math.max(12, r.left) })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, align])

  const close = useCallback((refocus: boolean) => {
    setOpen(false)
    if (refocus) buttonRef.current?.focus({ preventScroll: true })
  }, [])

  // Docked away (the page scrolled under it): the popover goes with the button.
  useEffect(() => {
    if (hidden) setOpen(false)
  }, [hidden])

  // Close on outside press / Esc.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      close(true)
    }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open, close])

  // Keyboard users land inside the popover.
  useEffect(() => {
    if (!open || !anchor || !openedByKeyboard.current) return
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true })
  }, [open, anchor])

  // Tabbing out of either end closes it and returns to the button.
  const onPanelKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !panelRef.current) return
    const nodes = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    if ((e.shiftKey && document.activeElement === first) || (!e.shiftKey && document.activeElement === last)) {
      e.preventDefault()
      close(true)
    }
  }

  const needsUnlock = inRoom && !unlocked
  const [pillExpired, setPillExpired] = useState(false)
  useEffect(() => {
    if (!needsUnlock) {
      setPillExpired(false)
      return
    }
    const id = setTimeout(() => setPillExpired(true), PILL_MS)
    return () => clearTimeout(id)
  }, [needsUnlock])
  const showPill = needsUnlock && allowPill && wide && !pillExpired
  const onSfx = (on: boolean) => {
    safe(() => setSfx(on), undefined)
    if (on) playSfx('click')
  }

  return (
    <div ref={rootRef} className="relative flex items-center gap-2">
      <AnimatePresence>
        {showPill && !open && (
          <motion.button
            key="unlock"
            type="button"
            initial={{ opacity: 0, x: 12, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 8, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            onClick={() => void safe(() => audioEngine.unlock(), Promise.resolve()).catch(() => undefined)}
            title="Il browser blocca l’audio finché non tocchi la pagina"
            className={cn(
              'glass-flat relative flex h-9 items-center gap-2 rounded-full border-lime/40! bg-ink-900/85! pr-3.5 pl-2.5 text-xs font-extrabold text-lime sm:h-10',
              align === 'start' ? 'order-last' : '',
            )}
          >
            <span aria-hidden className="absolute inset-0 animate-glow rounded-full shadow-[0_0_22px_-2px_rgb(166_255_63/0.55)]" />
            <Icon name="headphones" size={16} strokeWidth={2.4} />
            <span className="whitespace-nowrap">Attiva audio</span>
          </motion.button>
        )}
      </AnimatePresence>
      <span className="relative inline-flex">
        <IconButton
          ref={buttonRef}
          label={needsUnlock ? 'Audio bloccato dal browser: tocca per attivarlo' : muted ? 'Audio disattivato' : 'Audio'}
          tooltip="Audio"
          tooltipSide={low ? 'top' : 'bottom'}
          shortcut="M"
          size={wide ? 'md' : 'sm'}
          variant="glass"
          sound={false}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={(e) => {
            openedByKeyboard.current = e.detail === 0
            setOpen((o) => !o)
          }}
          className={cn(open && '[--btn-face-hi:rgb(123_92_255/0.55)] [--btn-face:rgb(90_61_240/0.45)]', muted && 'text-coral')}
        >
          {muted ? (
            <Icon name="mute" size={wide ? 20 : 18} strokeWidth={2.3} />
          ) : playing ? (
            <Equalizer bars={4} size={wide ? 16 : 14} tone="current" label={null} />
          ) : (
            <Icon name="volume" size={wide ? 20 : 18} strokeWidth={2.3} />
          )}
        </IconButton>
        {/* Where the "Attiva audio" pill doesn't fit (or has done its job), a pulsing badge says the same. */}
        {needsUnlock && !showPill && (
          <span aria-hidden className="pointer-events-none absolute -top-0.5 -right-0.5 grid size-3.5 place-items-center">
            <span className="absolute inset-0 animate-pulse-ring rounded-full bg-lime/60" />
            <span className="relative size-2.5 rounded-full bg-lime shadow-[0_0_0_2px_var(--color-ink-950)]" />
          </span>
        )}
      </span>
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && anchor && (
              <motion.div
                ref={panelRef}
                id={panelId}
                role="dialog"
                aria-label="Impostazioni audio"
                onKeyDown={onPanelKey}
                initial={{ opacity: 0, y: anchor.bottom !== undefined ? 8 : -8, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: anchor.bottom !== undefined ? 6 : -6, scale: 0.96, transition: { duration: 0.12 } }}
                transition={{ type: 'spring', stiffness: 560, damping: 34 }}
                style={{ top: anchor.top, bottom: anchor.bottom, left: anchor.left, right: anchor.right }}
                className={cn(
                  'glass fixed z-[760] w-[288px] max-w-[calc(100vw-24px)] rounded-[22px] bg-ink-900/92! p-4',
                  anchor.bottom !== undefined ? (align === 'end' ? 'origin-bottom-right' : 'origin-bottom-left') : align === 'end' ? 'origin-top-right' : 'origin-top-left',
                )}
              >
                <SoundPanel volume={volume} muted={muted} sfxOn={sfxOn} onVolume={setVolume} onToggleMute={toggleMute} onSfx={onSfx} />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  )
}
