// Client-side game store (zustand). Single source of truth for the UI.
// Both host and clients use it: on the host, actions go straight into HostGame
// through a local loopback; on clients they are sent over the ClientConnection.
// Everything that is not UI state (connections, timers, prefetch bookkeeping)
// lives in a module-level `Session`, so a stale callback from a previous room
// can always be recognised (`session !== s`) and ignored.

import { create } from 'zustand'
import { audioEngine, evictAudio } from '../audio/engine'
import { sfx } from '../audio/sfx'
import type { SfxName } from '../audio/sfx'
import { refreshPreview } from '../lib/deezer'
import { REJECT_MESSAGES } from '../net/protocol'
import type { ClientMsg, HostMsg, RejectReason } from '../net/protocol'
import { createHost, joinRoom as connectToRoom, normalizeRoomCode } from '../net/transport'
import type { ClientConnection, ConnStatus, HostServer } from '../net/transport'
import { addClockSample, hostNow, resetClock } from './clock'
import { AVATARS, PLAYER_COLORS, PROTOCOL_VERSION } from './constants'
// Host-only code (HostGame + its rules) is loaded when a room is created, not on page load.
import type { HelloMsg, HostGame } from './host'
import { sanitizeName } from './names'
import {
  clearArrangements,
  clearSession,
  isPermutation,
  isRoomCode,
  loadArrangement,
  loadHostSnapshot,
  loadPlayerSecret,
  loadProfile,
  loadSession,
  saveArrangement,
  saveProfile,
  saveSession,
} from './persist'
import { canPrefetchBytes, prefetchPreviewBytes } from './prefetch'
import type { PreviewBytes } from './prefetch'
import type { GameEvent, GameSettings, Phase, Player, PlayerId, PlayerProfile, RoomState, TrackInfo } from './types'

export type Role = 'none' | 'host' | 'client'
export type Connection = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'error' | 'closed'
export type AudioStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface ToastItem {
  id: number
  event: GameEvent
  at: number
}

export interface GameStore {
  /** Local profile (persisted to localStorage). */
  profile: PlayerProfile
  role: Role
  connection: Connection
  /** Human-readable (Italian) error for the current connection problem, if any. */
  error: string | null
  room: RoomState | null
  /** Code of the room being hosted / joined (set while connecting, before `room` exists). */
  roomCode: string | null
  /** My player id (== profile.id once welcomed). */
  me: string
  /** Transient events for toasts / floating reactions (auto-expire). */
  toasts: ToastItem[]

  /** Local arrangement for the current round: arrangement[position] = segment index. */
  arrangement: number[]
  /** Round index `arrangement` belongs to (-1 = none). */
  arrangementRound: number
  /** Did I confirm the current round. */
  submitted: boolean
  /** Audio load status per track id. */
  audio: Record<number, AudioStatus>

  // ---- profile ----
  setProfile(patch: Partial<Omit<PlayerProfile, 'id'>>): void

  // ---- session ----
  /** Create a room and become host. Resolves with the room code. */
  createRoom(): Promise<string>
  /** Join a room as client. Rejects with a user-facing Italian message. */
  joinRoom(code: string): Promise<void>
  /** On boot: resume this tab's previous room after a refresh. Resolves true if a session was resumed. */
  resumeSession(): Promise<boolean>
  /** Client whose connection was lost (`connection === 'closed'`): connect again to the same room. */
  rejoin(): Promise<void>
  /** Leave the room (host: closes it for everyone). */
  leave(): void
  clearError(): void

  // ---- in game (everyone) ----
  setArrangement(order: number[]): void
  submit(): void
  react(emoji: string): void
  /** Local info toast (e.g. "Link copiato"); never sent to anyone. */
  notify(message: string): void
  dismissToast(id: number): void

  // ---- host only (no-ops for clients) ----
  updateSettings(patch: Partial<GameSettings>): void
  startGame(): Promise<void>
  /** Skip the reveal countdown → next round / final. */
  nextRound(): void
  kick(playerId: string): void
  /** From final screen: reset scores and go back to the lobby with same players. */
  backToLobby(): void
}

export const STORE_TIMINGS = {
  toastMs: 4000,
  reactionToastMs: 2500,
  /** Cap for informational toasts; reactions have their own cap so a burst can't push these out. */
  maxToasts: 6,
  maxReactionToasts: 8,
  pingMs: 2000,
  welcomeTimeoutMs: 8000,
  /**
   * The board reports one change per drop, and every change goes to the host at once:
   * a drop in the last moments of a round must never be lost behind a debounce. Only
   * changes closer together than this are coalesced (the latest one is sent at the end).
   */
  arrangeMinIntervalMs: 100,
  /** Inside this window before the deadline every change is sent immediately, no coalescing. */
  arrangeUrgentMs: 2000,
  profileDebounceMs: 300,
  maxConcurrentLoads: 2,
  /**
   * Rounds decoded ahead of the current one. A decoded preview is ~11 MB of PCM, so only
   * the current and the next round are decoded; later ones are just downloaded (~0.5 MB).
   */
  decodeAhead: 1,
  maxConcurrentByteFetches: 1,
  /** Download attempts for the current round's track before giving up. */
  maxLoadAttempts: 2,
  /** How long a client resuming after a reload keeps retrying a room that isn't there (yet). */
  resumeRetryMs: 15000,
} as const

export const STORE_MESSAGES = {
  invalidCode: 'Codice stanza non valido.',
  cancelled: 'Operazione annullata.',
  hostLost: 'Connessione con l’host persa.',
  /** The host left for good (closed its tab or the room): nothing to retry. */
  hostGone: 'L’host ha lasciato la partita.',
  welcomeTimeout: 'L’host non risponde. Riprova tra poco.',
  joinFailed: 'Impossibile entrare nella stanza. Riprova.',
  createFailed: 'Impossibile creare la stanza. Riprova.',
  startFailed: 'Impossibile avviare la partita.',
  rejected: 'L’host ha rifiutato la connessione.',
  signalingLost: 'Connessione al server persa: i nuovi giocatori non possono entrare.',
} as const

