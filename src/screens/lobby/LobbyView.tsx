import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { SoundControls } from '../../components/shell/SoundControls'
import { Button, Icon, IconButton, LanguagePicker, Logo, Modal, cn, useCanHover, useMediaQuery, type IconName } from '../../components/ui'
import type { GameSettings, PlayerId, PlaylistRef, RoomState } from '../../game/types'
import { formatNumber, type MessageKey, type Msg } from '../../i18n'
import { useT } from '../../i18n/react'
import { HowToPlay } from './HowToPlay'
import { buildJoinUrl, copyText } from './invite'
import { PlayerList, type ProfilePatch } from './PlayerList'
import { PlaylistHero } from './PlaylistHero'
import { PlaylistPicker } from './PlaylistPicker'
import { RoomCodeCard } from './RoomCodeCard'
import { SettingsPanel } from './SettingsPanel'
import { StartBar } from './StartBar'
import './lobby.css'

type LobbyTab = 'players' | 'playlist' | 'rules'

interface LobbyViewProps {
  room: RoomState
  /** My player id. */
  me: PlayerId
  /** Default: room.hostId === me. */
  isHost?: boolean
  onUpdateSettings(patch: Partial<GameSettings>): void
  /** Rejects with an AppError whose message is shown inline. */
  onStart(): Promise<void>
  onKick(playerId: PlayerId): void
  onLeave(): void
  /** Short local toast (e.g. "Link della stanza copiato!"). */
  onNotify?(message: Msg): void
  /** Enables editing your own name / avatar from the player list. */
  onEditProfile?(patch: ProfilePatch): void
  /** Emoji reactions row (the shell's ReactionBar), placed under the player list. */
  reactions?: ReactNode
}

