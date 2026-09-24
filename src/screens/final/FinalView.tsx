import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SoundControls } from '../../components/shell/SoundControls'
import { LogoMark, cn, playSfx, playerColor, useMediaQuery } from '../../components/ui'
import type { PlayerId, RoomState } from '../../game/types'
import { ActionDock } from './ActionDock'
import { Awards } from './Awards'
import { createCelebration, type Celebration } from './celebration'
import { Cover } from './Cover'
import { useFitWords } from './fit'
import { Podium } from './Podium'
import { RoundBreakdown } from './RoundBreakdown'
import type { Cue } from './reveal'
import { Songs } from './Songs'
import { Standings } from './Standings'
import { computeFinalSummary, computeHeadline, type FinalSummary, type Headline } from './stats'
import { landingTime } from './timing'
import './final.css'

export interface FinalViewProps {
  room: RoomState
  /** My player id. */
  me: PlayerId
  /** Host controls (Rigioca). Default: room.hostId === me. */
  isHost?: boolean
  /** Host: back to the lobby with the same players and settings. */
  onPlayAgain(): void
  /** Leave the room (host: closes it for everyone, after a confirmation). */
  onLeave(): void
  /** Confetti + fanfare + landing sounds. Default true. */
  celebrate?: boolean
  /** Called once when the winner lands on the podium (e.g. to pulse the background). */
  onWinnerLanded?(): void
  /** Guests: ask the host for a rematch. Omit to hide the button. */
  onRematch?(): void
  /** Host: ids of the players who asked for a rematch. */
  rematchFrom?: PlayerId[]
}

