import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Avatar, AvatarGroup, Button, Equalizer, Icon, cn } from '../../components/ui'
import { SNIPPET_DIFFICULTY } from '../../game/constants'
import type { GameSettings, Player } from '../../game/types'
import { WaitingText } from './PlaylistHero'
import { Cover } from './PlaylistPicker'

export interface StartBarProps {
  isHost: boolean
  settings: GameSettings
  players: Player[]
  hostId: string
  /** Host: resolves when the game is starting, rejects with an Italian message (shown inline). */
  onStart(): Promise<void>
  /** 'dock' = floating bar (desktop) · 'sheet' = full-width bottom bar (phones). */
  variant: 'dock' | 'sheet'
  className?: string
}

/** Sticky bottom action bar: the host's start CTA, or the guests' waiting state. */
export function StartBar({ isHost, settings, players, hostId, onStart, variant, className }: StartBarProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
  const start = async () => {
    if (busy || !playlist) return
    setBusy(true)
    setError(null)
    try {
      await onStart()
    } catch (err) {
      if (mounted.current) setError(err instanceof Error && err.message ? err.message : 'Impossibile avviare la partita. Riprova.')
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  const difficulty = SNIPPET_DIFFICULTY[settings.snippets]
  const rules = (
    <>
      <span className="num">{settings.rounds}</span> round · <span className="num">{settings.snippets}</span> spezzoni
      {dock && difficulty ? ` (${difficulty.toLowerCase()})` : ''} · <span className="num">{settings.roundTime}s</span>
    </>
  )
  const waiting = playlist ? 'In attesa che l’host avvii la partita' : 'L’host sta scegliendo la playlist'
  const hint = !playlist ? 'Scegli una playlist per iniziare' : players.length <= 1 ? 'Puoi giocare anche da solo' : null

  const summary = (
    <div className="flex min-w-0 items-center gap-3">
      <span className={cn('relative shrink-0', dock ? 'size-14' : 'size-11')}>
        {playlist ? (
          <Cover src={playlist.picture} rounded="rounded-[12px]" className="shadow-[0_0_0_1px_rgb(255_255_255/0.1)]" />
        ) : (
          <span className="grid size-full place-items-center rounded-[12px] border border-dashed border-white/20 text-ink-500">
            <Icon name="music" size={dock ? 22 : 18} />
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate font-extrabold', dock ? 'text-[15px]' : 'text-sm', playlist ? 'text-ink-50' : 'text-ink-300')}>
          {playlist ? playlist.title : 'Nessuna playlist'}
        </p>
        <p className="mt-0.5 truncate text-xs font-semibold text-ink-400">
          {!dock && !isHost ? <WaitingText>{waiting}</WaitingText> : !dock && !playlist ? 'Scegli una playlist per iniziare' : rules}
        </p>
      </div>
    </div>
  )

  const errorLine = (
    <AnimatePresence initial={false}>
      {error && (
        <motion.p
          key={error}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          role="alert"
          className={cn('text-xs leading-snug font-bold text-coral', dock ? 'max-w-[300px] text-right' : 'text-center')}
        >
          <Icon name="alert" size={14} strokeWidth={2.6} className="mr-1 inline-block -translate-y-px align-middle" />
          {error}
        </motion.p>
      )}
    </AnimatePresence>
  )

  const startButton = (
    <Button
      size={dock ? 'xl' : 'lg'}
      fullWidth={!dock}
      leftIcon="play"
      loading={busy}
      disabled={!playlist}
      sound="submit"
      onClick={() => void start()}
      className={cn(dock && 'min-w-[280px]')}
    >
      Inizia partita
    </Button>
  )

  if (!dock) {
    return (
      <div
        className={cn('glass relative rounded-t-[26px] rounded-b-none border-b-0 px-safe-4 pt-3', isHost ? 'pb-safe-2' : 'pb-safe-3', className)}
        style={{ backgroundColor: 'rgb(13 10 31 / 0.86)' }}
      >
        {isHost ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-5">
            <div className="min-w-0 sm:flex-1">{summary}</div>
            <div className="mt-3 flex flex-col gap-2 sm:mt-0 sm:w-[300px] sm:shrink-0">
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
    <div className={cn('glass relative flex w-full items-center gap-6 rounded-[26px] py-3 pr-3 pl-3', className)} style={{ backgroundColor: 'rgb(13 10 31 / 0.84)' }}>
      <div className="min-w-0 flex-1">{summary}</div>

      <div className="hidden shrink-0 items-center gap-3 min-[1180px]:flex">
        <AvatarGroup players={players} size="sm" max={6} />
        <span className="text-xs font-bold whitespace-nowrap text-ink-300">
          <span className="num text-ink-100">{players.length}</span> {players.length === 1 ? 'giocatore' : 'giocatori'}
        </span>
      </div>

      {isHost ? (
        <div className="flex shrink-0 items-center gap-4">
          {error ? errorLine : hint && <p className="max-w-[220px] text-right text-xs leading-snug font-bold text-ink-300">{hint}</p>}
          {startButton}
        </div>
      ) : (
        <div className="relative flex h-[68px] shrink-0 items-center gap-3 overflow-hidden rounded-[20px] bg-white/[0.04] pr-5 pl-3">
          <span aria-hidden className="pointer-events-none absolute inset-0 animate-[lobby-sweep_3.2s_ease-in-out_infinite] bg-linear-to-r from-transparent via-white/[0.06] to-transparent" />
          {host && <Avatar avatar={host.avatar} color={host.color} name={host.name} size="sm" host />}
          <p className="text-sm font-bold text-ink-100" aria-live="polite">
            <WaitingText>{waiting}</WaitingText>
          </p>
          <Equalizer bars={4} size={20} label={null} />
        </div>
      )}
    </div>
  )
}