/** Lobby: room code, players, playlist and rules; host starts the game. Pure: renders from props. */
export function LobbyView({
  room,
  me,
  isHost: isHostProp,
  onUpdateSettings,
  onStart,
  onKick,
  onLeave,
  onNotify,
  onEditProfile,
  reactions,
}: LobbyViewProps) {
  const t = useT()
  const wide = useMediaQuery('(min-width: 1024px)')
  const xl = useMediaQuery('(min-width: 1280px)')
  // Laptops at 1280×720 / 1366×768: slimmer header, dock and rules, compact code card, so the controls clear the dock.
  const short = useMediaQuery('(max-height: 800px)')
  const dense = wide && short
  const isHost = isHostProp ?? room.hostId === me
  const joinUrl = buildJoinUrl(room.code)
  const { settings, players } = room
  // Phones: a host without a playlist starts on the picker, everyone else on the players.
  const [tab, setTab] = useState<LobbyTab>(isHost && !settings.playlist ? 'playlist' : 'players')
  const [leaveOpen, setLeaveOpen] = useState(false)
  // Touch only: a narrow desktop window has no virtual keyboard, and hiding the CTA there would just get in the way.
  const canHover = useCanHover()
  const typing = useTypingInLobby(!wide && !canHover)
  const three = wide && xl
  const layoutKey = wide ? `${three ? 'three' : 'two'}-${isHost ? 'host' : 'guest'}-${dense ? 'dense' : 'regular'}` : null
  const reserve = DOCK_TOP_GAP_PX + (dense ? DOCK_DENSE_PX : DOCK_PX)
  const leftRef = useRef<HTMLDivElement>(null)
  const leftFits = useFitsViewport(leftRef, reserve, layoutKey)
  const centerRef = useRef<HTMLDivElement>(null)
  const centerFits = useFitsViewport(centerRef, reserve, three && !isHost ? layoutKey : null)
  const rightRef = useRef<HTMLDivElement>(null)
  const rightFits = useFitsViewport(rightRef, reserve, three ? layoutKey : null)

  const selectPlaylist = (playlist: PlaylistRef) => onUpdateSettings({ playlist })
  const invite = () => {
    void copyText(joinUrl).then((ok) => onNotify?.(ok ? 'lobby.invite.linkCopied' : 'lobby.invite.copyFailed'))
  }

  const playerList = (
    <PlayerList
      players={players}
      me={me}
      canKick={isHost}
      onKick={onKick}
      onInvite={invite}
      onEditProfile={onEditProfile}
      footer={reactions}
    />
  )
  const codeCard = <RoomCodeCard code={room.code} joinUrl={joinUrl} variant={wide && !dense ? 'full' : 'compact'} />
  const settingsPanel = <SettingsPanel settings={settings} editable={isHost} onChange={onUpdateSettings} density={dense ? 'compact' : 'regular'} />
  // The chosen playlist is shown by the start bar's record (and the ✓ in the grid): no separate hero for the host.
  const picker = isHost && (
    <section aria-label={t('lobby.picker.title')} className="glass-flat @container rounded-panel p-4 sm:p-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="display display-skew text-lg whitespace-nowrap text-ink-50 sm:text-xl">{t('lobby.picker.title')}</h2>
        <span className="hidden min-w-0 truncate text-xs font-semibold text-ink-400 @min-[34rem]:block">{t('lobby.picker.source')}</span>
      </div>
      <PlaylistPicker selected={settings.playlist} onSelect={selectPlaylist} />
    </section>
  )
  const gap = dense ? 'gap-5' : 'gap-6'
  const maxW = three ? 'max-w-[1440px]' : 'max-w-[1360px]'
  const side = 'clamp(300px,26vw,368px)'

  return (
    <div className="relative flex h-dvh flex-col overflow-x-hidden overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
      <Header isHost={isHost} wide={wide} dense={dense} maxW={maxW} onLeave={() => setLeaveOpen(true)} />

      {three && isHost ? (
        // Host, large screens: players | picker (centre stage) | rules.
        <main className={cn('mx-auto grid w-full flex-1 items-start px-8 pt-2 pb-8', maxW, gap)} style={{ gridTemplateColumns: `${side} minmax(0,1fr) ${side}` }}>
          <div ref={leftRef} className={cn('flex flex-col', gap, leftFits && 'sticky top-4')}>
            <Reveal delay={0}>{codeCard}</Reveal>
            <Reveal delay={0.06}>{playerList}</Reveal>
          </div>
          <Reveal delay={0.1} className="min-w-0">
            {picker}
          </Reveal>
          <div ref={rightRef} className={cn('flex flex-col', gap, rightFits && 'sticky top-4')}>
            <Reveal delay={0.14}>{settingsPanel}</Reveal>
          </div>
        </main>
      ) : three ? (
        // Guest, large screens: players | the record + how to play | rules (read-only).
        <main className={cn('mx-auto grid w-full flex-1 items-start px-8 pt-2 pb-8', maxW, gap)} style={{ gridTemplateColumns: `${side} minmax(0,1fr) ${side}` }}>
          <div ref={leftRef} className={cn('flex flex-col', gap, leftFits && 'sticky top-4')}>
            <Reveal delay={0}>{codeCard}</Reveal>
            <Reveal delay={0.06}>{playerList}</Reveal>
          </div>
          <div ref={centerRef} className={cn('flex min-w-0 flex-col', gap, centerFits && 'sticky top-4')}>
            <Reveal delay={0.1}>
              <PlaylistHero playlist={settings.playlist} isHost={false} layout="row" size={dense ? 120 : 150} />
            </Reveal>
            <Reveal delay={0.16}>
              <HowToPlay settings={settings} />
            </Reveal>
          </div>
          <div ref={rightRef} className={cn('flex flex-col', gap, rightFits && 'sticky top-4')}>
            <Reveal delay={0.14}>{settingsPanel}</Reveal>
          </div>
        </main>
      ) : wide ? (
        <main className={cn('mx-auto grid w-full flex-1 grid-cols-[minmax(340px,400px)_minmax(0,1fr)] items-start px-8 pt-2 pb-8', maxW, gap)}>
          <div ref={leftRef} className={cn('flex flex-col', gap, leftFits && 'sticky top-4')}>
            <Reveal delay={0}>{codeCard}</Reveal>
            <Reveal delay={0.06}>{playerList}</Reveal>
            {/* Host: the picker gets the whole right column; the rules follow the players. */}
            {isHost && <Reveal delay={0.12}>{settingsPanel}</Reveal>}
          </div>
          <div className={cn('flex min-w-0 flex-col', gap)}>
            {isHost ? (
              <Reveal delay={0.1}>{picker}</Reveal>
            ) : (
              <>
                <Reveal delay={0.1}>
                  <PlaylistHero playlist={settings.playlist} isHost={false} layout="row" />
                </Reveal>
                <Reveal delay={0.14}>{settingsPanel}</Reveal>
                <Reveal delay={0.18}>
                  <HowToPlay settings={settings} />
                </Reveal>
              </>
            )}
          </div>
        </main>
      ) : (
        <main className="flex w-full flex-1 flex-col px-safe-4 pb-6 sm:px-safe-6">
          <Reveal delay={0}>{codeCard}</Reveal>
          {/* The "!" nudge is for the host only: guests can't pick. */}
          <Tabs tab={tab} onTab={setTab} playerCount={players.length} needsPlaylist={isHost && !settings.playlist} />
          <TabPanel id="players" tab={tab}>
            <div className="flex flex-col gap-4">
              {playerList}
              {!isHost && <HowToPlay settings={settings} />}
            </div>
          </TabPanel>
          <TabPanel id="playlist" tab={tab}>
            {/* Host: just the picker (the sheet below shows the chosen record; a hero here would shove the grid down under the finger). */}
            {isHost ? picker : <PlaylistHero playlist={settings.playlist} isHost={false} layout="column" />}
          </TabPanel>
          <TabPanel id="rules" tab={tab}>
            {settingsPanel}
          </TabPanel>
        </main>
      )}

      <div
        inert={typing || undefined}
        className={cn(
          'sticky bottom-0 z-30 transition-[translate,opacity] duration-300 ease-out',
          wide && cn('mx-auto w-full px-8', dense ? 'pb-safe-4' : 'pb-safe-5', maxW),
          // Phones: out of the way while typing, so a resizes-content keyboard doesn't pin it over the search field.
          typing && 'pointer-events-none translate-y-full opacity-0 motion-reduce:translate-y-0',
        )}
      >
        {wide && <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-10 bottom-0 bg-linear-to-b from-transparent to-ink-950/70" />}
        <StartBar
          isHost={isHost}
          settings={settings}
          players={players}
          hostId={room.hostId}
          onStart={onStart}
          onUpdateSettings={onUpdateSettings}
          variant={wide ? 'dock' : 'sheet'}
          dense={dense}
        />
      </div>

      <Modal
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        size="sm"
        title={t(isHost ? 'lobby.leave.hostTitle' : 'lobby.leave.guestTitle')}
        description={
          isHost
            ? t(players.length > 1 ? 'lobby.leave.hostBody' : 'lobby.leave.hostAloneBody')
            : t('lobby.leave.guestBody', { code: room.code })
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setLeaveOpen(false)}>
              {t('lobby.leave.stay')}
            </Button>
            <Button
              variant="danger"
              leftIcon="logout"
              onClick={() => {
                setLeaveOpen(false)
                onLeave()
              }}
            >
              {t(isHost ? 'lobby.leave.closeRoom' : 'lobby.leave.exit')}
            </Button>
          </>
        }
      />
    </div>
  )
}

