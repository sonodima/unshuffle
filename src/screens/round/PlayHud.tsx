// In-round HUD. Wide screens: stat panel · big timer ring · stat panel (GeoGuessr
// layout). Phones / short landscape: one compact glass-flat card with a timer bar.
// Both host the first-confirm banner in a slot that never hides the timer, and
// the exit menu button (top-left, like every "back" in the app).
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { SoundControls } from '../../components/shell/SoundControls'
import { AnimatedNumber, Badge, Icon, ProgressDots, TimerBar, TimerRing, cn, useMediaQuery } from '../../components/ui'
import type { Player, PlayerId } from '../../game/types'
import { FirstSubmitBanner } from './FirstSubmitBanner'
import type { FirstSubmitInfo } from './FirstSubmitBanner'
import { GameMenuButton } from './GameMenu'
import { useRoundMenu } from './menuContext'
import type { RoundInfo } from './model'
import { PlayersStrip } from './PlayersStrip'

interface PlayHudProps {
  info: RoundInfo
  /** Compact phone layout. */
  compact: boolean
  remainingMs: number
  totalMs: number
  /** Timer extrapolates (false once time is up). */
  running: boolean
  /** Someone confirmed: final countdown. */
  finalMode: boolean
  /** Players of this round (active). */
  players: readonly Player[]
  /** Who already confirmed. */
  checked: ReadonlySet<PlayerId>
  me: PlayerId
  score: number
  /** 1-based standing (0 = unknown / spectator). */
  rank: number
  /** Show the players' strip (hidden when alone). */
  showPlayers: boolean
  /** First-confirm banner (null = hidden). */
  banner?: FirstSubmitInfo | null
}

function Cell({ label, children, align = 'start', className }: { label: ReactNode; children: ReactNode; align?: 'start' | 'end'; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col justify-center gap-1.5', align === 'end' ? 'items-end text-right' : 'items-start', className)}>
      <span className="eyebrow max-w-full truncate leading-none">{label}</span>
      {children}
    </div>
  )
}

function Divider() {
  return <span aria-hidden className="w-px shrink-0 self-stretch bg-linear-to-b from-white/0 via-white/12 to-white/0" />
}

function HudPanel({ children, className, side }: { children: ReactNode; className?: string; side: 'left' | 'right' }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, x: side === 'left' ? -28 : 28 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30, delay: 0.08 }}
      className={cn('glass-flat flex min-h-[86px] min-w-0 items-stretch rounded-[22px] py-3.5', className)}
    >
      {children}
    </motion.div>
  )
}

function ordinal(rank: number): string {
  return `${rank}º`
}

export function PlayHud(props: PlayHudProps) {
  return props.compact ? <CompactHud {...props} /> : <WideHud {...props} />
}

