import type { MessageKey } from '../i18n'
import type { GameSettings } from './types'

/** Bump when the wire protocol changes incompatibly. */
export const PROTOCOL_VERSION = 2
/** Prefix for host peer ids on the public PeerJS server (namespaces our rooms). */
export const PEER_PREFIX = 'unshuffle-v1-'

export const MAX_PLAYERS = 10
export const MAX_NAME_LENGTH = 16
/** Room code alphabet: no ambiguous letters (I, O) so codes are easy to read aloud. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
export const ROOM_CODE_LENGTH = 5

/** Max points for one round (perfect order). */
export const MAX_ROUND_POINTS = 5000
/**
 * Share of MAX_ROUND_POINTS awarded for exact positions; the rest is for correct adjacent pairs.
 * Half and half: a song rebuilt in the right sequence but shifted by one block (the classic
 * intro-at-the-end near miss) must beat a scrambled board with a few lucky spots.
 */
export const POSITION_WEIGHT = 0.5

export const INTRO_MS = 4000
export const REVEAL_AUTO_ADVANCE_MS = 25000
/** How long the host waits for every peer to have the round audio decoded. */
export const READY_TIMEOUT_MS = 15000
/**
 * Moves still in flight when a round's clock runs out are accepted this long after `endsAt`
 * (network transit). Clients lock the board at `endsAt`, so nobody gets extra playing time.
 */
export const ARRIVAL_GRACE_MS = 400

export const SETTINGS_OPTIONS = {
  rounds: [3, 5, 7, 10],
  snippets: [6, 8, 12, 16],
  roundTime: [60, 90, 120, 180],
  finalTimer: [10, 15, 20, 30],
} as const

/** Human labels for snippet counts (difficulty). */
export const SNIPPET_DIFFICULTY: Record<number, MessageKey> = {
  6: 'game.difficulty.easy',
  8: 'game.difficulty.normal',
  12: 'game.difficulty.hard',
  16: 'game.difficulty.insane',
}

export const DEFAULT_SETTINGS: GameSettings = {
  rounds: 5,
  snippets: 8,
  roundTime: 90,
  finalTimer: 15,
  playlist: null,
}

/** Player avatars (emoji rendered inside a colored badge). */
export const AVATARS = [
  '🎧', '🎸', '🥁', '🎹', '🎺', '🎷', '🎤', '🪩',
  '👾', '🤖', '🦄', '🐙', '🦊', '🐸', '🐼', '🔥',
  '👽', '🦖', '🐝', '🌶️', '🍕', '💿', '🛸', '👑',
]

/** Player accent colors (hex). Index stored in PlayerProfile.color. */
export const PLAYER_COLORS = [
  '#ff3fd1', // magenta
  '#2ee6ff', // cyan
  '#a6ff3f', // lime
  '#ffd23f', // gold
  '#ff5470', // coral
  '#7b5cff', // violet
  '#ff9a3f', // orange
  '#3fffb2', // mint
  '#5c9dff', // sky
  '#ff7ae0', // pink
  '#c4ff5c', // chartreuse
  '#b98cff', // lavender
]

/** Rematch request, sent from the final screen's 'Rivincita!' button (not shown in reaction bars). */
export const REMATCH_REACTION = '🔁'
/** Every emoji the host relays (anything else is dropped). */
export const REACTIONS = ['🔥', '😂', '😱', '👏', '💀', '🎉', '🤯', '😎', REMATCH_REACTION]
/** Emojis offered in the reaction bars. */
export const REACTION_BAR: readonly string[] = REACTIONS.filter((e) => e !== REMATCH_REACTION)