/** Final results: podium, standings, awards, per-round breakdown and the songs of the game. */
export function FinalView({ room, me, isHost = room.hostId === me, onPlayAgain, onLeave, celebrate = true, onWinnerLanded, onRematch, rematchFrom }: FinalViewProps) {
  const reduced = !!useReducedMotion()
  const summary = useMemo(() => computeFinalSummary(room), [room])
  const headline = useMemo(() => computeHeadline(summary, me), [summary, me])
  // Someone who never played a round (a late joiner who only watched) never gets a podium
  // step, even with 0 points against 0 (the standings list them as "Non ha giocato").
  const podium = useMemo(() => {
    const played = summary.standings.filter((s) => s.roundsPlayed > 0)
    return played.length > 0 ? played : summary.standings
  }, [summary])
  const podiumCount = Math.min(3, podium.length)
  const winnerLands = landingTime(0, podiumCount, reduced)

  const [cue] = useState<Cue>(() => ({ mountedAt: performance.now(), revealAt: winnerLands + 0.3 }))
  const winnerRef = useRef<HTMLButtonElement>(null)
  const party = useRef<Celebration | null>(null)
  // Latest values for the one-shot timers below.
  const landedRef = useRef(onWinnerLanded)
  const summaryRef = useRef(summary)
  useEffect(() => {
    landedRef.current = onWinnerLanded
    summaryRef.current = summary
  })

  const burstFromWinner = useCallback(() => {
    const el = winnerRef.current
    const r = el?.getBoundingClientRect()
    const origin = r && r.width ? { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight } : { x: 0.5, y: 0.35 }
    const winner = summaryRef.current.winners[0]?.player
    party.current?.burst(origin, winner ? playerColor(winner.color) : undefined)
  }, [])

  // Entrance choreography: landing thuds, then fanfare + confetti when the winner touches down.
  useEffect(() => {
    const scored = (summaryRef.current.standings[0]?.score ?? 0) > 0
    if (celebrate && scored) party.current = createCelebration()
    const timers: ReturnType<typeof setTimeout>[] = []
    const at = (s: number, fn: () => void) => timers.push(setTimeout(fn, s * 1000))
    if (celebrate) {
      // Reduced motion: everything appears at once, so only the final cue plays.
      if (!reduced) {
        for (let place = podiumCount - 1; place >= 1; place--) {
          at(landingTime(place, podiumCount, reduced), () => playSfx('drop', { pitch: place === 2 ? 0.9 : 1 }))
        }
      }
      at(Math.max(0, winnerLands - 0.04), () => playSfx(scored ? 'fanfare' : 'drop'))
    }
    at(winnerLands, () => {
      landedRef.current?.()
      if (!party.current) return
      burstFromWinner()
      party.current.cannons(2400)
    })
    return () => {
      timers.forEach(clearTimeout)
      party.current?.destroy()
      party.current = null
    }
    // One-shot on mount: later room updates (someone disconnecting) must not replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const lastCheer = useRef(0)
  const cheer = useCallback(() => {
    const now = performance.now()
    if (now - lastCheer.current < 700) return
    lastCheer.current = now
    playSfx('pop')
    if (!party.current && celebrate) party.current = createCelebration()
    burstFromWinner()
  }, [burstFromWinner, celebrate])

  const othersOnline = room.players.filter((p) => p.id !== me && p.connected).length
  const playlist = room.settings.playlist
  // Tablets and up: the actions sit right under the podium (never over it); phones keep a bottom dock.
  const inlineDock = useMediaQuery('(min-width: 768px)')
  // Laptops with little height (1280×720, 1366×768): tighter hero and lower blocks, so the
  // podium plates and the dock under them fit in the first screen.
  const compact = useMediaQuery('(min-width: 768px) and (max-height: 820px)')
  // Landscape phones: phone-sized podium and type, a regular-size dock.
  const short = useMediaQuery('(max-height: 500px)')
  const hasPodium = podium.length > 0
  const rematchPlayers = useMemo(
    () => (rematchFrom ?? []).flatMap((id) => room.players.filter((p) => p.id === id && p.id !== me && p.connected)),
    [rematchFrom, room.players, me],
  )
  const dock = (
    <ActionDock
      isHost={isHost}
      othersOnline={othersOnline}
      onPlayAgain={onPlayAgain}
      onLeave={onLeave}
      delay={reduced ? 0 : winnerLands + 0.2}
      reduced={reduced}
      placement={inlineDock ? 'inline' : 'fixed'}
      big={!short}
      // Tucked into the stage floor's glow, right under the plates.
      className={hasPodium ? (short ? '-mt-10' : '-mt-16') : 'mt-8'}
      onRematch={isHost ? undefined : onRematch}
      rematchFrom={isHost ? rematchPlayers : undefined}
    />
  )

  return (
    <div className="relative h-dvh w-full overflow-x-hidden overflow-y-auto overscroll-y-contain">
      <main aria-labelledby="fp-title" className="mx-auto w-full max-w-6xl px-safe-4 pt-safe-4 pb-[calc(env(safe-area-inset-bottom,0px)+8.5rem)] sm:px-safe-6 sm:pt-safe-6">
        <TopBar playlistTitle={playlist?.title} playlistCover={playlist?.picture} rounds={summary.roundsPlayed} reduced={reduced} />

        <Hero headline={headline} summary={summary} reduced={reduced} revealAt={winnerLands} compact={compact} short={short} />

        {hasPodium && (
          <div className={short ? 'mt-12' : compact ? 'mt-14' : 'mt-14 sm:mt-20 lg:mt-24'}>
            <Podium
              standings={podium}
              me={me}
              reduced={reduced}
              muted={headline.tone === 'zero'}
              winnerRef={winnerRef}
              onCheer={headline.tone === 'zero' ? undefined : cheer}
              compact={compact}
              small={short}
            />
          </div>
        )}

        {/* Inline dock: a direct child of <main> so it can stick to the bottom edge while below the fold. */}
        {inlineDock && dock}

        <div className={cn('grid grid-cols-1 gap-9 lg:grid-cols-12 lg:gap-6', inlineDock ? 'mt-10' : 'mt-4 sm:mt-6')}>
          <Standings summary={summary} me={me} reduced={reduced} cue={cue} className={summary.awards.length ? 'lg:col-span-7' : 'lg:col-span-8 lg:col-start-3'} />
          <Awards awards={summary.awards} me={me} reduced={reduced} cue={cue} className="lg:col-span-5" />
        </div>

        <RoundBreakdown summary={summary} me={me} className="mt-9 sm:mt-12" />
        <Songs rounds={summary.rounds} reduced={reduced} className="mt-9 sm:mt-12" />
      </main>

      {!inlineDock && dock}
    </div>
  )
}

function TopBar({ playlistTitle, playlistCover, rounds, reduced }: { playlistTitle?: string; playlistCover?: string; rounds: number; reduced: boolean }) {
  const phone = useMediaQuery('(max-width: 639px)')
  return (
    <motion.header
      className="flex items-center justify-between gap-3"
      initial={reduced ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex shrink-0 items-center gap-2.5">
        <LogoMark size={30} animate={!reduced} />
        <span className="eyebrow whitespace-nowrap text-ink-200">Partita finita</span>
      </div>
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <div className="glass-subtle flex min-w-0 items-center gap-2 rounded-full py-1 pr-3 pl-1">
          <Cover src={playlistCover} className="size-6 shrink-0 rounded-full" iconSize={12} />
          {playlistTitle && <span className="min-w-0 truncate text-[12px] font-bold text-ink-100 sm:max-w-[260px]">{playlistTitle}</span>}
          {/* Phones: the playlist title gets the room (the round count is in the standings anyway). */}
          <span className={cn('num shrink-0 text-[12px] font-bold text-ink-400', playlistTitle && phone && 'hidden')}>
            {playlistTitle ? '· ' : ''}
            {rounds} round
          </span>
        </div>
        {/* The header hosts the sound control at every width (it hides the shell's floating one,
            which would otherwise sit on this chip and, once scrolled, on the tables). */}
        <SoundControls placement="inline" className="shrink-0" />
      </div>
    </motion.header>
  )
}

const TITLE_CLASS: Record<Headline['tone'], string> = {
  win: 'fp-title-gold',
  solo: 'fp-title-gold',
  tie: 'fp-title-tie',
  lose: 'fp-title-plain',
  zero: 'fp-title-plain',
}

/** Suspense line shown until the winner lands (the headline would otherwise give it away). */
const TEASER: Partial<Record<Headline['tone'], string>> = {
  win: 'E il vincitore è',
  lose: 'E il vincitore è',
  tie: 'E il vincitore è',
}

const FLASH: Record<Headline['tone'], string> = {
  win: 'var(--color-gold)',
  solo: 'var(--color-gold)',
  tie: 'var(--color-magenta)',
  lose: 'var(--color-gold)',
  zero: 'transparent',
}

interface HeroProps {
  headline: Headline
  summary: FinalSummary
  reduced: boolean
  /** Seconds after mount when the winner lands: the real headline appears then. */
  revealAt: number
  /** Short laptop screens: a notch smaller. */
  compact: boolean
  /** Landscape phones: phone-sized. */
  short: boolean
}

function Hero({ headline, summary, reduced, revealAt, compact, short }: HeroProps) {
  const winner = summary.winners[0]?.player
  const titleRef = useRef<HTMLHeadingElement>(null)
  useFitWords(titleRef, headline.title, { min: 24, widen: true })
  const teaser = reduced ? undefined : TEASER[headline.tone]
  // Everything keys off this one timer; without a teaser the title shows right away.
  const [revealed, setRevealed] = useState(!teaser)
  const [flashed, setFlashed] = useState(false)
  useEffect(() => {
    if (!teaser) return
    const t = setTimeout(() => setRevealed(true), revealAt * 1000)
    return () => clearTimeout(t)
  }, [teaser, revealAt])
  const titleDelay = teaser ? 0 : 0.08

  const long = headline.title.length > 16
  const size = short
    ? long
      ? 'text-[30px]'
      : 'text-[40px]'
    : compact
    ? long
      ? 'text-[36px] sm:text-5xl lg:text-6xl'
      : 'text-[46px] sm:text-6xl lg:text-7xl'
    : long
      ? 'text-[36px] sm:text-6xl lg:text-7xl'
      : 'text-[46px] sm:text-7xl lg:text-[88px]'
  // "Giulia vince!": the winner's name in their color.
  const named = headline.tone === 'lose' && winner && headline.title.startsWith(winner.name)
  const title = named ? (
    <>
      <span style={{ color: playerColor(winner.color) }}>{winner.name}</span>
      {headline.title.slice(winner.name.length)}
    </>
  ) : (
    headline.title
  )
  const flash = named ? playerColor(winner.color) : FLASH[headline.tone]

  return (
    <div className={cn('text-center', short ? 'mt-4' : compact ? 'mt-6' : 'mt-7 sm:mt-10')}>
      <div className="relative isolate">
        <motion.h1
          ref={titleRef}
          id="fp-title"
          className={`display display-skew mx-auto max-w-[14ch] px-2 text-balance ${size} ${TITLE_CLASS[headline.tone]}`}
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.45, y: 12 }}
          animate={revealed ? { opacity: 1, scale: 1, y: 0 } : undefined}
          transition={reduced ? { duration: 0.3 } : { type: 'spring', stiffness: 320, damping: 17, delay: titleDelay }}
        >
          {title}
        </motion.h1>
        {/* Screen readers get the real headline from the start; the teaser is visual only. */}
        <AnimatePresence>
          {teaser && !revealed && (
            <motion.p
              key="teaser"
              aria-hidden
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0, y: 10, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.86, filter: 'blur(6px)', transition: { duration: 0.16, ease: 'easeIn' } }}
              transition={{ duration: 0.45, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="display display-skew fp-teaser text-[22px] tracking-[0.04em] text-ink-200 sm:text-3xl lg:text-4xl">
                {teaser}
                <span className="fp-dots">
                  <i>.</i>
                  <i>.</i>
                  <i>.</i>
                </span>
              </span>
            </motion.p>
          )}
        </AnimatePresence>
        {/* One gold (or winner-colored) flash as the name lands, in time with the fanfare. */}
        {teaser && revealed && !flashed && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[70%] w-[min(92%,720px)] -translate-1/2 rounded-full blur-3xl"
            style={{ background: flash }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: [0, 0.55, 0], scale: [0.5, 1.05, 1.25] }}
            transition={{ duration: 0.9, times: [0, 0.3, 1], ease: 'easeOut' }}
            onAnimationComplete={() => setFlashed(true)}
          />
        )}
      </div>
      <motion.p
        className="mx-auto mt-3 max-w-md px-4 text-[15px] font-semibold text-ink-200 sm:mt-4 sm:text-lg"
        initial={{ opacity: 0, y: reduced ? 0 : 6 }}
        animate={revealed ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.45, delay: reduced ? 0 : teaser ? 0.3 : 0.32 }}
      >
        {headline.subtitle}
      </motion.p>
    </div>
  )
}

