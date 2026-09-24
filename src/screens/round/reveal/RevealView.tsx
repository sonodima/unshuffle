// Round reveal — connected. Reads the store + host clock, owns the side effects
// (original song playback, album accents on the shader) and renders RevealLayout.
import { useMemo, useState } from 'react'
import { useLocalSegments } from '../../../components/board'
import { playSfx } from '../../../components/ui'
import { useHostNow } from '../../../game/clock'
import { useIsHost } from '../../../game/selectors'
import { useGame } from '../../../game/store'
import type { RoomState } from '../../../game/types'
import { useStable } from '../hooks'
import { RevealLayout } from './RevealLayout'
import type { RevealEffects } from './RevealLayout'
import { pulseBackground, useAlbumAccent, useRevealSong } from './revealAudio'

const EFFECTS: RevealEffects = { sfx: playSfx, pulse: pulseBackground }

/**
 * Renders while `room.phase.kind === 'reveal'`. When the phase moves on, the
 * round screen keeps this element mounted for its exit fade: it then keeps
 * showing the last reveal (frozen, song fading out) instead of going blank.
 */
export function RevealView() {
  const live = useGame((s) => s.room)
  const me = useGame((s) => s.me)
  const nextRound = useGame((s) => s.nextRound)
  const isHost = useIsHost()
  const now = useHostNow(250)

  const liveReveal = live?.phase.kind === 'reveal' ? live : null
  const [last, setLast] = useState<RoomState | null>(liveReveal)
  if (liveReveal && liveReveal !== last) setLast(liveReveal)
  const room = liveReveal ?? last
  const exiting = !liveReveal

  const round = room?.phase.kind === 'reveal' ? room.phase.round : -1
  const track = room && round >= 0 ? (room.rounds[round]?.track ?? room.tracks[round] ?? null) : null
  const songKey = track ? `track:${track.id}` : null
  // Block taps seek to these times: the host's cuts re-snapped onto this peer's decode.
  const segments = useLocalSegments(songKey, useStable(room && round >= 0 ? (room.rounds[round]?.segments ?? null) : null))

  // The song belongs to the live reveal only: it fades out as soon as the phase changes.
  const song = useRevealSong(!exiting ? songKey : null, segments)
  const accent = useAlbumAccent(track?.cover || track?.coverSmall || null)
  const onNext = useMemo(() => (isHost ? () => nextRound() : undefined), [isHost, nextRound])

  if (!room || !track) return null
  return (
    <RevealLayout
      room={room}
      me={me}
      now={now}
      isHost={isHost}
      onNext={onNext}
      accent={accent}
      songPlaying={song.playing}
      songPending={song.pending}
      songPaused={song.paused}
      onToggleSong={song.toggle}
      songProgress={song.progress}
      songSegment={song.segment}
      songSegmentProgress={song.segmentProgress}
      onTapSegment={song.tapSegment}
      effects={EFFECTS}
      className={exiting ? 'pointer-events-none' : undefined}
    />
  )
}
