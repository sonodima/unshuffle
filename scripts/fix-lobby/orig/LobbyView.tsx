import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { SoundControls } from '../../components/shell/SoundControls'
import { Button, Icon, IconButton, Logo, Modal, cn, useMediaQuery, type IconName } from '../../components/ui'
import type { GameSettings, PlayerId, PlaylistRef, RoomState } from '../../game/types'
import type { PlaylistCatalog } from './catalog'
import { HowToPlay } from './HowToPlay'
import { buildJoinUrl, copyText } from './invite'
import { PlayerList, type ProfilePatch } from './PlayerList'
import { PlaylistHero } from './PlaylistHero'
import { PlaylistPicker } from './PlaylistPicker'
import { RoomCodeCard } from './RoomCodeCard'
import { SettingsPanel } from './SettingsPanel'
import { StartBar } from './StartBar'
import './lobby.css'

export type LobbyTab = 'players' | 'playlist' | 'rules'

export interface LobbyViewProps {
  room: RoomState
  /** My player id. */
  me: PlayerId
  /** Default: room.hostId === me. */
  isHost?: boolean
  /** Default: current origin + path + #/r/CODE. */
  joinUrl?: string
  onUpdateSettings(patch: Partial<GameSettings>): void
  /** Rejects with an Italian, user-facing message (shown inline). */
  onStart(): Promise<void>
  onKick(playerId: PlayerId): void
  onLeave(): void
  /** Short local toast (e.g. "Link copiato!"). */
  onNotify?(message: string): void
  /** Enables editing your own name / avatar from the player list. */
  onEditProfile?(patch: ProfilePatch): void
  /** Emoji reactions row (the shell's ReactionBar), placed under the player list. */
  reactions?: ReactNode
  /** Playlist data source (default: Deezer). */
  catalog?: PlaylistCatalog
  /** Phones: tab to open first (default: host without playlist → playlist, else players). */
  initialTab?: LobbyTab
}

