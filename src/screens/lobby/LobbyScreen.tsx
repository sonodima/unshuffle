import type { MessageKey } from '../../i18n'
import { ReactionBar } from '../../components/reactions/ReactionBar'
import { useGame } from '../../game/store'
import { LobbyView } from './LobbyView'

/** Connected lobby: reads the game store and hands everything to LobbyView. */
export function LobbyScreen() {
  const room = useGame((s) => s.room)
  const me = useGame((s) => s.me)
  const role = useGame((s) => s.role)
  const updateSettings = useGame((s) => s.updateSettings)
  const startGame = useGame((s) => s.startGame)
  const kick = useGame((s) => s.kick)
  const leave = useGame((s) => s.leave)
  const notify = useGame((s) => s.notify)
  const setProfile = useGame((s) => s.setProfile)

  if (!room) return null
  return (
    <LobbyView
      room={room}
      me={me}
      isHost={role === 'host' || room.hostId === me}
      onUpdateSettings={updateSettings}
      onStart={startGame}
      onKick={kick}
      onLeave={leave}
      onNotify={(text: string) => notify(text as MessageKey)}
      onEditProfile={setProfile}
      reactions={<ReactionBar compact />}
    />
  )
}