/** Sticky top offset (top-4) of a sticky column. */
const DOCK_TOP_GAP_PX = 16
/** Start dock height incl. its bottom padding (regular / dense), kept free under a sticky column. */
const DOCK_PX = 132
const DOCK_DENSE_PX = 112

/** True while the element is short enough to stay fully visible when sticky. `layout` null = off; changing it re-measures. */
function useFitsViewport(ref: RefObject<HTMLElement | null>, reserve: number, layout: string | null): boolean {
  const [fits, setFits] = useState(false)
  const enabled = layout !== null
  useEffect(() => {
    const el = ref.current
    if (!enabled || !el) return
    const check = () => setFits(el.offsetHeight + reserve <= window.innerHeight)
    check()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null
    ro?.observe(el)
    window.addEventListener('resize', check)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', check)
    }
  }, [ref, reserve, enabled, layout])
  return enabled && fits
}

const NON_TEXT_INPUTS = new Set(['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'])

function isTextField(el: EventTarget | null): el is HTMLElement {
  if (el instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(el.type) && !el.readOnly
  return el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable)
}

/**
 * Phones: true while a text field in the page has focus (a virtual keyboard is
 * probably up). When the keyboard resizes the layout viewport
 * (`interactive-widget=resizes-content`, Firefox / Samsung Internet), the
 * focused field is scrolled back to the middle of what is left.
 */
