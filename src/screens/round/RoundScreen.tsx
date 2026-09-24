// Connected in-round screen (phases preparing · intro · playing · reveal): reads
// the game store + host clock and renders the pure RoundView.
import { useCallback } from 'react'
import { audioEngine } from '../../audio/engine'
import { hostNow, useHostNow } from '../../game/clock'
import { phaseRound, trackKey, useGame } from '../../game/store'
import type { TrackInfo } from '../../game/types'
import { refreshPreview } from '../../lib/deezer'
import { roundInfo } from './model'
import { RevealView } from './reveal/RevealView'
import { RoundView } from './RoundView'

const NO_ORDER: number[] = []

/** Fresh signed URL first (the one in RoomState may have expired), then decode. */
async function reloadTrack(track: TrackInfo): Promise<void> {
  const refresh = () => refreshPreview(track.id)
  const url = await refresh().catch(() => track.preview)
  if (!url) throw new Error('Anteprima non disponibile')
  await audioEngine.load(trackKey(track.id), url, refresh)
}

export function RoundScreen() {
  const room = useGame((s) => s.room)
  const me = useGame((s) => s.me)
  const arrangement = useGame((s) => s.arrangement)
  const arrangementRound = useGame((s) => s.arrangementRound)
  const submitted = useGame((s) => s.submitted)
  const audio = useGame((s) => s.audio)
  const setArrangement = useGame((s) => s.setArrangement)
  const submit = useGame((s) => s.submit)
  const leave = useGame((s) => s.leave)
  const backToLobby = useGame((s) => s.backToLobby)
  // Only a guest's messages travel: the host's own confirm is applied locally.
  const offline = useGame((s) => s.role === 'client' && s.connection !== 'open')
  const now = useHostNow(250)

  const round = phaseRound(room?.phase)
  const track = room && round >= 0 ? roundInfo(room, round).track : null
  const onRetryAudio = useCallback(() => (track ? reloadTrack(track) : Promise.reject(new Error('Nessuna traccia'))), [track])

  if (!room) return null
  return (
    <RoundView
      room={room}
      me={me}
      now={now}
      clock={hostNow}
      arrangement={arrangementRound === round ? arrangement : NO_ORDER}
      submitted={arrangementRound === round && submitted}
      audio={audio}
      onArrange={setArrangement}
      onSubmit={submit}
      onRetryAudio={track ? onRetryAudio : undefined}
      reveal={<RevealView />}
      onLeave={leave}
      onEndGame={backToLobby}
      offline={offline}
    />
  )
}
