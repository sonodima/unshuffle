import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Avatar, AvatarGroup, Button, Equalizer, Icon, cn } from '../../components/ui'
import { SNIPPET_DIFFICULTY } from '../../game/constants'
import type { GameSettings, Player } from '../../game/types'
import { localeTag, msgOf, tm, type Msg } from '../../i18n'
import { useT } from '../../i18n/react'
import { withNum } from './num'
import { PlaylistRecord, WaitingText } from './PlaylistHero'
import { MIN_ROUNDS, playlistShortfall, type PlaylistShortfall } from './rules'

interface StartBarProps {
  isHost: boolean
  settings: GameSettings
  players: Player[]
  hostId: string
  /** Host: resolves when the game is starting, rejects with an AppError (its message is shown inline). */
  onStart(): Promise<void>
  /** Host: enables the "Gioca N round" shortcut when the playlist is too short for the chosen rounds. */
  onUpdateSettings?(patch: Partial<GameSettings>): void
  /** 'dock' = floating bar (desktop) · 'sheet' = full-width bottom bar (phones). */
  variant: 'dock' | 'sheet'
  /** Dock on short screens (≤ 800px tall): a slimmer bar with a smaller CTA. */
  dense?: boolean
  className?: string
}

/** Sticky bottom action bar: the host's start CTA, or the guests' waiting state. */
export function StartBar({ isHost, settings, players, hostId, onStart, onUpdateSettings, variant, dense = false, className }: StartBarProps) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Msg | null>(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // A new playlist / rule makes the previous rejection stale.
  const settingsKey = JSON.stringify(settings)
  const [lastKey, setLastKey] = useState(settingsKey)
  if (settingsKey !== lastKey) {
    setLastKey(settingsKey)
    if (error) setError(null)
  }

  const playlist = settings.playlist
  const host = players.find((p) => p.id === hostId)
  const dock = variant === 'dock'
  // Known too short (Deezer's own count): say it before the click, not after.
  const shortfall = isHost ? playlistShortfall(playlist, settings.rounds) : null
  const canStart = !!playlist && !shortfall
  const start = async () => {
    if (busy || !canStart) return
    setBusy(true)
    setError(null)
    try {
      await onStart()
    } catch (err) {
      if (mounted.current) setError(msgOf(err, 'game.store.startFailed'))
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  const difficultyKey = SNIPPET_DIFFICULTY[settings.snippets]
  // Inline in the summary: lowercase ("8 spezzoni (normale)").
  const difficulty = difficultyKey ? t(difficultyKey).toLocaleLowerCase(localeTag()) : undefined
  // Three items in a row, " · " between them (each item has its own plural).
  const rules = (
    <>
      {/* Gold when fewer rounds would fix a too-short playlist. */}
      <span className={cn(shortfall?.fitRounds != null && 'text-gold')}>{withNum(t('lobby.bar.rounds', { count: settings.rounds }))}</span>
      {' · '}
      {withNum(
        dock && difficulty
          ? t('lobby.bar.snippetsLevel', { count: settings.snippets, difficulty })
          : t('lobby.bar.snippets', { count: settings.snippets }),
      )}
      {' · '}
      {withNum(t('lobby.bar.roundTime', { seconds: settings.roundTime }))}
    </>
  )
  const waiting = t(playlist ? 'lobby.bar.waitingStart' : 'lobby.bar.waitingPlaylist')
  const hint = !playlist ? t('lobby.bar.pickPlaylist') : players.length <= 1 ? t('lobby.bar.solo') : null
  const sleeve = dock ? (dense ? 48 : 56) : 44

  const summary = (
    <div className="flex min-w-0 items-center gap-3">
      {/* The chosen record lives here (the one place every layout shows it); guests see it spin in the hero instead. */}
      <PlaylistRecord playlist={playlist} sleeve={sleeve} spin={isHost} glow={isHost} reserve />
      <div className="min-w-0 flex-1">
        <p className={cn('truncate font-extrabold', dock ? 'text-[15px]' : 'text-sm', playlist ? 'text-ink-50' : 'text-ink-300')} title={playlist?.title}>
          {playlist ? playlist.title : t('lobby.bar.noPlaylist')}
        </p>
        <p className="mt-0.5 truncate text-xs font-semibold text-ink-400">
          {!dock && !isHost ? <WaitingText>{waiting}</WaitingText> : !dock && !playlist ? t('lobby.bar.pickPlaylist') : rules}
        </p>
      </div>
    </div>
  )

  const errorLine = (
    <AnimatePresence initial={false}>
      {error && (
        <motion.p
          key={tm(error)}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          role="alert"
          className={cn('text-xs leading-snug font-bold text-coral', dock ? 'max-w-[300px] text-right' : 'text-center')}
        >
          <Icon name="alert" size={14} strokeWidth={2.6} className="mr-1 inline-block -translate-y-px align-middle" />
          {tm(error)}
        </motion.p>
      )}
    </AnimatePresence>
  )

  const fix = shortfall?.fitRounds != null && onUpdateSettings ? shortfall.fitRounds : null
  const shortNotice = shortfall && (
    <ShortfallNotice shortfall={shortfall} dock={dock}>
      {fix != null && (
        <Button variant="glass" size="sm" leftIcon="flag" className="shrink-0 text-gold" onClick={() => onUpdateSettings?.({ rounds: fix })}>
          {t('lobby.bar.playRounds', { count: fix })}
        </Button>
      )}
    </ShortfallNotice>
  )

  const startButton = (
    <Button
      size={dock ? (dense ? 'lg' : 'xl') : 'lg'}
      fullWidth={!dock}
      leftIcon="play"
      loading={busy}
      disabled={!canStart}
      sound="submit"
      onClick={() => void start()}
      className={cn(dock && (dense ? 'min-w-[240px]' : 'min-w-[280px]'))}
    >
      {t('lobby.start')}
    </Button>
  )

  if (!dock) {
    return (
      <div
        className={cn('glass-dock relative rounded-t-[26px] rounded-b-none border-b-0 px-safe-4 pt-3', isHost ? 'pb-safe-2' : 'pb-safe-3', className)}
      >
        {isHost ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-5">
            <div className="min-w-0 sm:flex-1">{summary}</div>
            <div className="mt-3 flex flex-col gap-2 sm:mt-0 sm:w-[300px] sm:shrink-0">
              {shortNotice}
              {errorLine}
              {startButton}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">{summary}</div>
            {host && <Avatar avatar={host.avatar} color={host.color} name={host.name} size="sm" host />}
            <Equalizer bars={4} size={18} label={null} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn('glass-dock relative flex w-full items-center gap-6 rounded-[26px] pr-3 pl-3', dense ? 'py-2.5' : 'py-3', className)}
    >
      <div className="min-w-0 flex-1">{summary}</div>

      <div className="hidden shrink-0 items-center gap-3 min-[1180px]:flex">
        <AvatarGroup players={players} size="sm" max={6} />
        <span className="text-xs font-bold whitespace-nowrap text-ink-300">
          {withNum(t('lobby.players', { count: players.length }), 'text-ink-100')}
        </span>
      </div>

      {isHost ? (
        <div className="flex shrink-0 items-center gap-4">
          {error ? errorLine : shortNotice || (hint && <p className="max-w-[220px] text-right text-xs leading-snug font-bold text-ink-300">{hint}</p>)}
          {startButton}
        </div>
      ) : (
        <div className={cn('relative flex shrink-0 items-center gap-3 overflow-hidden rounded-[20px] bg-white/[0.04] pr-5 pl-3', dense ? 'h-14' : 'h-[68px]')}>
          <span aria-hidden className="pointer-events-none absolute inset-0 animate-[lobby-sweep_3.2s_ease-in-out_infinite] bg-linear-to-r from-transparent via-white/[0.06] to-transparent" />
          {host && <Avatar avatar={host.avatar} color={host.color} name={host.name} size="sm" host />}
          <p className="text-sm font-bold whitespace-nowrap text-ink-100" aria-live="polite">
            <WaitingText>{waiting}</WaitingText>
          </p>
          <Equalizer bars={4} size={20} label={null} />
        </div>
      )}
    </div>
  )
}

/** "Playlist troppo corta" line (+ the one-tap fix) shown instead of a start that could only fail. */
function ShortfallNotice({ shortfall, dock, children }: { shortfall: PlaylistShortfall; dock: boolean; children?: ReactNode }) {
  const t = useT()
  const { have, need, fitRounds } = shortfall
  const text = withNum(
    fitRounds != null ? t('lobby.bar.shortfall', { count: have, need }) : t('lobby.bar.shortfallMin', { count: have, min: MIN_ROUNDS }),
  )
  return (
    <motion.div
      key={`${have}-${need}`}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      role="status"
      className={cn('flex items-center gap-3', dock ? 'max-w-[400px]' : 'rounded-2xl border border-gold/25 bg-gold/[0.07] py-2 pr-2 pl-3')}
    >
      <p className={cn('min-w-0 flex-1 text-xs leading-snug font-bold text-gold', dock && 'max-w-[260px] text-right')}>
        <Icon name="alert" size={14} strokeWidth={2.6} className="mr-1 inline-block -translate-y-px align-middle" />
        {text}
      </p>
      {children}
    </motion.div>
  )
}