const NET_ERROR_MESSAGES: Record<string, string> = {
  'room-not-found': 'Stanza non trovata. Controlla il codice.',
  network: 'Problema di rete. Controlla la connessione e riprova.',
  server: 'Server di collegamento non raggiungibile. Riprova tra poco.',
  timeout: 'Nessuna risposta dal server di collegamento. Riprova.',
  unsupported: 'Il tuo browser non supporta le connessioni peer-to-peer (WebRTC).',
}

/** Audio buffer key convention shared by every module. */
export function trackKey(trackId: number): string {
  return `track:${trackId}`
}

/** Round index a phase refers to (-1 for lobby / final). */
export function phaseRound(phase: Phase | null | undefined): number {
  if (!phase) return -1
  switch (phase.kind) {
    case 'preparing':
    case 'intro':
    case 'playing':
    case 'reveal':
      return phase.round
    default:
      return -1
  }
}

/** Late joiners spectate until `activeFromRound`. */
export function isActivePlayer(player: Player | null | undefined, round: number): boolean {
  return !!player && player.activeFromRound <= round
}

// ---------------------------------------------------------------------------
// Session internals

interface Session {
  role: 'host' | 'client'
  code: string
  /** Torn down: listeners removed, nothing more may be sent. */
  closed: boolean
  game: HostGame | null
  server: HostServer | null
  conn: ClientConnection | null
  /** Client: data channel currently open. Host: always true. */
  linkOpen: boolean
  welcomed: boolean
  /** hello already sent on the current link (reset when the link drops). */
  helloOnLink: boolean
  clockSynced: boolean
  cleanups: (() => void)[]
  pingTimer: ReturnType<typeof setInterval> | null
  welcomeTimer: ReturnType<typeof setTimeout> | null
  arrangeTimer: ReturnType<typeof setTimeout> | null
  profileTimer: ReturnType<typeof setTimeout> | null
  welcome: { resolve(): void; reject(error: Error): void } | null
  joinPromise: Promise<void> | null
  /** Rounds I already told the host I'm ready for. */
  readySent: Set<number>
  /** `${round}:${trackId}` the current arrangement belongs to. */
  arrangementKey: string
  /** Arrangement changed but not yet delivered to the host. */
  arrangeDirty: boolean
  /** Date.now() of the last arrangement sent (coalescing). */
  lastArrangeAt: number
  /** Confirmed while the link was down: the submit still has to reach the host. */
  submitPending: boolean
  /** The submit already went out on the current link (reset when the link drops). */
  submitOnLink: boolean
  /** Host's copy of my arrangement from the last welcome (a new tab picks up where the old one was). */
  hostArrangement: { round: number; order: number[] } | null
  /** Compressed previews of rounds beyond the decode window, by track id. */
  bytes: Map<number, PreviewBytes>
  activeByteFetches: number
  inLobby: boolean
  loadAttempts: Map<number, number>
  activeLoads: number
  /** Host: last state object received from HostGame. */
  lastHostState: RoomState | null
  /** Host: pending createRoom (dedupes double clicks). */
  hostPromise: Promise<string> | null
  /** Profile edited before the host welcomed us (hello carried the old one). */
  profileDirty: boolean
}

let session: Session | null = null

function newSession(role: Session['role'], code: string): Session {
  return {
    role,
    code,
    closed: false,
    game: null,
    server: null,
    conn: null,
    linkOpen: false,
    welcomed: false,
    helloOnLink: false,
    clockSynced: false,
    cleanups: [],
    pingTimer: null,
    welcomeTimer: null,
    arrangeTimer: null,
    profileTimer: null,
    welcome: null,
    joinPromise: null,
    readySent: new Set(),
    arrangementKey: '',
    arrangeDirty: false,
    lastArrangeAt: Number.NEGATIVE_INFINITY,
    submitPending: false,
    submitOnLink: false,
    hostArrangement: null,
    bytes: new Map(),
    activeByteFetches: 0,
    inLobby: false,
    loadAttempts: new Map(),
    activeLoads: 0,
    lastHostState: null,
    hostPromise: null,
    profileDirty: false,
  }
}

const ROUND_RESET = { arrangement: [] as number[], arrangementRound: -1, submitted: false }

function get(): GameStore {
  return useGame.getState()
}

function set(patch: Partial<GameStore>): void {
  useGame.setState(patch)
}

function safe(fn: () => void): void {
  try {
    fn()
  } catch (err) {
    console.warn('[store]', err)
  }
}

function playSfx(name: SfxName): void {
  try {
    sfx?.play(name)
  } catch {
    // SFX are decoration; a missing / failing synth must never break the game.
  }
}

function errorCode(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null
  const code = (err as { code?: unknown }).code
  return typeof code === 'string' ? code : null
}

/** The transport's NetErrors already carry Italian, context-specific messages; anything else is mapped by code. */
function netErrorMessage(err: unknown, fallback: string): string {
  const code = errorCode(err)
  if (code && err instanceof Error && err.name === 'NetError' && err.message) return err.message
  return (code && NET_ERROR_MESSAGES[code]) || fallback
}

function toRoomCode(input: string): string | null {
  const code = normalizeRoomCode(input)
  return code && isRoomCode(code) ? code : null
}

function roomCodeFromHash(): string | null {
  try {
    if (typeof location === 'undefined') return null
    const match = /^#\/r\/([A-Za-z]+)/.exec(location.hash)
    return match && isRoomCode(match[1].toUpperCase()) ? match[1].toUpperCase() : null
  } catch {
    return null
  }
}

/** Replace the URL fragment (no history entry) and notify hash routers. */
function setHash(hash: string): void {
  try {
    if (typeof location === 'undefined' || location.hash === hash) return
    const oldURL = location.href
    if (typeof history !== 'undefined' && typeof history.replaceState === 'function') {
      history.replaceState(history.state, '', hash)
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        const ev =
          typeof HashChangeEvent === 'function'
            ? new HashChangeEvent('hashchange', { oldURL, newURL: location.href })
            : new Event('hashchange')
        window.dispatchEvent(ev)
      }
    } else {
      location.hash = hash
    }
  } catch {
    // Sandboxed / non-browser environment: the hash is only cosmetic.
  }
}

function setRoomHash(code: string): void {
  setHash(`#/r/${code}`)
}