/** Lobby: room code, players, playlist and rules; host starts the game. Pure: renders from props. */
export function LobbyView({
  room,
  me,
  isHost: isHostProp,
  joinUrl: joinUrlProp,
  onUpdateSettings,
  onStart,
  onKick,
  onLeave,
  onNotify,
  onEditProfile,
  reactions,
  catalog,
  initialTab,
}: LobbyViewProps) {
  const wide = useMediaQuery('(min-width: 1024px)')
  const xl = useMediaQuery('(min-width: 1280px)')
  const isHost = isHostProp ?? room.hostId === me
  const joinUrl = joinUrlProp ?? buildJoinUrl(room.code)
  const { settings, players } = room
  const searchRef = useRef<HTMLInputElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<LobbyTab>(initialTab ?? (isHost && !settings.playlist ? 'playlist' : 'players'))
  const [leaveOpen, setLeaveOpen] = useState(false)
  const leftRef = useRef<HTMLDivElement>(null)
  const layoutKey = wide ? `${isHost && xl ? 'three' : 'two'}` : null
  const leftFits = useFitsViewport(leftRef, DOCK_RESERVE_PX, layoutKey)
  const rightRef = useRef<HTMLDivElement>(null)
  const rightFits = useFitsViewport(rightRef, DOCK_RESERVE_PX, layoutKey === 'three' ? layoutKey : null)

  const selectPlaylist = (playlist: PlaylistRef) => onUpdateSettings({ playlist })
  const invite = () => {
    void copyText(joinUrl).then((ok) => onNotify?.(ok ? 'Link della stanza copiato!' : 'Copia non riuscita: usa il pulsante QR per vedere il link.'))
  }
  const focusPicker = () => {
    pickerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.setTimeout(() => searchRef.current?.focus({ preventScroll: true }), 350)
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
  const settingsPanel = <SettingsPanel settings={settings} editable={isHost} onChange={onUpdateSettings} />
  const picker = isHost && (
    <section ref={pickerRef} aria-label="Scegli la playlist" className="glass scroll-mt-4 rounded-panel p-4 sm:p-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="display display-skew text-lg text-ink-50 sm:text-xl">Scegli la playlist</h2>
        <span className="hidden text-xs font-semibold text-ink-400 sm:block">Brani da Deezer · anteprime di 30 secondi</span>
      </div>
      <PlaylistPicker selected={settings.playlist} onSelect={selectPlaylist} catalog={catalog} inputRef={searchRef} />
    </section>
  )

  return (
    <div className="relative flex h-dvh flex-col overflow-x-hidden overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
      <Header isHost={isHost} wide={wide} maxW={layoutKey === 'three' ? 'max-w-[1440px]' : 'max-w-[1360px]'} onLeave={() => setLeaveOpen(true)} />

      {wide && isHost && xl ? (
        // Host, large screens: players | picker (centre stage) | chosen playlist + rules.
        <main className="mx-auto grid w-full max-w-[1440px] flex-1 grid-cols-[minmax(320px,368px)_minmax(0,1fr)_minmax(320px,368px)] items-start gap-6 px-8 pt-2 pb-8">
          <div ref={leftRef} className={cn('flex flex-col gap-6', leftFits && 'sticky top-4')}>
            <Reveal delay={0}>
              <RoomCodeCard code={room.code} joinUrl={joinUrl} variant="full" />
            </Reveal>
            <Reveal delay={0.06}>{playerList}</Reveal>
          </div>
          <Reveal delay={0.1} className="min-w-0">
            {picker}
          </Reveal>
          <div ref={rightRef} className={cn('flex flex-col gap-6', rightFits && 'sticky top-4')}>
            <Reveal delay={0.14}>
              <PlaylistHero playlist={settings.playlist} isHost onChange={focusPicker} layout="column" size={150} />
            </Reveal>
            <Reveal delay={0.18}>{settingsPanel}</Reveal>
          </div>
        </main>
      ) : wide ? (
        <main className="mx-auto grid w-full max-w-[1360px] flex-1 grid-cols-[minmax(340px,400px)_minmax(0,1fr)] items-start gap-6 px-8 pt-2 pb-8">
          <div ref={leftRef} className={cn('flex flex-col gap-6', leftFits && 'sticky top-4')}>
            <Reveal delay={0}>
              <RoomCodeCard code={room.code} joinUrl={joinUrl} variant="full" />
            </Reveal>
            <Reveal delay={0.06}>{playerList}</Reveal>
          </div>
          <div className="flex min-w-0 flex-col gap-6">
            <Reveal delay={0.1} className={cn('grid gap-6', xl ? 'grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]' : 'grid-cols-1')}>
              <PlaylistHero playlist={settings.playlist} isHost={isHost} onChange={focusPicker} layout={xl ? 'column' : 'row'} className={cn(xl && 'h-full justify-center')} />
              {settingsPanel}
            </Reveal>
            {picker && <Reveal delay={0.16}>{picker}</Reveal>}
            {!isHost && (
              <Reveal delay={0.16}>
                <HowToPlay settings={settings} />
              </Reveal>
            )}
          </div>
        </main>
      ) : (
        <main className="flex w-full flex-1 flex-col px-safe-4 pb-6 sm:px-safe-6">
          <Reveal delay={0}>
            <RoomCodeCard code={room.code} joinUrl={joinUrl} variant="compact" />
          </Reveal>
          {/* The "!" nudge is for the host only: guests can't pick. */}
          <Tabs tab={tab} onTab={setTab} playerCount={players.length} needsPlaylist={isHost && !settings.playlist} />
          <TabPanel id="players" tab={tab}>
            <div className="flex flex-col gap-4">
              {playerList}
              {!isHost && <HowToPlay settings={settings} />}
            </div>
          </TabPanel>
          <TabPanel id="playlist" tab={tab}>
            {isHost ? (
              <div className="flex flex-col">
                {/* The host sees the record only once there is one: the empty state would just push the picker down. */}
                <AnimatePresence initial={false}>
                  {settings.playlist && (
                    <Expand key="hero">
                      <div className="pb-4">
                        <PlaylistHero playlist={settings.playlist} isHost onChange={focusPicker} layout="row" />
                      </div>
                    </Expand>
                  )}
                </AnimatePresence>
                {picker}
              </div>
            ) : (
              <PlaylistHero playlist={settings.playlist} isHost={false} layout="column" />
            )}
          </TabPanel>
          <TabPanel id="rules" tab={tab}>
            {settingsPanel}
          </TabPanel>
        </main>
      )}

      <div className={cn('sticky bottom-0 z-30', wide && 'mx-auto w-full px-8 pb-safe-5', layoutKey === 'three' ? 'max-w-[1440px]' : 'max-w-[1360px]')}>
        {wide && <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-10 bottom-0 bg-linear-to-b from-transparent to-ink-950/70" />}
        <StartBar
          isHost={isHost}
          settings={settings}
          players={players}
          hostId={room.hostId}
          onStart={onStart}
          variant={wide ? 'dock' : 'sheet'}
        />
      </div>

      <Modal
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        size="sm"
        title={isHost ? 'Chiudere la stanza?' : 'Uscire dalla stanza?'}
        description={
          isHost
            ? players.length > 1
              ? 'Sei l’host: se esci la stanza si chiude e tutti gli altri giocatori verranno disconnessi.'
              : 'La stanza verrà chiusa.'
            : `Potrai rientrare con il codice ${room.code}, finché la partita non inizia.`
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setLeaveOpen(false)}>
              Resta
            </Button>
            <Button
              variant="danger"
              leftIcon="logout"
              onClick={() => {
                setLeaveOpen(false)
                onLeave()
              }}
            >
              {isHost ? 'Chiudi stanza' : 'Esci'}
            </Button>
          </>
        }
      />
    </div>
  )
}

/** Height kept free for the sticky top offset + the start dock under a sticky column. */
const DOCK_RESERVE_PX = 16 + 132

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

function Header({ isHost, wide, maxW, onLeave }: { isHost: boolean; wide: boolean; maxW: string; onLeave(): void }) {
  return (
    <header className={cn('shrink-0', wide ? cn('mx-auto w-full px-8', maxW) : 'px-safe-4 pt-safe sm:px-safe-6')}>
      <div className={cn('relative flex items-center', wide ? 'h-20' : 'h-16')}>
        {wide ? (
          <Button variant="glass" size="sm" leftIcon="logout" onClick={onLeave} className="relative z-10">
            {isHost ? 'Chiudi stanza' : 'Esci'}
          </Button>
        ) : (
          <IconButton icon="arrow-left" label={isHost ? 'Chiudi stanza' : 'Esci dalla stanza'} size="sm" onClick={onLeave} tooltip={false} className="relative z-10" />
        )}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto flex items-center gap-3">
            <Logo size={wide ? 'md' : 'sm'} />
            <span className="hidden rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-extrabold tracking-[0.16em] text-ink-200 uppercase sm:inline">
              Lobby
            </span>
          </div>
        </div>
        {/* In the header (not floating): it scrolls away with it instead of covering sticky columns / tabs. */}
        <SoundControls placement="inline" className="relative z-10 ml-auto" />
      </div>
    </header>
  )
}

const TABS: { id: LobbyTab; label: string; icon: IconName }[] = [
  { id: 'players', label: 'Giocatori', icon: 'users' },
  { id: 'playlist', label: 'Playlist', icon: 'music' },
  { id: 'rules', label: 'Regole', icon: 'settings' },
]

function Tabs({ tab, onTab, playerCount, needsPlaylist }: { tab: LobbyTab; onTab(t: LobbyTab): void; playerCount: number; needsPlaylist: boolean }) {
  const reduce = useReducedMotion()
  const layoutId = useId()
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const move = (dir: number) => {
    const i = TABS.findIndex((t) => t.id === tab)
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
    <div className="sticky top-0 z-20 -mx-4 mt-3 px-4 pt-[max(env(safe-area-inset-top),8px)] pb-2 sm:-mx-6 sm:px-6">
      <div
        aria-hidden
        className={cn(
          'absolute inset-x-0 top-0 -bottom-4 bg-linear-to-b from-ink-950/90 via-ink-950/75 to-transparent transition-opacity duration-300',
          stuck ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        role="tablist"
        aria-label="Sezioni della lobby"
        className="relative flex rounded-[20px] border border-white/[0.08] bg-ink-950/60 p-1 shadow-well backdrop-blur-xl"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') move(1)
          else if (e.key === 'ArrowLeft') move(-1)
          else return
          e.preventDefault()
        }}
      >
        {TABS.map((t) => {
          const selected = t.id === tab
          const badge = t.id === 'players' ? String(playerCount) : t.id === 'playlist' && needsPlaylist ? '!' : null
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[t.id] = el
              }}
              type="button"
              role="tab"
              id={`lobby-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`lobby-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onTab(t.id)}
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
              <Icon name={t.icon} size={15} strokeWidth={2.4} className={cn('relative shrink-0 max-[419px]:hidden', selected ? 'text-white' : 'text-ink-400')} />
              <span className={cn('relative truncate font-display text-[11px] font-bold tracking-wide uppercase max-[379px]:text-[10px] max-[379px]:tracking-normal', selected ? 'text-white' : 'text-ink-200')}>{t.label}</span>
              {badge && (
                <span
                  className={cn(
                    'num relative grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full px-1 text-[10px] font-bold max-[379px]:h-4 max-[379px]:min-w-4',
                    badge === '!' ? 'bg-gold text-ink-950' : selected ? 'bg-white/25 text-white' : 'bg-white/10 text-ink-200',
                  )}
                >
                  <span aria-hidden>{badge}</span>
                  <span className="sr-only">{badge === '!' ? ', da scegliere' : `, ${badge} giocatori`}</span>
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

/** Height-animated mount/unmount; clips only while animating so glows aren't cut once settled. */
function Expand({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion()
  const [clip, setClip] = useState(false)
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 32 }}
      onAnimationStart={() => setClip(true)}
      onAnimationComplete={() => setClip(false)}
      style={{ overflow: clip ? 'hidden' : 'visible' }}
    >
      {children}
    </motion.div>
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
