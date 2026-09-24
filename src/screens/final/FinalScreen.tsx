// Connected final screen: reads the store, tints the background with the
// winner's colors and pulses it when they land on the podium.
import { useCallback, useEffect, useState } from 'react'
import { useBackground } from '../../components/background/useBackground'
import { playerColor } from '../../components/ui'
import { REACTIONS, REMATCH_REACTION } from '../../game/constants'
import { useActions, useIsHost, useMyId, useRoom } from '../../game/selectors'
import { useGame } from '../../game/store'
import type { PlayerId, RoomState } from '../../game/types'
import { FinalView } from './FinalView'

/**
 * Guests nudge the host for a rematch with this reaction (everyone sees it float up; the
 * host's dock lists who asked). The button only shows while the host relays the emoji,
 * i.e. while it is part of REACTIONS.
 */
const REMATCH_EMOJI = REMATCH_REACTION
const REMATCH_SUPPORTED = (REACTIONS as readonly string[]).includes(REMATCH_EMOJI)

export function FinalScreen() {
  const room = useRoom()
  const me = useMyId()
  const isHost = useIsHost()
  const { backToLobby, leave, react } = useActions()
  const rematchFrom = useRematchRequests(me)
  const rematch = useCallback(() => react(REMATCH_EMOJI), [react])

  const winnerColor = room ? winnerHex(room) : null
  useEffect(() => {
    if (!winnerColor) return
    const bg = useBackground.getState()
    const gold = readToken('--color-gold') ?? winnerColor
    try {
      bg.setAccent(winnerColor, gold)
    } catch {
      // Background is decorative.
    }
    return () => {
      try {
        useBackground.getState().resetAccent()
      } catch {
        // ignore
      }
    }
  }, [winnerColor])

  const pulse = useCallback(() => {
    try {
      useBackground.getState().pulse(1.3)
    } catch {
      // ignore
    }
  }, [])

  if (!room) return null
  return (
    <FinalView
      room={room}
      me={me}
      isHost={isHost}
      onPlayAgain={backToLobby}
      onLeave={leave}
      onWinnerLanded={pulse}
      onRematch={REMATCH_SUPPORTED ? rematch : undefined}
      rematchFrom={rematchFrom}
    />
  )
}

/** Players (other than me) who sent the rematch reaction while this screen was up. */
function useRematchRequests(me: PlayerId): PlayerId[] {
  const [ids, setIds] = useState<PlayerId[]>([])
  useEffect(() => {
    if (!REMATCH_SUPPORTED) return
    return useGame.subscribe((s, prev) => {
      if (s.toasts === prev.toasts) return
      const seen = new Set(prev.toasts.map((t) => t.id))
      const fresh: PlayerId[] = []
      for (const t of s.toasts) {
        if (seen.has(t.id) || t.event.type !== 'reaction' || t.event.emoji !== REMATCH_EMOJI || t.event.playerId === me) continue
        fresh.push(t.event.playerId)
      }
      if (fresh.length) setIds((cur) => (fresh.every((id) => cur.includes(id)) ? cur : [...new Set([...cur, ...fresh])]))
    })
  }, [me])
  return ids
}

/** Accent for the shader: the leader's color (null when nobody scored). */
function winnerHex(room: RoomState): string | null {
  const top = room.players.reduce<RoomState['players'][number] | null>((best, p) => (!best || p.score > best.score ? p : best), null)
  return top && top.score > 0 ? playerColor(top.color) : null
}

function readToken(name: string): string | null {
  if (typeof document === 'undefined') return null
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return /^#[0-9a-f]{6}$/i.test(v) ? v : null
}
