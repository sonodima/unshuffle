// Pure in-round stage: switches on room.phase.kind with animated transitions and
// owns the one-shot "VIA!" moment between the intro countdown and the board.
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useBoardAudio } from '../../components/board'
import { useBackground } from '../../components/background/useBackground'
import type { AudioStatus } from '../../game/store'
import type { PlayerId, RoomState } from '../../game/types'
import { useClock } from './clock'
import type { Clock } from './clock'
import { RoundMenuProvider } from './GameMenu'
import { GoBurst } from './GoBurst'
import { IntroView } from './IntroView'
import { roundInfo } from './model'
import { PlayView } from './PlayView'
import { PreparingView } from './PreparingView'

interface RoundViewProps {
  room: RoomState
  me: PlayerId
  /** Host clock (ms), refreshed a few times per second (useHostNow). */
  now: number
  /** Precise host clock (hostNow); default extrapolates from `now`. */
  clock?: Clock
  /** My arrangement for the current round ([] / stale → the round's initial order). */
  arrangement: readonly number[]
  submitted: boolean
  /** Download status per track id (useGame().audio). */
  audio: Record<number, AudioStatus>
  onArrange(order: number[]): void
  onSubmit(): void
  /** Download the current round's audio again; resolves once decoded. */
  onRetryAudio?(): Promise<unknown>
  /** Rendered for phase 'reveal' (the connected RevealView). */
  reveal?: ReactNode
  /** Leave the room mid-game (host: closes it for everyone). Enables the in-game exit menu. */
  onLeave?(): void
  /** Host: stop the match and bring everyone back to the lobby. */
  onEndGame?(): void
  /** Guest whose link to the host is down (reconnecting): a confirm waits to be sent. */
  offline?: boolean
}

/** A fresh "playing" phase counts as the moment of the start for this long. */
const GO_WINDOW_MS = 1500
const GO_BURST_MS = 1000

export function RoundView({ room, me, now, clock: clockProp, arrangement, submitted, audio, onArrange, onSubmit, onRetryAudio, reveal, onLeave, onEndGame, offline = false }: RoundViewProps) {
  const clock = useClock(now, clockProp)
  const { sfx } = useBoardAudio()
  const phase = room.phase

  // ---- "VIA!" (once per round, whichever comes first: countdown end or phase switch)
  const fired = useRef(new Set<string>())
  const [burst, setBurst] = useState<string | null>(null)
  const fireGo = useCallback(
    (round: number) => {
      const key = `${room.code}:${round}`
      if (fired.current.has(key)) return
      fired.current.add(key)
      setBurst(key)
      sfx('go')
      useBackground.getState().pulse(1.2)
    },
    [room.code, sfx],
  )
  // A new game in the same room starts again from round 0.
  const between = phase.kind === 'lobby' || phase.kind === 'final'
  useEffect(() => {
    if (between) fired.current.clear()
  }, [between])
  useEffect(() => {
    if (!burst) return
    const id = setTimeout(() => setBurst(null), GO_BURST_MS)
    return () => clearTimeout(id)
  }, [burst])
  const playingRound = phase.kind === 'playing' ? phase.round : -1
  const playingStartedAt = phase.kind === 'playing' ? phase.startedAt : 0
  useEffect(() => {
    if (playingRound >= 0 && clock() - playingStartedAt < GO_WINDOW_MS) fireGo(playingRound)
  }, [playingRound, playingStartedAt, clock, fireGo])
  const introRound = phase.kind === 'intro' ? phase.round : -1
  const onGo = useCallback(() => {
    if (introRound >= 0) fireGo(introRound)
  }, [introRound, fireGo])

  // ---- current round's audio
  const round = 'round' in phase ? phase.round : -1
  const track = round >= 0 ? roundInfo(room, round).track : null
  const audioStatus = track ? audio[track.id] : undefined

  let key = phase.kind as string
  let content: ReactNode = null
  switch (phase.kind) {
    case 'preparing':
      key = `preparing-${phase.round}`
      content = <PreparingView room={room} me={me} audio={audio} onRetryAudio={onRetryAudio} />
      break
    case 'intro':
      key = `intro-${phase.round}`
      content = <IntroView room={room} me={me} now={now} clock={clock} onGo={onGo} />
      break
    case 'playing':
      key = `playing-${phase.round}`
      content = (
        <PlayView
          room={room}
          me={me}
          now={now}
          clock={clock}
          arrangement={arrangement}
          submitted={submitted}
          audioStatus={audioStatus}
          onArrange={onArrange}
          onSubmit={onSubmit}
          onRetryAudio={onRetryAudio}
          offline={offline}
        />
      )
      break
    case 'reveal':
      key = `reveal-${phase.round}`
      content = reveal ?? null
      break
    default:
      content = null
  }

  return (
    <RoundMenuProvider room={room} me={me} onLeave={onLeave} onEndGame={onEndGame}>
      <div className="relative h-dvh w-full overflow-hidden" data-phase={phase.kind}>
        <AnimatePresence>
          {content && (
            <motion.section
              key={key}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.3 } }}
              exit={{ opacity: 0, transition: { duration: 0.3, delay: phase.kind === 'playing' ? 0.05 : 0 } }}
            >
              {content}
            </motion.section>
          )}
        </AnimatePresence>
        <GoBurst burstKey={burst} />
      </div>
    </RoundMenuProvider>
  )
}