function setHomeHash(): void {
  try {
    if (typeof location !== 'undefined' && location.hash.startsWith('#/r/')) setHash('#/')
  } catch {
    // ignore
  }
}

function teardown(s: Session): void {
  s.closed = true
  s.linkOpen = false
  for (const off of s.cleanups.splice(0)) safe(off)
  if (s.pingTimer) clearInterval(s.pingTimer)
  if (s.welcomeTimer) clearTimeout(s.welcomeTimer)
  if (s.arrangeTimer) clearTimeout(s.arrangeTimer)
  if (s.profileTimer) clearTimeout(s.profileTimer)
  s.pingTimer = s.welcomeTimer = s.arrangeTimer = s.profileTimer = null
  for (const bytes of s.bytes.values()) safe(() => bytes.release())
  s.bytes.clear()
}

/** Close the network side of a session. `notify`: tell the host we are leaving. */
function shutdown(s: Session, notify: boolean): void {
  if (s.role === 'client' && notify && s.linkOpen && s.conn) {
    const conn = s.conn
    safe(() => conn.send({ t: 'leave' }))
  }
  teardown(s)
  if (s.role === 'host') {
    const { game, server } = s
    if (game) safe(() => game.destroy())
    else if (server) safe(() => server.close())
  } else if (s.conn) {
    const conn = s.conn
    safe(() => conn.close())
  }
}

function rejectWelcome(s: Session, message: string): void {
  const pending = s.welcome
  s.welcome = null
  pending?.reject(new Error(message))
}

/** Joining / hosting failed before we got in: back to the home screen with an error. */
function failSession(s: Session, message: string): void {
  if (session !== s) return
  shutdown(s, false)
  session = null
  set({ role: 'none', connection: 'error', error: message, room: null, roomCode: null, ...ROUND_RESET, audio: {} })
  rejectWelcome(s, message)
}

/** Remove a session without touching UI state (used before starting another one). */
function discardSession(notify: boolean): void {
  const s = session
  if (!s) return
  session = null
  shutdown(s, notify)
  rejectWelcome(s, STORE_MESSAGES.cancelled)
  clearSession(s.code)
}

// ---- sending ----------------------------------------------------------------

/** The single outgoing path: host → HostGame loopback, client → data channel. */
function send(s: Session | null, msg: ClientMsg): boolean {
  if (!s || s.closed || session !== s) return false
  try {
    if (s.role === 'host') {
      if (!s.game) return false
      s.game.handleLocal(msg)
      return true
    }
    if (!s.conn || !s.linkOpen) return false
    s.conn.send(msg)
    return true
  } catch (err) {
    console.warn('[store] send failed', err)
    return false
  }
}

function sendHello(s: Session): void {
  if (!s.conn || s.closed) return
  const conn = s.conn
  s.helloOnLink = true
  const { id, name, avatar, color } = get().profile
  // The secret proves this browser owns the seat (player ids are public); it never leaves the host.
  const hello: HelloMsg = { t: 'hello', profile: { id, name, avatar, color }, version: PROTOCOL_VERSION, secret: loadPlayerSecret(id) }
  safe(() => conn.send(hello))
}

function ping(s: Session): void {
  if (s.role === 'client' && s.linkOpen && s.conn && !s.closed) {
    const conn = s.conn
    safe(() => conn.send({ t: 'ping', c: Date.now() }))
  }
}

// ---- toasts -----------------------------------------------------------------

let nextToastId = 1
const toastTimers = new Map<number, ReturnType<typeof setTimeout>>()

function clearToastTimer(id: number): void {
  const timer = toastTimers.get(id)
  if (timer !== undefined) clearTimeout(timer)
  toastTimers.delete(id)
}

function clearAllToasts(): void {
  for (const timer of toastTimers.values()) clearTimeout(timer)
  toastTimers.clear()
}

function pushToast(event: GameEvent): number {
  const id = nextToastId++
  let toasts = [...get().toasts, { id, event, at: Date.now() }]
  // Separate caps: a burst of reactions only ever drops older reactions.
  const isReaction = event.type === 'reaction'
  const cap = isReaction ? STORE_TIMINGS.maxReactionToasts : STORE_TIMINGS.maxToasts
  let sameKind = toasts.filter((t) => (t.event.type === 'reaction') === isReaction).length
  while (sameKind > cap) {
    const drop = toasts.find((t) => (t.event.type === 'reaction') === isReaction)
    if (!drop) break
    clearToastTimer(drop.id)
    toasts = toasts.filter((t) => t !== drop)
    sameKind--
  }
  set({ toasts })
  const ttl = event.type === 'reaction' ? STORE_TIMINGS.reactionToastMs : STORE_TIMINGS.toastMs
  toastTimers.set(id, setTimeout(() => dismissToast(id), ttl))
  return id
}

function dismissToast(id: number): void {
  clearToastTimer(id)
  const { toasts } = get()
  if (toasts.some((t) => t.id === id)) set({ toasts: toasts.filter((t) => t.id !== id) })
}

function infoToast(message: string): void {
  pushToast({ type: 'info', message })
}

function handleEvent(event: GameEvent): void {
  const { me, toasts } = get()
  const self = 'playerId' in event && event.playerId === me
  switch (event.type) {
    case 'player-joined':
      if (self) return
      playSfx('join')
      break
    case 'player-left':
      if (self) return
      playSfx('leave')
      break
    case 'first-submit':
      if (self) return
      playSfx('alarm')
      break
    case 'submitted':
      if (self) return
      // The first confirmation already shows a (louder) first-submit toast.
      if (toasts.some((t) => t.event.type === 'first-submit' && t.event.playerId === event.playerId)) return
      break
    case 'kicked':
      if (self) return
      break
    case 'reaction':
      playSfx('pop')
      break
    case 'info':
      break
  }
  pushToast(event)
}

// ---- room state -------------------------------------------------------------

function myPlayer(room: RoomState, me: PlayerId): Player | undefined {
  return room.players.find((p) => p.id === me)
}

function isIndex(value: unknown, length: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < length
}