function WideHud({ info, remainingMs, totalMs, running, finalMode, players, checked, me, score, rank, showPlayers, banner = null }: PlayHudProps) {
  const reduce = useReducedMotion()
  // From 1180px the shell's floating sound control sits bottom-right; below that the HUD hosts it.
  const inlineSound = !useMediaQuery('(min-width: 1180px)')
  // Tablet portrait (768–1023px) has ~290px per side: tighter panels, a smaller ring, fewer avatars.
  const lg = useMediaQuery('(min-width: 1024px)')
  const xl = useMediaQuery('(min-width: 1280px)')
  const hasMenu = !!useRoundMenu()
  const done = players.filter((p) => checked.has(p.id)).length
  const panel = lg ? 'gap-5 px-5' : 'gap-3 px-3.5'
  const big = lg ? 'text-[26px]' : 'text-[22px]'
  const bannerOn = !!banner
  return (
    <header
      data-shell-hud
      className={cn('relative z-20 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-safe-6 pt-safe-5 lg:px-safe-8', lg ? 'gap-4' : 'gap-3')}
    >
      <div className="relative flex min-w-0 items-center gap-2 lg:gap-3">
        <GameMenuButton size="md" className="shrink-0" />
        {/* Sound joins the menu on the left where the right side is busy with the players. */}
        {inlineSound && !lg && <SoundControls placement="inline" align="start" className="shrink-0" />}
        <motion.div className="min-w-0" animate={{ opacity: bannerOn ? 0 : 1, scale: bannerOn && !reduce ? 0.96 : 1 }} transition={{ duration: 0.2 }}>
          <HudPanel side="left" className={panel}>
            <Cell label="Round">
              <span className={cn('display display-skew block leading-none whitespace-nowrap text-white', big)}>
                {info.number}
                <span className={lg ? 'text-[17px] text-ink-400' : 'text-[15px] text-ink-400'}> / {info.total}</span>
              </span>
              <ProgressDots total={info.total} current={info.index} size="sm" className="mt-0.5" />
            </Cell>
            <Divider />
            <Cell label="Spezzoni">
              <span className={cn('display display-skew block leading-none text-white', big)}>{info.snippets}</span>
              {info.difficulty && <span className="text-[12px] font-bold leading-none text-ink-300">{info.difficulty}</span>}
            </Cell>
          </HudPanel>
        </motion.div>
        {/* Over the stat panel (it fades out), next to the ring; from lg it leaves the exit button uncovered. */}
        <FirstSubmitBanner
          info={banner}
          compact={false}
          className={cn('absolute inset-y-0 right-0 z-10 flex items-center', lg && hasMenu ? 'left-14' : 'left-0')}
        />
      </div>

      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: -30, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 24 }}
        className="relative flex flex-col items-center"
      >
        <TimerRing remainingMs={remainingMs} totalMs={totalMs} running={running} size={lg ? 112 : 100} caption={finalMode ? 'Finale' : 'Tempo'} />
        {finalMode && (
          <motion.span
            initial={{ opacity: 0, y: -6, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            className="absolute -bottom-[18px] whitespace-nowrap"
          >
            <Badge tone="coral" variant="solid" icon="bolt">
              Ultimi secondi
            </Badge>
          </motion.span>
        )}
      </motion.div>

      <div className="flex min-w-0 items-center justify-end gap-3">
        <HudPanel side="right" className={panel}>
          {showPlayers && (
            <>
              <Cell label={`Confermati ${done}/${players.length}`} className="shrink">
                <PlayersStrip players={players} checked={checked} me={me} size="sm" max={xl ? 7 : lg ? 6 : 4} overlap={!xl} label="Giocatori del round" />
              </Cell>
              <Divider />
            </>
          )}
          <Cell label="Punti" align="end" className="shrink-0">
            <AnimatedNumber value={score} className={cn('block leading-none font-bold text-gold', big)} />
            {rank > 0 && players.length > 1 && <span className="text-[12px] font-bold leading-none whitespace-nowrap text-ink-300">{ordinal(rank)} posto</span>}
          </Cell>
        </HudPanel>
        {inlineSound && lg && <SoundControls placement="inline" className="shrink-0" />}
      </div>
    </header>
  )
}

function CompactHud({ info, remainingMs, totalMs, running, finalMode, players, checked, me, score, showPlayers, banner = null }: PlayHudProps) {
  const reduce = useReducedMotion()
  const narrow = !useMediaQuery('(min-width: 380px)')
  const landscape = useMediaQuery('(min-width: 600px)')
  return (
    <motion.header
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 360, damping: 30 }}
      data-shell-hud
      className="relative z-20 px-safe-3 pt-safe-3"
    >
      <div className="glass-flat relative rounded-[22px] px-3 pt-2.5 pb-3">
        <div className="flex h-10 items-center gap-2.5">
          <GameMenuButton size="sm" className="-ml-0.5 shrink-0" />
          {/* Mirrors the "Punti" cell: eyebrow + number (the progress dots need a roomier HUD). */}
          <div className="flex shrink-0 flex-col gap-1">
            <span className="eyebrow text-[9px] leading-none">Round</span>
            <span className="display display-skew block text-[17px] leading-none whitespace-nowrap text-white">
              {info.number}
              <span className="text-[13px] text-ink-400">/{info.total}</span>
            </span>
          </div>
          {showPlayers && (
            <PlayersStrip players={players} checked={checked} me={me} size="xs" max={landscape ? 9 : narrow ? 5 : 6} overlap className="ml-auto min-w-0" label="Giocatori del round" />
          )}
          <div className={cn('flex shrink-0 flex-col items-end gap-1', !showPlayers && 'ml-auto')}>
            <span className="eyebrow text-[9px] leading-none">Punti</span>
            <AnimatedNumber value={score} className="block text-[17px] leading-none font-bold text-gold" />
          </div>
          <SoundControls placement="inline" className="-mr-1 shrink-0" />
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          {finalMode && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="grid size-5 shrink-0 place-items-center rounded-full bg-coral text-white">
              <Icon name="bolt" size={12} filled strokeWidth={2.4} label="Ultimi secondi" />
            </motion.span>
          )}
          <TimerBar remainingMs={remainingMs} totalMs={totalMs} running={running} size="md" />
        </div>
        {/* The banner takes over the first row; the timer bar right below stays visible. */}
        <FirstSubmitBanner info={banner} compact className="absolute inset-x-0 top-0 z-10" />
      </div>
    </motion.header>
  )
}
