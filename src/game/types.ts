// Shared domain types. This file is the contract between the host game logic,
// the network layer and the UI. Keep it dependency-free and serializable:
// everything in RoomState travels over the wire as JSON.

import type { MessageKey, Msg } from '../i18n'

export type PlayerId = string

/** What a player chooses about themselves; persisted in localStorage. */
export interface PlayerProfile {
  /** Stable random id (persisted), used to re-attach after a refresh. */
  id: PlayerId
  /** 1..16 chars, trimmed. */
  name: string
  /** Index into AVATARS (src/game/constants.ts). */
  avatar: number
  /** Index into PLAYER_COLORS (src/game/constants.ts). */
  color: number
}

export interface Player extends PlayerProfile {
  isHost: boolean
  connected: boolean
  /** Total points across completed rounds. */
  score: number
  /** Round index this player can first play (late joiners spectate until then). */
  activeFromRound: number
}

export interface PlaylistRef {
  id: number
  title: string
  /** Square cover, ~500px. */
  picture: string
  nbTracks: number
  creator?: string
}

export interface GameSettings {
  /** Number of rounds, one song per round. */
  rounds: number
  /** Number of snippets each song is cut into. */
  snippets: number
  /** Seconds per round. */
  roundTime: number
  /** Seconds left for everyone once the first player confirms (GeoGuessr style). */
  finalTimer: number
  playlist: PlaylistRef | null
}

/** A playable Deezer track (only what the game needs). */
export interface TrackInfo {
  id: number
  title: string
  artist: string
  album: string
  /** Large album cover (~1000px). */
  cover: string
  /** Small album cover (~250px). */
  coverSmall: string
  /** Signed 30s MP3 preview URL. EXPIRES after ~15 minutes — prefetch early. */
  preview: string
  /** deezer.com link to the track. */
  link: string
  rank: number
  durationSec: number
}

/** One cut of the preview, identified by its correct position. */
export interface Segment {
  /** Correct 0-based position in the song. */
  index: number
  /** Start time (seconds) inside the preview audio. */
  start: number
  /** End time (seconds) inside the preview audio. */
  end: number
  /** Musical length in beats (informational, 0 if unknown). */
  beats: number
}

/** A prepared round as seen by every peer. */
export interface RoundPublic {
  /** 0-based round index. */
  index: number
  track: TrackInfo
  /** Segments in CORRECT order (segments[i].index === i). */
  segments: Segment[]
  /**
   * Arrangement shown at round start: initialOrder[position] = segment index.
   * Guaranteed to be a derangement with no correct adjacent pairs, so an
   * untouched board scores 0.
   */
  initialOrder: number[]
  /** Hue (0..360) per segment index. Random — never correlated with the correct order. */
  hues: number[]
  /** Detected tempo, 0 if unknown. */
  bpm: number
}

/**
 * Game phase. All timestamps are HOST clock milliseconds (Date.now() on the host).
 * Clients convert with the clock offset (see src/game/clock.ts).
 */
export type Phase =
  | { kind: 'lobby' }
  /** Host is picking tracks / downloading / analyzing; peers download audio. */
  | { kind: 'preparing'; round: number; message?: MessageKey }
  /** Round intro card + 3-2-1 countdown. */
  | { kind: 'intro'; round: number; endsAt: number }
  | {
      kind: 'playing'
      round: number
      startedAt: number
      endsAt: number
      /** Set once someone confirms; endsAt has then been pulled in to the final timer. */
      firstSubmit: { playerId: PlayerId; at: number } | null
    }
  /** Round results. nextAt = auto-advance time (null = wait for host). */
  | { kind: 'reveal'; round: number; nextAt: number | null }
  | { kind: 'final' }

export type PhaseKind = Phase['kind']

/** Per-player score of one round. */
export interface RoundResult {
  playerId: PlayerId
  /** Submitted arrangement: order[position] = segment index. */
  order: number[]
  /** Snippets in the exact right position. */
  correct: number
  /** Adjacent pairs in the right sequence (order[p+1] === order[p] + 1). */
  pairs: number
  points: number
  perfect: boolean
  /** Ms from round start to submission (roundTime*1000 if timed out). */
  timeMs: number
  /** True if the player didn't confirm and their last arrangement was used. */
  timedOut: boolean
}

export interface SubmissionStatus {
  submitted: boolean
  /** Ms from round start. */
  atMs: number
}

/** Authoritative room state, owned by the host and broadcast to every peer. */
export interface RoomState {
  /** Room code (e.g. "KXQPM"). */
  code: string
  hostId: PlayerId
  /** In join order. */
  players: Player[]
  settings: GameSettings
  phase: Phase
  /** Tracks picked for this game (index = round). Empty in lobby. */
  tracks: TrackInfo[]
  /** Prepared rounds by index (sparse while preparing). */
  rounds: (RoundPublic | null)[]
  /** Current-round submission status per player (never the arrangement itself). */
  submissions: Record<PlayerId, SubmissionStatus>
  /** Current-round audio readiness per player. */
  ready: Record<PlayerId, boolean>
  /** Results per completed round index. */
  results: RoundResult[][]
  /** Monotonic version, bumped on every change. */
  seq: number
}

/** Transient things worth an animation/toast; not part of the durable state. */
export type GameEvent =
  | { type: 'player-joined'; playerId: PlayerId; name: string }
  | { type: 'player-left'; playerId: PlayerId; name: string }
  | { type: 'first-submit'; playerId: PlayerId; name: string; endsAt: number }
  | { type: 'submitted'; playerId: PlayerId; name: string }
  | { type: 'reaction'; playerId: PlayerId; emoji: string }
  | { type: 'kicked'; playerId: PlayerId }
  | { type: 'info'; message: Msg }