function sameOrder(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

/**
 * Apply a new authoritative RoomState and derive the round-local fields from it.
 * `attached`: this state comes with a (re)attach to the host → resync everything.
 */
function applyRoom(s: Session, room: RoomState, attached = false): void {
  if (session !== s) return
  const st = get()
  const patch: Partial<GameStore> = { room }
  if (room.code && room.code !== st.roomCode) patch.roomCode = room.code
  const phase = room.phase

  if (phase.kind === 'lobby') {
    if (!s.inLobby) {
      // A (new) game hasn't started: forget everything round-local.
      s.inLobby = true
      s.readySent.clear()
      s.arrangementKey = ''
      s.arrangeDirty = false
      s.submitPending = false
      s.hostArrangement = null
      if (s.arrangeTimer) clearTimeout(s.arrangeTimer)
      s.arrangeTimer = null
      clearArrangements(room.code)
      Object.assign(patch, ROUND_RESET)
    }
  } else {
    s.inLobby = false
    const r = phaseRound(phase)
    const round = r >= 0 ? room.rounds[r] : null
    if (round) {
      const key = `${r}:${round.track.id}`
      const confirmedByHost = phase.kind === 'playing' && room.submissions[st.me]?.submitted === true
      if (key !== s.arrangementKey) {
        if (s.arrangeTimer) clearTimeout(s.arrangeTimer)
        s.arrangeTimer = null
        s.arrangementKey = key
        s.submitPending = false
        const n = round.initialOrder.length
        // This tab's own copy (a reload) wins; a tab new to the round continues from what the
        // host last saw of me (the seat moved here from another tab); otherwise a fresh board.
        const saved = loadArrangement(room.code, r, round.track.id, n)
        const fromHost = s.hostArrangement?.round === r && isPermutation(s.hostArrangement.order, n) ? [...s.hostArrangement.order] : null
        s.hostArrangement = null
        const order = saved ?? fromHost
        s.arrangeDirty = order !== null && !sameOrder(order, round.initialOrder)
        if (!saved && fromHost) saveArrangement(room.code, r, round.track.id, fromHost)
        patch.arrangement = order ?? [...round.initialOrder]
        patch.arrangementRound = r
        patch.submitted = confirmedByHost
      } else if (confirmedByHost && !st.submitted) {
        patch.submitted = true
      }
    }
  }

  set(patch)
  if (st.room?.phase.kind !== phase.kind || phaseRound(st.room?.phase) !== phaseRound(phase)) evictFinished(s, room)
  pumpPrefetch(s)
  if (attached) resync(s)
  else {
    if ((s.arrangeDirty || s.submitPending) && !s.arrangeTimer && s.linkOpen) flushPendingMoves(s)
    maybeSendReady(s)
  }
}

/**
 * After (re)attaching to the host: make sure it knows my arrangement, confirmation and
 * readiness. The arrangement goes out even when it is the untouched board: after a seat
 * moved to this tab, what the host scores must be what this screen shows.
 */
function resync(s: Session): void {
  const st = get()
  const room = st.room
  if (!room) return
  const phase = room.phase
  if (
    (phase.kind === 'intro' || phase.kind === 'playing') &&
    phase.round === st.arrangementRound &&
    isActivePlayer(myPlayer(room, st.me), phase.round)
  ) {
    if (st.submitted) {
      if (phase.kind === 'playing' && !room.submissions[st.me]?.submitted && !s.submitOnLink) sendSubmit(s, phase.round, st.arrangement)
    } else if (room.rounds[phase.round]) {
      sendArrange(s, phase.round, st.arrangement)
    }
  }
  s.readySent.clear()
  maybeSendReady(s)
}

/**
 * The link just came back (before the host even welcomed us again): moves made while it
 * was down go out right behind the hello — the host handles them in order — so a quick
 * reconnect near the deadline still makes it.
 */
function flushPendingMoves(s: Session): void {
  const st = get()
  const room = st.room
  if (!room || room.phase.kind !== 'playing' || room.phase.round !== st.arrangementRound) return
  if (!isActivePlayer(myPlayer(room, st.me), room.phase.round)) return
  if (st.submitted) {
    if (s.submitPending) sendSubmit(s, room.phase.round, st.arrangement)
  } else if (s.arrangeDirty) {
    sendArrange(s, room.phase.round, st.arrangement)
  }
}

function sendSubmit(s: Session, round: number, order: readonly number[]): void {
  const ok = send(s, { t: 'submit', round, order: [...order] })
  s.submitPending = !ok
  if (ok) {
    s.arrangeDirty = false
    s.submitOnLink = true
  }
}

// ---- arrangement ------------------------------------------------------------

function flushArrange(s: Session): void {
  if (s.arrangeTimer) clearTimeout(s.arrangeTimer)
  s.arrangeTimer = null
  const st = get()
  const room = st.room
  if (!room || st.submitted || st.arrangementRound < 0) return
  const phase = room.phase
  // The host keeps arrangements from the intro on (the board is live during the countdown).
  if ((phase.kind !== 'intro' && phase.kind !== 'playing') || phase.round !== st.arrangementRound) return
  if (!isActivePlayer(myPlayer(room, st.me), phase.round)) return
  sendArrange(s, phase.round, st.arrangement)
}

function sendArrange(s: Session, round: number, order: readonly number[]): void {
  const ok = send(s, { t: 'arrange', round, order: [...order] })
  // A failed send (link down) stays dirty: it goes out as soon as the link is back.
  s.arrangeDirty = !ok
  if (ok) s.lastArrangeAt = Date.now()
}

/** Close to the round's deadline (host clock): no coalescing at all. */
function nearDeadline(room: RoomState): boolean {
  const phase = room.phase
  return phase.kind === 'playing' && phase.endsAt - hostNow() < STORE_TIMINGS.arrangeUrgentMs
}

/** Send the new arrangement now, or — right after another one — at the end of a short window. */
function scheduleArrange(s: Session): void {
  const room = get().room
  const wait = s.lastArrangeAt + STORE_TIMINGS.arrangeMinIntervalMs - Date.now()
  if (wait <= 0 || (room && nearDeadline(room))) {
    flushArrange(s)
    return
  }
  if (s.arrangeTimer) return // already due: it sends the latest arrangement
  s.arrangeTimer = setTimeout(() => {
    s.arrangeTimer = null
    if (session === s) flushArrange(s)
  }, wait)
}

// ---- audio prefetch -----------------------------------------------------------

function setAudioStatus(id: number, status: AudioStatus): void {
  const audio = get().audio
  if (audio[id] !== status) set({ audio: { ...audio, [id]: status } })
}

function currentTrackId(room: RoomState): number | null {
  const r = phaseRound(room.phase)
  if (r < 0) return null
  return room.rounds[r]?.track.id ?? room.tracks[r]?.id ?? null
}

/** Tracks of rounds `from`..`to` (inclusive), deduplicated (a spare swapped in is listed next to the original pick). */
function tracksOfRounds(room: RoomState, from: number, to: number): TrackInfo[] {
  const seen = new Set<number>()
  const out: TrackInfo[] = []
  for (let i = from; i <= to; i++) {
    for (const track of [room.rounds[i]?.track, room.tracks[i]]) {
      if (track && typeof track.id === 'number' && !seen.has(track.id)) {
        seen.add(track.id)
        out.push(track)
      }
    }
  }
  return out
}

function roundCount(room: RoomState): number {
  return Math.max(room.tracks.length, room.rounds.length)
}

/**
 * Tracks to decode, most urgent first: the current round, then the next one
 * (STORE_TIMINGS.decodeAhead). Finished rounds are never fetched again (their buffers are
 * evicted), and nothing is needed in the lobby or on the final screen.
 */
function prefetchQueue(room: RoomState): TrackInfo[] {
  const r = phaseRound(room.phase)
  if (r < 0) return []
  return tracksOfRounds(room, r, Math.min(roundCount(room) - 1, r + STORE_TIMINGS.decodeAhead))
}

/** Later rounds: only their compressed preview is downloaded now (see prefetch.ts). */
function bytesQueue(room: RoomState): TrackInfo[] {
  const r = phaseRound(room.phase)
  if (r < 0) return []
  const decoded = new Set(prefetchQueue(room).map((t) => t.id))
  return tracksOfRounds(room, r + STORE_TIMINGS.decodeAhead + 1, roundCount(room) - 1).filter((t) => !decoded.has(t.id))
}

/**
 * Frees decoded audio of tracks no longer needed (finished rounds; everything in the
 * lobby / on the final screen): a decoded 30 s preview is ~11 MB, which adds up on
 * phones over a 10-round game. Status and attempts are forgotten too, so a later
 * game that picks the same track downloads it again. Downloaded bytes of tracks that
 * left the game (a spare swapped in, a new game) are released as well.
 */
function evictFinished(s: Session, room: RoomState): void {
  const keep = new Set(prefetchQueue(room).map((t) => t.id))
  const upcoming = new Set(bytesQueue(room).map((t) => t.id))
  for (const [id, bytes] of [...s.bytes]) {
    // Entering the decode window is not "leaving": loadTrack takes those bytes over.
    if (upcoming.has(id) || keep.has(id)) continue
    safe(() => bytes.release())
    s.bytes.delete(id)
  }
  const audio = get().audio
  const ids = Object.keys(audio)
  if (ids.length === 0) return
  let next: Record<number, AudioStatus> | null = null
  for (const key of ids) {
    const id = Number(key)
    if (keep.has(id) || audio[id] === 'loading') continue
    try {
      evictAudio(trackKey(id))
    } catch {
      // ignore: eviction is an optimisation
    }
    s.loadAttempts.delete(id)
    next ??= { ...audio }
    delete next[id]
  }
  if (next) set({ audio: next })
}

function canRetryLoad(s: Session, id: number): boolean {
  return (s.loadAttempts.get(id) ?? 0) < STORE_TIMINGS.maxLoadAttempts
}

function pumpPrefetch(s: Session): void {
  if (session !== s || s.closed) return
  const room = get().room
  if (!room || (room.tracks.length === 0 && room.rounds.length === 0)) return
  const current = currentTrackId(room)
  for (const track of prefetchQueue(room)) {
    if (s.activeLoads >= STORE_TIMINGS.maxConcurrentLoads) return
    const status = get().audio[track.id]
    if (status === 'loading' || status === 'ready') continue
    // Failed tracks only get another attempt once they are the one that matters now.
    if (status === 'error' && !(track.id === current && canRetryLoad(s, track.id))) continue
    void loadTrack(s, track)
  }
  pumpBytes(s, room)
}

/** Background downloads of later rounds, one at a time and only while nothing is being decoded. */
function pumpBytes(s: Session, room: RoomState): void {
  if (s.activeLoads > 0 || !canPrefetchBytes()) return
  for (const track of bytesQueue(room)) {
    if (s.activeByteFetches >= STORE_TIMINGS.maxConcurrentByteFetches) return
    if (s.bytes.has(track.id) || get().audio[track.id] !== undefined || !track.preview) continue
    let entry: PreviewBytes
    try {
      entry = prefetchPreviewBytes(track.preview)
    } catch {
      return
    }
    s.bytes.set(track.id, entry)
    s.activeByteFetches++
    void entry.ready.then(() => {
      if (session !== s || s.closed) return
      s.activeByteFetches = Math.max(0, s.activeByteFetches - 1)
      pumpPrefetch(s)
    })
  }
}

async function loadTrack(s: Session, track: TrackInfo): Promise<void> {
  const id = track.id
  s.activeLoads++
  s.loadAttempts.set(id, (s.loadAttempts.get(id) ?? 0) + 1)
  setAudioStatus(id, 'loading')
  // Downloaded earlier? Decode those bytes (the engine falls back to a fresh URL if needed).
  const bytes = s.bytes.get(id) ?? null
  let ok = false
  try {
    const engine = audioEngine
    if (!engine || typeof engine.load !== 'function') throw new Error('audio engine unavailable')
    const refresh = () => refreshPreview(id)
    const local = bytes ? await bytes.ready : null
    const url = local || track.preview || (await refresh())
    await engine.load(trackKey(id), url, refresh)
    ok = true
  } catch (err) {
    console.warn(`[store] audio for track ${id} failed`, err)
  }
  if (bytes) {
    safe(() => bytes.release())
    if (s.bytes.get(id) === bytes) s.bytes.delete(id)
  }
  if (session !== s || s.closed) return
  s.activeLoads = Math.max(0, s.activeLoads - 1)
  setAudioStatus(id, ok ? 'ready' : 'error')
  const room = get().room
  if (!ok && room && currentTrackId(room) === id && !canRetryLoad(s, id)) {
    // The title is the answer: never name the song before its reveal.
    infoToast(
      room.phase.kind === 'reveal'
        ? `Audio di “${track.title}” non disponibile.`
        : 'Audio di questo round non disponibile: puoi comunque giocare.',
    )
  }
  pumpPrefetch(s)
  maybeSendReady(s)
}

/** Tell the host this round's audio is decoded (or definitively failed — waiting won't help). */
function maybeSendReady(s: Session): void {
  if (session !== s || s.closed) return
  const { room, audio } = get()
  if (!room) return
  const phase = room.phase
  if (phase.kind !== 'preparing' && phase.kind !== 'intro' && phase.kind !== 'playing') return
  const r = phase.round
  const round = room.rounds[r]
  if (!round || s.readySent.has(r)) return
  const status = audio[round.track.id]
  const settled = status === 'ready' || (status === 'error' && !canRetryLoad(s, round.track.id))
  if (!settled) return
  s.readySent.add(r)
  if (!send(s, { t: 'ready', round: r })) s.readySent.delete(r)
}

// ---- host ---------------------------------------------------------------------

function hostRoom(reclaim?: { code: string; restore: RoomState }): Promise<string> {
  const current = session
  if (!reclaim && current && current.role === 'host' && !current.closed && current.hostPromise) return current.hostPromise
  return startHosting(reclaim)
}

function startHosting(reclaim?: { code: string; restore: RoomState }): Promise<string> {
  discardSession(true)
  clearAllToasts()
  const s = newSession('host', reclaim?.code ?? '')
  session = s
  const profile = get().profile
  set({
    role: 'host',
    connection: 'connecting',
    error: null,
    room: null,
    roomCode: reclaim?.code ?? null,
    me: profile.id,
    toasts: [],
    ...ROUND_RESET,
    audio: {},
  })
  s.hostPromise = openHost(s, profile, reclaim)
  return s.hostPromise
}

async function openHost(s: Session, profile: PlayerProfile, reclaim?: { code: string; restore: RoomState }): Promise<string> {
  // The host module downloads while the peer registers with the signaling server.
  const hostModule = import('./host')
  hostModule.catch(() => undefined) // handled below; never an unhandled rejection
  let server: HostServer
  try {
    server = await createHost(reclaim ? { code: reclaim.code } : undefined)
  } catch (err) {
    const message = netErrorMessage(err, STORE_MESSAGES.createFailed)
    failSession(s, message)
    throw new Error(message)
  }
  if (session !== s) {
    safe(() => server.close())
    throw new Error(STORE_MESSAGES.cancelled)
  }
  s.server = server
  s.code = server.code

  let game: HostGame
  try {
    const { HostGame } = await hostModule
    if (session !== s) {
      safe(() => server.close())
      throw new Error(STORE_MESSAGES.cancelled)
    }
    game = new HostGame({ server, hostProfile: { ...profile }, restore: reclaim?.restore ?? null })
  } catch (err) {
    if (err instanceof Error && err.message === STORE_MESSAGES.cancelled) throw err
    console.error('[store] HostGame failed to start', err)
    failSession(s, STORE_MESSAGES.createFailed)
    throw new Error(STORE_MESSAGES.createFailed)
  }
  s.game = game
  s.linkOpen = true
  s.welcomed = true
  resetClock(0)

  s.cleanups.push(game.subscribe((state) => applyRoom(s, ownHostState(s, state))))
  s.cleanups.push(
    game.onEvent((event) => {
      if (session === s) handleEvent(event)
    }),
  )
  s.cleanups.push(server.onStatus((status) => handleHostSignal(s, status)))

  if (reclaim && server.code !== reclaim.code) clearSession(reclaim.code)
  set({ connection: 'open', roomCode: server.code, me: profile.id })
  applyRoom(s, ownHostState(s, game.state), true)
  saveSession({ role: 'host', code: server.code })
  setRoomHash(server.code)
  return server.code
}

/**
 * Selectors rely on reference changes. If HostGame ever hands out the same
 * (mutated) object twice, give the UI a fresh copy instead of a stale reference.
 */
function ownHostState(s: Session, state: RoomState): RoomState {
  const same = state === s.lastHostState
  s.lastHostState = state
  if (!same) return state
  try {
    return structuredClone(state)
  } catch {
    return JSON.parse(JSON.stringify(state)) as RoomState
  }
}

/** Signaling-server status on the host. Data connections survive short drops, so this never ends the game. */
function handleHostSignal(s: Session, status: ConnStatus): void {
  if (session !== s || s.closed) return
  switch (status) {
    case 'open':
      set({ connection: 'open', error: get().error === STORE_MESSAGES.signalingLost ? null : get().error })
      break
    case 'connecting':
    case 'reconnecting':
      set({ connection: 'reconnecting' })
      break
    case 'closed':
    case 'error':
      set({ connection: 'open', error: STORE_MESSAGES.signalingLost })
      break
  }
}

function withHostGame(action: (game: HostGame) => void): void {
  const s = session
  if (!s || s.role !== 'host' || !s.game || s.closed) return
  const game = s.game
  try {
    action(game)
  } catch (err) {
    console.warn('[store] host action failed', err)
    infoToast(err instanceof Error && err.message ? err.message : 'Azione non riuscita.')
  }
}

// ---- client -------------------------------------------------------------------

function joinAsClient(input: string, keepRoom = false): Promise<void> {
  const code = toRoomCode(input)
  if (!code) return Promise.reject(new Error(STORE_MESSAGES.invalidCode))

  const current = session
  const connection = get().connection
  // Opening my own room's link while hosting it must never tear the room down.
  if (current && current.role === 'host' && current.code === code && !current.closed) {
    return current.hostPromise ? current.hostPromise.then(() => undefined) : Promise.resolve()
  }
  if (
    current &&
    current.role === 'client' &&
    current.code === code &&
    !current.closed &&
    current.joinPromise &&
    connection !== 'error' &&
    connection !== 'closed'
  ) {
    return current.joinPromise
  }
  // Same room after a lost connection: nothing to say goodbye to. Another room: leave it properly.
  discardSession(!(current && current.code === code))
  if (!keepRoom) clearAllToasts()

  const s = newSession('client', code)
  session = s
  const profile = get().profile
  set({
    role: 'client',
    connection: 'connecting',
    error: null,
    roomCode: code,
    me: profile.id,
    ...(keepRoom ? {} : { room: null, toasts: [], ...ROUND_RESET, audio: {} }),
  })
  if (keepRoom) {
    // Carry over the round-local bookkeeping that matches the kept state. Loads the
    // dead session started will never report back here: only 'ready' survives (the
    // engine shares in-flight downloads, so re-requesting the rest is free).
    const st = get()
    const round = st.room && st.arrangementRound >= 0 ? st.room.rounds[st.arrangementRound] : null
    if (round) s.arrangementKey = `${st.arrangementRound}:${round.track.id}`
    const audio: Record<number, AudioStatus> = {}
    for (const [id, status] of Object.entries(st.audio)) if (status === 'ready') audio[Number(id)] = status
    set({ audio })
  }

  s.joinPromise = (async () => {
    let conn: ClientConnection
    try {
      conn = await connectToRoom(code)
    } catch (err) {
      const message = netErrorMessage(err, STORE_MESSAGES.joinFailed)
      failSession(s, message)
      // Keep the transport's error code: resume() retries the transient ones.
      throw Object.assign(new Error(message), { netCode: errorCode(err) })
    }
    if (session !== s) {
      safe(() => conn.close())
      throw new Error(STORE_MESSAGES.cancelled)
    }
    s.conn = conn
    s.linkOpen = true

    const welcomed = new Promise<void>((resolve, reject) => {
      s.welcome = { resolve, reject }
    })
    s.welcomeTimer = setTimeout(() => {
      s.welcomeTimer = null
      if (session === s && !s.welcomed) failSession(s, STORE_MESSAGES.welcomeTimeout)
    }, STORE_TIMINGS.welcomeTimeoutMs)

    s.cleanups.push(conn.onMessage((msg) => handleHostMsg(s, msg)))
    // The transport may replay its current status right here (→ hello already sent).
    s.cleanups.push(conn.onStatus((status, detail) => handleClientStatus(s, status, detail)))
    s.pingTimer = setInterval(() => ping(s), STORE_TIMINGS.pingMs)
    if (s.linkOpen && !s.helloOnLink) sendHello(s)
    await welcomed
  })()
  return s.joinPromise
}

function handleHostMsg(s: Session, msg: HostMsg): void {
  if (session !== s || s.closed || typeof msg !== 'object' || msg === null) return
  switch (msg.t) {
    case 'welcome': {
      const first = !s.welcomed
      s.welcomed = true
      if (s.welcomeTimer) clearTimeout(s.welcomeTimer)
      s.welcomeTimer = null
      const mine = msg.mine
      s.hostArrangement = mine && typeof mine.round === 'number' && Array.isArray(mine.order) ? { round: mine.round, order: [...mine.order] } : null
      // Rough offset until the first pong arrives (one-way latency off, but close).
      if (!s.clockSynced && typeof msg.hostNow === 'number') resetClock(msg.hostNow - Date.now())
      set({ me: typeof msg.you === 'string' && msg.you ? msg.you : get().profile.id, connection: s.linkOpen ? 'open' : get().connection, error: null })
      applyRoom(s, msg.state, true)
      if (s.profileDirty) {
        s.profileDirty = false
        send(s, { t: 'profile', profile: { ...get().profile } })
      }
      if (first) {
        saveSession({ role: 'client', code: s.code })
        setRoomHash(s.code)
      }
      ping(s)
      const pending = s.welcome
      s.welcome = null
      pending?.resolve()
      break
    }
    case 'state': {
      if (!s.welcomed) return
      const current = get().room
      if (current && current.code === msg.state.code && msg.state.seq <= current.seq) return
      applyRoom(s, msg.state)
      break
    }
    case 'event':
      handleEvent(msg.event)
      break
    case 'pong':
      if (typeof msg.c === 'number' && typeof msg.h === 'number') {
        addClockSample(msg.c, msg.h, Date.now())
        s.clockSynced = true
      }
      break
    case 'reject':
      handleReject(s, msg.reason)
      break
  }
}

function handleReject(s: Session, reason: RejectReason): void {
  if (session !== s) return
  const message = REJECT_MESSAGES[reason] ?? STORE_MESSAGES.rejected
  const wasInRoom = s.welcomed
  session = null
  shutdown(s, false)
  clearSession(s.code)
  clearAllToasts()
  set({ role: 'none', connection: 'closed', error: message, room: null, roomCode: null, toasts: [], ...ROUND_RESET, audio: {} })
  if (wasInRoom) setHomeHash()
  rejectWelcome(s, message)
}

function handleClientStatus(s: Session, status: ConnStatus, detail?: string): void {
  if (session !== s || s.closed) return
  switch (status) {
    case 'open':
      s.linkOpen = true
      if (!s.helloOnLink) sendHello(s)
      if (s.welcomed) {
        flushPendingMoves(s)
        set({ connection: 'open' })
      }
      break
    case 'connecting':
    case 'reconnecting':
      s.linkOpen = false
      s.helloOnLink = false
      s.submitOnLink = false
      if (s.welcomed) set({ connection: 'reconnecting' })
      break
    case 'closed':
    case 'error': {
      // 'host-gone' (code gone from the signaling server) and 'host-closed' (bye closed
      // without a reject) mean the host left for good: no point offering Riprova.
      const gone = status === 'closed' && (detail === 'host-gone' || detail === 'host-closed')
      const message = gone ? STORE_MESSAGES.hostGone : STORE_MESSAGES.hostLost
      if (!s.welcomed) failSession(s, message)
      else connectionLost(s, message)
      break
    }
  }
}

/** The transport gave up reconnecting: keep the last state on screen, offer rejoin() / leave(). */
function connectionLost(s: Session, message: string = STORE_MESSAGES.hostLost): void {
  shutdown(s, false)
  set({ connection: 'closed', error: message })
}

// ---- resume -------------------------------------------------------------------

let resuming: Promise<boolean> | null = null

async function resume(): Promise<boolean> {
  if (session) return false
  const saved = loadSession()
  if (!saved) return false
  const linked = roomCodeFromHash()
  if (linked && linked !== saved.code) {
    // The tab was pointed at another room: that link wins.
    clearSession(saved.code)
    return false
  }
  if (saved.role === 'host') {
    const snapshot = loadHostSnapshot(saved.code)
    if (!snapshot) {
      clearSession(saved.code)
      return false
    }
    try {
      await hostRoom({ code: saved.code, restore: snapshot })
      return true
    } catch {
      clearSession(saved.code)
      return false
    }
  }
  // The host may be reloading at the same moment (both tabs refreshed, a network
  // blip): "room not found" / network errors are retried for a while before giving up.
  const deadline = Date.now() + STORE_TIMINGS.resumeRetryMs
  for (let attempt = 0; ; attempt++) {
    try {
      await joinAsClient(saved.code)
      return true
    } catch (err) {
      const netCode = typeof err === 'object' && err !== null ? (err as { netCode?: unknown }).netCode : null
      const transient = typeof netCode === 'string' && RESUME_RETRY_CODES.has(netCode)
      const wait = Math.min(2000, 600 + attempt * 400)
      if (!transient || Date.now() + wait > deadline) break
      await new Promise((r) => setTimeout(r, wait))
      // Cancelled meanwhile (leave() forgets the stored session) or the player moved on.
      if (session !== null || loadSession()?.code !== saved.code) return false
    }
  }
  clearSession(saved.code)
  return false
}

/** NetError codes worth another resume attempt (the host may simply not be back yet). */
const RESUME_RETRY_CODES = new Set(['room-not-found', 'network', 'timeout', 'server'])

// ---------------------------------------------------------------------------

const initialProfile = loadProfile()

export const useGame = create<GameStore>()(() => ({
  profile: initialProfile,
  role: 'none',
  connection: 'idle',
  error: null,
  room: null,
  roomCode: null,
  me: initialProfile.id,
  toasts: [],
  ...ROUND_RESET,
  audio: {},

  setProfile(patch) {
    const current = get().profile
    const name = patch.name === undefined ? current.name : sanitizeName(patch.name) || current.name
    const avatar = isIndex(patch.avatar, AVATARS.length) ? patch.avatar : current.avatar
    const color = isIndex(patch.color, PLAYER_COLORS.length) ? patch.color : current.color
    if (name === current.name && avatar === current.avatar && color === current.color) return
    const profile: PlayerProfile = { id: current.id, name, avatar, color }
    saveProfile(profile)
    set({ profile })
    const s = session
    if (!s || s.closed) return
    if (!s.welcomed) {
      s.profileDirty = true
      return
    }
    if (s.profileTimer) clearTimeout(s.profileTimer)
    s.profileTimer = setTimeout(() => {
      s.profileTimer = null
      send(s, { t: 'profile', profile: { ...get().profile } })
    }, STORE_TIMINGS.profileDebounceMs)
  },

  createRoom: () => hostRoom(),

  joinRoom: (code) => joinAsClient(code),

  resumeSession() {
    if (!resuming) resuming = resume().finally(() => (resuming = null))
    return resuming
  },

  async rejoin() {
    const s = session
    if (!s || s.role !== 'client') return
    await joinAsClient(s.code, true)
  },

  leave() {
    const s = session
    session = null
    if (s) {
      shutdown(s, true)
      rejectWelcome(s, STORE_MESSAGES.cancelled)
      clearSession(s.code)
    } else {
      clearSession(loadSession()?.code)
    }
    clearAllToasts()
    set({ role: 'none', connection: 'idle', error: null, room: null, roomCode: null, toasts: [], ...ROUND_RESET, audio: {} })
    setHomeHash()
  },

  clearError() {
    if (get().error !== null) set({ error: null })
  },

  setArrangement(order) {
    const s = session
    const st = get()
    const room = st.room
    if (!s || s.closed || !room || st.submitted || st.arrangementRound < 0) return
    const phase = room.phase
    if ((phase.kind !== 'preparing' && phase.kind !== 'intro' && phase.kind !== 'playing') || phase.round !== st.arrangementRound) return
    const round = room.rounds[st.arrangementRound]
    if (!round || !isPermutation(order, round.initialOrder.length)) return
    if (sameOrder(order, st.arrangement)) return
    const arrangement = [...order]
    set({ arrangement })
    saveArrangement(room.code, st.arrangementRound, round.track.id, arrangement)
    s.arrangeDirty = true
    scheduleArrange(s)
  },

  submit() {
    const s = session
    const st = get()
    const room = st.room
    if (!s || s.closed || !room || st.submitted) return
    const phase = room.phase
    if (phase.kind !== 'playing' || phase.round !== st.arrangementRound) return
    if (!isActivePlayer(myPlayer(room, st.me), phase.round)) return
    if (s.arrangeTimer) clearTimeout(s.arrangeTimer)
    s.arrangeTimer = null
    // Flag first: the host loopback may synchronously end the round and start the next one.
    set({ submitted: true })
    // Link down: the confirmation (and the arrangement it carries) waits for the link to come back.
    sendSubmit(s, phase.round, st.arrangement)
  },

  react(emoji) {
    if (typeof emoji === 'string' && emoji) send(session, { t: 'reaction', emoji })
  },

  notify(message) {
    if (typeof message === 'string' && message.trim()) infoToast(message.trim())
  },

  dismissToast,

  updateSettings(patch) {
    withHostGame((game) => game.updateSettings(patch))
  },

  async startGame() {
    const s = session
    if (!s || s.role !== 'host' || !s.game || s.closed) return
    try {
      await s.game.startGame()
    } catch (err) {
      throw err instanceof Error && err.message ? err : new Error(STORE_MESSAGES.startFailed)
    }
  },

  nextRound() {
    withHostGame((game) => game.nextRound())
  },

  kick(playerId) {
    withHostGame((game) => game.kick(playerId))
  },

  backToLobby() {
    withHostGame((game) => game.backToLobby())
  },
}))

// Dev only: hot-swapping this module would leave the old session's peer and
// HostGame running behind a fresh, empty store. Reload instead — the tab's
// session survives in sessionStorage and resumeSession() picks the room back up.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (session) location.reload()
  })
}
