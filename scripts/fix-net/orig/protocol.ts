// Wire protocol between peers. Star topology: every client talks only to the
// host; the host is authoritative and broadcasts the full RoomState on change.
// All messages are JSON-serializable and discriminated by `t`.

import type { GameEvent, PlayerId, PlayerProfile, RoomState } from '../game/types'

/** Client → Host */
export type ClientMsg =
  /** First message on a new connection. Re-sending the same profile.id re-attaches a known player. */
  | { t: 'hello'; profile: PlayerProfile; version: number }
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
  | { t: 'welcome'; you: PlayerId; state: RoomState; hostNow: number }
  | { t: 'state'; state: RoomState; hostNow: number }
  | { t: 'event'; event: GameEvent }
  /** Reply to ping: echoes `c`, adds host time `h`. */
  | { t: 'pong'; c: number; h: number }
  | { t: 'reject'; reason: RejectReason }

export type RejectReason = 'full' | 'version' | 'kicked' | 'closed' | 'duplicate'

export const REJECT_MESSAGES: Record<RejectReason, string> = {
  full: 'La stanza è piena.',
  version: 'Versione del gioco diversa da quella dell’host. Ricarica la pagina.',
  kicked: 'Sei stato rimosso dalla stanza.',
  closed: 'L’host ha chiuso la stanza.',
  duplicate: 'Sei già connesso a questa stanza da un’altra scheda.',
}

export function isClientMsg(x: unknown): x is ClientMsg {
  return typeof x === 'object' && x !== null && typeof (x as { t?: unknown }).t === 'string'
}

export function isHostMsg(x: unknown): x is HostMsg {
  return typeof x === 'object' && x !== null && typeof (x as { t?: unknown }).t === 'string'
}
