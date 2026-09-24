// Wire protocol between peers. Star topology: every client talks only to the
// host; the host is authoritative and broadcasts the full RoomState on change.
// All messages are JSON-serializable and discriminated by `t`.

import type { GameEvent, PlayerId, PlayerProfile, RoomState } from '../game/types'
import type { MessageKey } from '../i18n'

/** Client → Host */
export type ClientMsg =
  /**
   * First message on a new connection. Re-sending the same profile.id re-attaches a known
   * player. `secret` is the sender's private re-attach secret (kept in localStorage, never
   * broadcast): the host binds a seat to the first secret it sees for that id, so a copied
   * profile id can't take someone else's seat. Optional so older clients still get in.
   * `history`: songs this player heard lately (track id → faded play count, see
   * game/history.ts), so the host can pick songs nobody in the room knows by heart.
   */
  | { t: 'hello'; profile: PlayerProfile; version: number; secret?: string; history?: Record<string, number> }
  /** Profile edited in the lobby (name / avatar / color). */
  | { t: 'profile'; profile: PlayerProfile }
  /** Audio for this round is downloaded + decoded on this peer. */
  | { t: 'ready'; round: number }
  /** Live arrangement (debounced). Used if the player times out without confirming. */
  | { t: 'arrange'; round: number; order: number[] }
  /** Final answer for the round. */
  | { t: 'submit'; round: number; order: number[] }
  | { t: 'reaction'; emoji: string }
  /** Clock sync + keepalive. `c` = client Date.now() at send. */
  | { t: 'ping'; c: number }
  | { t: 'leave' }

/** Host → Client */
export type HostMsg =
  /**
   * `mine`: mid-round, the player's own live arrangement as the host last saw it, so a tab
   * that is new to the round continues from the old tab's board.
   */
  | { t: 'welcome'; you: PlayerId; state: RoomState; hostNow: number; mine?: { round: number; order: number[] } }
  | { t: 'state'; state: RoomState; hostNow: number }
  | { t: 'event'; event: GameEvent }
  /** Reply to ping: echoes `c`, adds host time `h`. */
  | { t: 'pong'; c: number; h: number }
  | { t: 'reject'; reason: RejectReason }

export type RejectReason = 'full' | 'version' | 'kicked' | 'closed' | 'duplicate'

export const REJECT_MESSAGES: Record<RejectReason, MessageKey> = {
  full: 'game.reject.full',
  version: 'game.reject.version',
  kicked: 'game.reject.kicked',
  closed: 'game.reject.closed',
  duplicate: 'game.reject.duplicate',
}

export function isClientMsg(x: unknown): x is ClientMsg {
  return typeof x === 'object' && x !== null && typeof (x as { t?: unknown }).t === 'string'
}

export function isHostMsg(x: unknown): x is HostMsg {
  return typeof x === 'object' && x !== null && typeof (x as { t?: unknown }).t === 'string'
}