function useTypingInLobby(enabled: boolean): boolean {
  const [typing, setTyping] = useState(false)
  useEffect(() => {
    if (!enabled) return
    const sync = () => setTyping(isTextField(document.activeElement))
    const onFocusIn = (e: FocusEvent) => {
      if (isTextField(e.target)) setTyping(true)
    }
    // focusout fires before the next element gets focus: re-check once it has.
    const onFocusOut = () => queueMicrotask(sync)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    sync()
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [enabled])
  useEffect(() => {
    if (!enabled || !typing) return
    let raf = 0
    const onResize = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const el = document.activeElement
        if (isTextField(el)) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      })
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [enabled, typing])
  return enabled && typing
}

function Header({ isHost, wide, dense, maxW, onLeave }: { isHost: boolean; wide: boolean; dense: boolean; maxW: string; onLeave(): void }) {
  const t = useT()
  return (
    <header className={cn('shrink-0', wide ? cn('mx-auto w-full px-8', maxW) : 'px-safe-4 pt-safe sm:px-safe-6')}>
      <div className={cn('relative flex items-center', wide && !dense ? 'h-20' : 'h-16')}>
        {wide ? (
          <Button variant="glass" size="sm" leftIcon="logout" onClick={onLeave} className="relative z-10">
            {t(isHost ? 'lobby.leave.closeRoom' : 'lobby.leave.exit')}
          </Button>
        ) : (
          <IconButton icon="arrow-left" label={t(isHost ? 'lobby.leave.closeRoom' : 'lobby.leave.exitRoom')} size="sm" onClick={onLeave} tooltip={false} className="relative z-10" />
        )}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto flex items-center gap-3">
            <Logo size={wide ? 'md' : 'sm'} />
            <span className="hidden rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-extrabold tracking-[0.16em] text-ink-200 uppercase sm:inline">
              {t('lobby.header.badge')}
            </span>
          </div>
        </div>
        {/* In the header (not floating): they scroll away with it instead of covering sticky columns / tabs. */}
        <div className="relative z-10 ml-auto flex items-center gap-2">
          <LanguagePicker compact={!wide} />
          <SoundControls placement="inline" />
        </div>
      </div>
    </header>
  )
}

const TABS: { id: LobbyTab; label: MessageKey; icon: IconName }[] = [
  { id: 'players', label: 'lobby.tabs.players', icon: 'users' },
  { id: 'playlist', label: 'lobby.tabs.playlist', icon: 'music' },
  { id: 'rules', label: 'lobby.tabs.rules', icon: 'settings' },
]

