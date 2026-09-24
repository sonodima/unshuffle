// Seeds the real store with a fixture room and renders the connected FinalScreen.
import { useLayoutEffect, useState } from 'react'
import { useBackground } from '../../components/background/useBackground'
import { useGame } from '../../game/store'
import type { RoomState } from '../../game/types'
import { FinalScreen } from '../../screens/final/FinalScreen'

export function ConnectedLab({ room, me }: { room: RoomState; me: string }) {
  const [ready, setReady] = useState(false)
  useLayoutEffect(() => {
    const calls: string[] = []
    ;(window as unknown as { __labCalls: string[] }).__labCalls = calls
    useGame.setState({
      room,
      me,
      role: room.hostId === me ? 'host' : 'client',
      connection: 'open',
      backToLobby: () => calls.push('backToLobby'),
      leave: () => calls.push('leave'),
    })
    const unsub = useBackground.subscribe((s, prev) => {
      if (s.accentA !== prev.accentA || s.accentB !== prev.accentB) calls.push(`accent:${s.accentA},${s.accentB}`)
      if (s.pulseSeq !== prev.pulseSeq) calls.push(`pulse:${s.pulseStrength}`)
    })
    setReady(true)
    return unsub
  }, [room, me])
  return ready ? <FinalScreen /> : null
}