function Tabs({ tab, onTab, playerCount, needsPlaylist }: { tab: LobbyTab; onTab(t: LobbyTab): void; playerCount: number; needsPlaylist: boolean }) {
  const t = useT()
  const reduce = useReducedMotion()
  const layoutId = useId()
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const move = (dir: number) => {
    const i = TABS.findIndex((x) => x.id === tab)
    const next = TABS[(i + dir + TABS.length) % TABS.length]
    onTab(next.id)
    refs.current[next.id]?.focus()
  }
  // Backdrop only once the bar is stuck to the top (a sentinel just above it left the viewport).
  const sentinel = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    const el = sentinel.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <>
    <div ref={sentinel} aria-hidden className="h-px" />
    <div className="sticky top-0 z-20 -mx-4 mt-3 px-4 pt-[max(var(--safe-top),8px)] pb-2 sm:-mx-6 sm:px-6">
      <div
        aria-hidden
        className={cn(
          'absolute inset-x-0 top-0 -bottom-4 bg-linear-to-b from-ink-950/90 via-ink-950/75 to-transparent transition-opacity duration-300',
          stuck ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        role="tablist"
        aria-label={t('lobby.tabs.label')}
        className="relative flex rounded-[20px] border border-white/[0.08] bg-ink-950/80 p-1 shadow-well"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') move(1)
          else if (e.key === 'ArrowLeft') move(-1)
          else return
          e.preventDefault()
        }}
      >
        {TABS.map((item) => {
          const selected = item.id === tab
          const badge = item.id === 'players' ? formatNumber(playerCount) : item.id === 'playlist' && needsPlaylist ? '!' : null
          return (
            <button
              key={item.id}
              ref={(el) => {
                refs.current[item.id] = el
              }}
              type="button"
              role="tab"
              id={`lobby-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`lobby-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onTab(item.id)}
              className="relative flex h-11 min-w-0 flex-1 basis-0 items-center justify-center gap-1.5 rounded-[16px] px-1 tap-none"
            >
              {selected && (
                <motion.span
                  layoutId={layoutId}
                  aria-hidden
                  className="absolute inset-0 rounded-[16px] bg-linear-to-b from-violet-bright to-violet-deep shadow-[inset_0_1px_0_rgb(255_255_255/0.4),inset_0_-2px_0_rgb(0_0_0/0.2),0_6px_18px_-6px_rgb(123_92_255/0.8)]"
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 38 }}
                />
              )}
              <Icon name={item.icon} size={15} strokeWidth={2.4} className={cn('relative shrink-0 max-[419px]:hidden', selected ? 'text-white' : 'text-ink-400')} />
              <span className={cn('relative truncate font-display text-[11px] font-bold tracking-wide uppercase max-[379px]:text-[10px] max-[379px]:tracking-normal', selected ? 'text-white' : 'text-ink-200')}>{t(item.label)}</span>
              {badge && (
                <span
                  className={cn(
                    'num relative grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full px-1 text-[10px] font-bold max-[379px]:h-4 max-[379px]:min-w-4',
                    badge === '!' ? 'bg-gold text-ink-950' : selected ? 'bg-white/25 text-white' : 'bg-white/10 text-ink-200',
                  )}
                >
                  <span aria-hidden>{badge}</span>
                  <span className="sr-only">{badge === '!' ? t('lobby.tabs.toPick') : t('lobby.tabs.playerCount', { count: playerCount })}</span>
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
    </>
  )
}

function TabPanel({ id, tab, children }: { id: LobbyTab; tab: LobbyTab; children: ReactNode }) {
  const active = id === tab
  // Panels stay mounted (search text, scroll positions survive tab switches).
  return (
    <div
      role="tabpanel"
      id={`lobby-panel-${id}`}
      aria-labelledby={`lobby-tab-${id}`}
      hidden={!active}
      className={cn('mt-2', active && 'animate-[lobby-tab-in_0.28s_var(--ease-out-expo)_both]')}
    >
      {children}
    </div>
  )
}

function Reveal({ children, delay, className }: { children: ReactNode; delay: number; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28, delay }}
    >
      {children}
    </motion.div>
  )
}
