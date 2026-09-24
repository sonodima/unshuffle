// HostGame — authoritative game state machine. Runs ONLY on the host peer.
// Owns the RoomState, applies ClientMsgs from remote connections and from the
// host's own UI (handleLocal), drives the round timeline with timers and
// broadcasts every change. Every side effect goes through HostGameDeps so the
// whole machine runs headless in tests.

import { analyzeAndCut, type CutPlan } from '../audio/analysis'
import { audioEngine } from '../audio/engine'
import { getPlaylistTracks, pickGameTracks, refreshPreview } from '../lib/deezer'
import type { ClientMsg, HostMsg, RejectReason } from '../net/protocol'
import type { HostServer } from '../net/transport'
import {
  ARRIVAL_GRACE_MS,
  AVATARS,
  DEFAULT_SETTINGS,
  INTRO_MS,
  MAX_PLAYERS,
  PLAYER_COLORS,
  PROTOCOL_VERSION,
  REACTIONS,
  READY_TIMEOUT_MS,
  REVEAL_AUTO_ADVANCE_MS,
} from './constants'
import {
  applySettingsPatch,
  buildRoundResults,
  clampIndex,
  cleanPlayerName,
  isPermutation,
  isRecord,
  isRoundPublic,
  isTrackInfo,
  isValidPlayerId,
  planBpm,
  sanitizePhase,
  sanitizeProfile,
  sanitizeSettings,
  segmentsFromPlan,
  settingsEqual,
  uniformSegments,
} from './hostRules'
import { isPlayerSecret, STORAGE_KEYS } from './persist'
import { randomHues, scrambledOrder, shuffleInPlace } from './shuffle'
import type {
  GameEvent,
  GameSettings,
  Phase,
  Player,
  PlayerId,
  PlayerProfile,
  RoomState,
  RoundPublic,
  RoundResult,
  Segment,
  SubmissionStatus,
  TrackInfo,
} from './types'

/** Injectable side effects (defaults = real modules) so the state machine is testable headless. */
export interface HostGameDeps {
  getPlaylistTracks(playlistId: number): Promise<TrackInfo[]>
  pickGameTracks(tracks: TrackInfo[], count: number): TrackInfo[]
  refreshPreview(trackId: number): Promise<string>
  /** Download + decode (key convention `track:${id}`). */
  loadAudio(key: string, url: string, refresh: () => Promise<string>): Promise<AudioBuffer>
  analyzeAndCut(buffer: AudioBuffer, n: number): Promise<CutPlan>
  now(): number
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

export interface HostGameOptions {
  server: HostServer
  hostProfile: PlayerProfile
  /** Previous state to resume (host refresh recovery). */
  restore?: RoomState | null
  deps?: Partial<HostGameDeps>
}

/** Extra tracks picked beyond `rounds`, swapped in when a track fails to load or cut. */
export const SPARE_TRACKS = 4
/** Lobby: a disconnected player is removed after this long unless they re-attach. */
export const LOBBY_GRACE_MS = 15_000
/** Min interval between two reactions of the same player. */
export const REACTION_THROTTLE_MS = 400
/** State broadcasts are coalesced to at most one per interval (≤ 20/s); phase changes go out at once. */
export const STATE_FLUSH_INTERVAL_MS = 50
/** After a host refresh, players count as "still here" for this long while they reconnect. */
export const RESTORE_GRACE_MS = 12_000
/**
 * In game, a player whose link drops (tab reload, phone locked for a moment, Wi-Fi → 4G)
 * keeps their seat silently for this long: still shown as connected, no "ha lasciato la stanza" toast,
 * and still counted by "everyone confirmed" (the round clock keeps running, so this never
 * makes a round longer than its normal end). An explicit leave or a kick is immediate.
 */
export const DISCONNECT_GRACE_MS = 12_000

/**
 * Lobby: a dropped link is announced ('player-left' → toast + sound) only if the player is
 * still gone after this long. A guest reload says goodbye on pagehide and re-attaches within
 * 1–3 s; without the delay everyone would get a leave toast for it.
 */
export const LEFT_NOTICE_MS = 3_500
/** Remembered re-attach secrets (one per player id that ever joined this room). */
const MAX_SECRETS = 200

const PERSIST_THROTTLE_MS = 400
const HELLO_TIMEOUT_MS = 15_000
/** Per step (download, analysis) of a round preparation; a hung step counts as a failure. */
const PREPARE_STEP_TIMEOUT_MS = 30_000
const MAX_SPARE_RETRIES = 3
/** seq jump on restore, so reconnecting clients never see our seq go backwards. */
const RESTORE_SEQ_JUMP = 1000

export const HOST_MESSAGES = {
  picking: 'Scelgo le canzoni…',
  slicing: 'Sto affettando la traccia…',
  syncing: 'Aspetto che tutti siano pronti…',
  noPlaylist: 'Scegli una playlist prima di iniziare.',
  alreadyStarted: 'La partita è già iniziata.',
  closed: 'La stanza è stata chiusa.',
  playlistFailed: 'Non riesco a caricare la playlist da Deezer. Controlla la connessione e riprova.',
  prepareFailed: 'Non sono riuscito a preparare le canzoni di questa playlist, torniamo alla lobby. Prova con un’altra playlist.',
  notEnoughTracks: (n: number) => `Questa playlist non ha abbastanza brani con anteprima (servono almeno ${n}).`,
} as const

/** Window events after which timers may have been throttled or frozen (see catchUp). */
const WAKE_EVENTS = ['visibilitychange', 'pageshow', 'focus', 'online'] as const

/** `hello` with the optional re-attach secret (see net/protocol.ts). */
export type HelloMsg = Extract<ClientMsg, { t: 'hello' }>

/** `welcome` with the optional mid-round `mine` arrangement (see net/protocol.ts). */
export type WelcomeMsg = Extract<HostMsg, { t: 'welcome' }>

/** Audio buffer key convention shared by every module. */
export function trackKey(trackId: number): string {
  return `track:${trackId}`
}

// Real modules, referenced at call time: constructing HostGame with injected
// deps never touches them (they may be unavailable, e.g. in tests).
const realDeps: HostGameDeps = {
  getPlaylistTracks: (id) => getPlaylistTracks(id),
  pickGameTracks: (tracks, count) => pickGameTracks(tracks, count),
  refreshPreview: (id) => refreshPreview(id),
  loadAudio: (key, url, refresh) => audioEngine.load(key, url, refresh),
  analyzeAndCut: (buffer, n) => analyzeAndCut(buffer, n),
  now: () => Date.now(),
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>),
}

function resolveDeps(overrides?: Partial<HostGameDeps>): HostGameDeps {
  const deps: HostGameDeps = { ...realDeps }
  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      if (typeof value === 'function') Object.assign(deps, { [key]: value })
    }
  }
  return deps
}

/** Private per-round data that never travels over the wire. */
interface RoundPrivate {
  round: number
  /** Confirmed arrangements. */
  orders: Map<PlayerId, number[]>
  /** Latest live arrangement per player (scored on time-out). */
  arrangements: Map<PlayerId, number[]>
}

/** Host-only data stored next to the public snapshot (same sessionStorage key, `host` field). */
interface HostPrivateSnapshot {
  round: number
  orders: Record<PlayerId, number[]>
  arrangements: Record<PlayerId, number[]>
  spares: TrackInfo[]
  banned: PlayerId[]
  /** Re-attach secrets by player id (see onHello). Optional: older snapshots don't have it. */
  secrets?: Record<PlayerId, string>
}

function emptyRoundData(round: number): RoundPrivate {
  return { round, orders: new Map(), arrangements: new Map() }
}

function sessionStore(): Storage | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null
  } catch {
    return null
  }
}

function permutationRecord(raw: unknown): Map<PlayerId, number[]> {
  const out = new Map<PlayerId, number[]>()
  if (!isRecord(raw)) return out
  for (const [id, order] of Object.entries(raw)) {
    if (Array.isArray(order) && isPermutation(order, order.length)) out.set(id, [...order])
  }
  return out
}

function readPrivateSnapshot(code: string, seq: unknown): HostPrivateSnapshot | null {
  const storage = sessionStore()
  if (!storage || typeof code !== 'string') return null
  try {
    const raw: unknown = JSON.parse(storage.getItem(STORAGE_KEYS.hostSnapshot(code)) ?? 'null')
    if (!isRecord(raw) || !isRecord(raw.host) || !isRecord(raw.state) || raw.state.seq !== seq) return null
    const host = raw.host
    return {
      round: typeof host.round === 'number' ? host.round : -1,
      orders: Object.fromEntries(permutationRecord(host.orders)),
      arrangements: Object.fromEntries(permutationRecord(host.arrangements)),
      spares: Array.isArray(host.spares) ? host.spares.filter(isTrackInfo) : [],
      banned: Array.isArray(host.banned) ? host.banned.filter(isValidPlayerId) : [],
      secrets: isRecord(host.secrets)
        ? Object.fromEntries(
            Object.entries(host.secrets).filter((e): e is [string, string] => isValidPlayerId(e[0]) && isPlayerSecret(e[1])),
          )
        : {},
    }
  } catch {
    return null
  }
}

function isFiniteNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x)
}

/** Round index a phase is about (-1 for lobby / final). */
function phaseRoundOf(phase: Phase): number {
  return 'round' in phase ? phase.round : -1
}

function sanitizeSubmissions(raw: unknown): Record<PlayerId, SubmissionStatus> {
  const out: Record<PlayerId, SubmissionStatus> = {}
  if (!isRecord(raw)) return out
  for (const [id, s] of Object.entries(raw)) {
    if (isRecord(s) && s.submitted === true && isFiniteNumber(s.atMs)) out[id] = { submitted: true, atMs: s.atMs }
  }
  return out
}

function sanitizeReady(raw: unknown): Record<PlayerId, boolean> {
  const out: Record<PlayerId, boolean> = {}
  if (!isRecord(raw)) return out
  for (const [id, v] of Object.entries(raw)) if (v === true) out[id] = true
  return out
}

function isRoundResult(x: unknown): x is RoundResult {
  return isRecord(x) && isValidPlayerId(x.playerId) && Array.isArray(x.order) && isFiniteNumber(x.points) && isFiniteNumber(x.timeMs)
}

function withoutKey<T>(record: Record<PlayerId, T>, key: PlayerId): Record<PlayerId, T> {
  if (!Object.hasOwn(record, key)) return record
  const next = { ...record }
  delete next[key]
  return next
}

type Patch = Partial<Omit<RoomState, 'seq'>>

export class HostGame {
  private readonly server: HostServer
  private readonly deps: HostGameDeps
  private current: RoomState
  private readonly stateListeners = new Set<(state: RoomState) => void>()
  private readonly eventListeners = new Set<(event: GameEvent) => void>()
  private readonly serverUnsubs: (() => void)[] = []

  private readonly connToPlayer = new Map<string, PlayerId>()
  private readonly playerToConn = new Map<PlayerId, string>()
  private readonly helloTimers = new Map<string, unknown>()
  private readonly graceTimers = new Map<PlayerId, unknown>()
  /** Lobby: pending 'player-left' notices for dropped links (see LEFT_NOTICE_MS). */
  private readonly leftNoticeTimers = new Map<PlayerId, unknown>()
  /** In game: players whose link dropped, waiting DISCONNECT_GRACE_MS for them to re-attach. */
  private readonly dropTimers = new Map<PlayerId, unknown>()
  private readonly lastReactionAt = new Map<PlayerId, number>()
  private readonly banned = new Set<PlayerId>()
  /** Re-attach secret per player id: whoever joined first with an id owns its seat. */
  private readonly secrets = new Map<PlayerId, string>()
  /** Remote PeerJS id (one per browser tab) → the one player identity that tab uses. */
  private readonly peerOwner = new Map<string, PlayerId>()
  /** Connections we rejected: nothing they still send counts (connection ids are never reused). */
  private readonly rejectedConns = new Set<string>()
  private restoredPending = new Set<PlayerId>()
  private restoreGraceTimer: unknown = null

  private roundData: RoundPrivate = emptyRoundData(-1)
  private spares: TrackInfo[] = []
  private readonly prepJobs = new Map<number, Promise<RoundPublic | null>>()
  private readonly prepared = new Map<number, RoundPublic>()
  private readyWaitRound: number | null = null
  private phaseTimer: unknown = null
  /** The pending timeline step (also run by catchUp() when the timer is late: throttled or frozen tab). */
  private phaseDue: { at: number; fn: () => void } | null = null
  private starting: Promise<void> | null = null

  /** Bumped by startGame / backToLobby / destroy: async continuations of an older generation bail out. */
  private gen = 0
  private destroyed = false

  private flushPending = false
  private flushToken = 0
  private flushTimer: unknown = null
  private lastFlushAt = Number.NEGATIVE_INFINITY
  private lastFlushed: RoomState | null = null
  private persistTimer: unknown = null
  private readonly onPageHide = (): void => this.persistNow()
  /** Tab visible / focused / online again: run whatever the (throttled) timers missed. */
  private readonly onWake = (): void => this.guard(() => this.catchUp())

  constructor(opts: HostGameOptions) {
    this.server = opts.server
    this.deps = resolveDeps(opts.deps)
    const profile: PlayerProfile = sanitizeProfile(opts.hostProfile) ?? {
      id: 'host',
      name: cleanPlayerName(isRecord(opts.hostProfile) ? opts.hostProfile.name : ''),
      avatar: 0,
      color: 0,
    }
    const host: Player = { ...profile, isHost: true, connected: true, score: 0, activeFromRound: 0 }
    this.current = {
      code: opts.server.code,
      hostId: host.id,
      players: [host],
      settings: { ...DEFAULT_SETTINGS },
      phase: { kind: 'lobby' },
      tracks: [],
      rounds: [],
      submissions: {},
      ready: {},
      results: [],
      seq: 1,
    }
    this.serverUnsubs.push(
      this.server.onMessage((connId, msg) => this.guard(() => this.onMessage(connId, msg))),
      this.server.onConnect((connId) => this.guard(() => this.onConnect(connId))),
      this.server.onDisconnect((connId) => this.guard(() => this.onDisconnect(connId))),
    )
    if (opts.restore) this.adopt(opts.restore)
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('pagehide', this.onPageHide)
      for (const type of WAKE_EVENTS) window.addEventListener(type, this.onWake)
    }
    this.schedulePersist()
  }

  get state(): RoomState {
    return this.current
  }

  /** Host UI subscription; called with every new state (same objects that get broadcast). */
  subscribe(listener: (state: RoomState) => void): () => void {
    this.stateListeners.add(listener)
    return () => {
      this.stateListeners.delete(listener)
    }
  }

  /** Events for the host's own UI (the same events clients receive). */
  onEvent(listener: (event: GameEvent) => void): () => void {
    this.eventListeners.add(listener)
    return () => {
      this.eventListeners.delete(listener)
    }
  }

  /** The host player's own actions (ready / arrange / submit / reaction / profile) — same semantics as remote messages. */
  handleLocal(msg: ClientMsg): void {
    this.guard(() => {
      if (this.destroyed || typeof msg !== 'object' || msg === null) return
      this.catchUp()
      const hostId = this.current.hostId
      if (msg.t === 'hello') this.updateProfile(hostId, msg.profile)
      else if (msg.t !== 'ping' && msg.t !== 'leave') this.applyPlayerMsg(hostId, msg)
    })
  }

  updateSettings(patch: Partial<GameSettings>): void {
    if (this.destroyed || this.current.phase.kind !== 'lobby') return
    const next = applySettingsPatch(this.current.settings, patch)
    if (!settingsEqual(next, this.current.settings)) this.set({ settings: next })
  }

  /**
   * Rejects with an Italian user-facing message on failure (e.g. playlist without enough playable tracks).
   * Resolves once the tracks are picked and broadcast; round preparation continues in the background
   * (a later failure returns to the lobby with an 'info' event). A second call while starting returns the same promise.
   */
  startGame(): Promise<void> {
    if (this.starting) return this.starting
    const run: Promise<void> = this.runStart().finally(() => {
      if (this.starting === run) this.starting = null
    })
    this.starting = run
    return run
  }

  private async runStart(): Promise<void> {
    if (this.destroyed) throw new Error(HOST_MESSAGES.closed)
    const s = this.current
    if (s.phase.kind !== 'lobby') throw new Error(HOST_MESSAGES.alreadyStarted)
    if (!s.settings.playlist) throw new Error(HOST_MESSAGES.noPlaylist)

    this.gen++
    this.cancelFlow()
    const gen = this.gen
    // Everyone in the room plays from round 0. Players still inside their lobby grace period
    // keep their seat for DISCONNECT_GRACE_MS more, so a refresh at the wrong moment costs
    // nothing; one who never comes back is removed then (see departed) instead of haunting
    // every leaderboard with 0 points.
    for (const p of s.players) this.clearGrace(p.id)
    const players = s.players.map((p) => (p.score === 0 && p.activeFromRound === 0 ? p : { ...p, score: 0, activeFromRound: 0 }))
    for (const p of players) if (!p.isHost && !p.connected) this.armDrop(p.id)
    this.roundData = emptyRoundData(0)
    this.set({
      players,
      phase: { kind: 'preparing', round: 0, message: HOST_MESSAGES.picking },
      tracks: [],
      rounds: [],
      results: [],
      submissions: {},
      ready: {},
    })

    try {
      await this.pickTracks(gen)
    } catch (err) {
      if (gen !== this.gen) return
      const message = err instanceof Error ? err.message : HOST_MESSAGES.playlistFailed
      this.resetToLobby(false)
      // The host sees the rejection; clients just saw the room bounce back to the lobby.
      this.emit({ type: 'info', message }, true)
      throw err instanceof Error ? err : new Error(message)
    }
    if (gen !== this.gen) return
    void this.runRound(0, gen)
  }

  /** Skip the reveal countdown → next round (or final after the last round). No-op outside reveal. */
  nextRound(): void {
    if (this.destroyed) return
    const phase = this.current.phase
    if (phase.kind !== 'reveal') return
    this.clearPhaseTimer()
    const next = phase.round + 1
    if (next >= this.current.tracks.length) {
      this.prepJobs.clear()
      this.prepared.clear()
      this.spares = []
      this.set({ phase: { kind: 'final' }, submissions: {}, ready: {} })
      return
    }
    this.startRound(next)
  }

  kick(playerId: PlayerId): void {
    if (this.destroyed || playerId === this.current.hostId) return
    if (!this.findPlayer(playerId)) return
    this.banned.add(playerId)
    const connId = this.playerToConn.get(playerId)
    if (connId !== undefined) {
      this.playerToConn.delete(playerId)
      this.connToPlayer.delete(connId)
      this.dropConn(connId, 'kicked')
    }
    // Event first, so clients can still resolve the name from their current state.
    this.emit({ type: 'kicked', playerId })
    this.removePlayers([playerId])
    this.checkProgress()
  }

  /** Reset to the lobby with the same (connected) players and settings; scores back to 0. */
  backToLobby(): void {
    if (this.destroyed) return
    this.resetToLobby(true)
  }

  /** Tell everyone the room is closed and shut the server down. Clears the refresh snapshot. */
  destroy(): void {
    if (this.destroyed) return
    this.gen++
    this.cancelFlow()
    this.destroyed = true
    for (const handle of this.helloTimers.values()) this.deps.clearTimeout(handle)
    for (const handle of this.graceTimers.values()) this.deps.clearTimeout(handle)
    for (const handle of this.leftNoticeTimers.values()) this.deps.clearTimeout(handle)
    this.helloTimers.clear()
    this.graceTimers.clear()
    this.leftNoticeTimers.clear()
    this.clearDrops()
    for (const handle of [this.flushTimer, this.persistTimer]) if (handle !== null) this.deps.clearTimeout(handle)
    this.flushTimer = null
    this.persistTimer = null
    this.flushPending = false
    try {
      this.server.broadcast({ t: 'reject', reason: 'closed' })
    } catch {
      // The server may already be gone.
    }
    for (const unsub of this.serverUnsubs.splice(0)) unsub()
    try {
      this.server.close()
    } catch {
      // Already closed.
    }
    this.connToPlayer.clear()
    this.playerToConn.clear()
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('pagehide', this.onPageHide)
      for (const type of WAKE_EVENTS) window.removeEventListener(type, this.onWake)
    }
    try {
      sessionStore()?.removeItem(STORAGE_KEYS.hostSnapshot(this.current.code))
    } catch {
      // Blocked storage.
    }
    this.stateListeners.clear()
    this.eventListeners.clear()
  }

  // ---------------------------------------------------------------------------
  // Connections & players

  private onConnect(connId: string): void {
    if (this.destroyed) return
    this.clearHelloTimer(connId)
    // A connection that never introduces itself is dropped.
    const handle = this.deps.setTimeout(() => {
      this.helloTimers.delete(connId)
      if (!this.connToPlayer.has(connId)) this.dropConn(connId)
    }, HELLO_TIMEOUT_MS)
    this.helloTimers.set(connId, handle)
  }

  private onMessage(connId: string, msg: ClientMsg): void {
    if (this.destroyed || typeof msg !== 'object' || msg === null || this.rejectedConns.has(connId)) return
    // Whatever a late timer should already have done happens before this message counts.
    this.catchUp()
    if (msg.t === 'ping') {
      if (isFiniteNumber(msg.c)) this.send(connId, { t: 'pong', c: msg.c, h: this.deps.now() })
      return
    }
    if (msg.t === 'hello') {
      this.onHello(connId, msg.profile, msg.version, msg.secret)
      return
    }
    const playerId = this.connToPlayer.get(connId)
    if (playerId === undefined) return
    if (msg.t === 'leave') {
      this.connToPlayer.delete(connId)
      if (this.playerToConn.get(playerId) === connId) this.playerToConn.delete(playerId)
      this.dropConn(connId)
      this.playerGone(playerId, true)
      return
    }
    this.applyPlayerMsg(playerId, msg)
  }

  private onHello(connId: string, rawProfile: unknown, version: unknown, rawSecret: unknown): void {
    this.clearHelloTimer(connId)
    if (version !== PROTOCOL_VERSION) return this.reject(connId, 'version')
    const profile = sanitizeProfile(rawProfile)
    if (!profile) return this.reject(connId, 'version')

    // One identity per connection: a welcomed connection may only update its own profile.
    const previous = this.connToPlayer.get(connId)
    if (previous !== undefined) {
      if (previous !== profile.id) return this.reject(connId, 'version')
      this.updateProfile(previous, profile)
      return
    }
    // Same browser profile as the host (e.g. a second tab of the host's browser).
    if (profile.id === this.current.hostId) return this.reject(connId, 'duplicate')
    if (this.banned.has(profile.id)) return this.reject(connId, 'kicked')
    // …and one identity per browser tab (its PeerJS id survives the tab's reconnections).
    const peer = this.remotePeer(connId)
    const owner = peer === null ? undefined : this.peerOwner.get(peer)
    if (owner !== undefined && owner !== profile.id && this.findPlayer(owner)) return this.reject(connId, 'version')

    const secret = isPlayerSecret(rawSecret) ? rawSecret : null
    const existing = this.findPlayer(profile.id)
    if (existing) {
      // Player ids are public (every RoomState lists them): only the browser that first
      // joined with this id (same secret) may take the seat back. Old clients without a
      // secret keep the previous behaviour for seats that never had one.
      const known = this.secrets.get(profile.id)
      if (known !== undefined && known !== secret) return this.reject(connId, 'duplicate')
      if (known === undefined && secret !== null) this.rememberSecret(profile.id, secret)
      const oldConn = this.playerToConn.get(profile.id)
      this.connToPlayer.set(connId, profile.id)
      this.playerToConn.set(profile.id, connId)
      if (peer !== null) this.peerOwner.set(peer, profile.id)
      if (oldConn !== undefined && oldConn !== connId) {
        this.connToPlayer.delete(oldConn)
        this.dropConn(oldConn, 'duplicate')
      }
      this.clearGrace(profile.id)
      this.clearLeftNotice(profile.id)
      this.clearDrop(profile.id)
      this.restoredPending.delete(profile.id)
      const { name, avatar, color } = profile
      if (!existing.connected || existing.name !== name || existing.avatar !== avatar || existing.color !== color) {
        this.updatePlayer(profile.id, { connected: true, name, avatar, color })
      }
      this.sendWelcome(connId, profile.id)
      return
    }

    if (this.current.players.length >= MAX_PLAYERS) return this.reject(connId, 'full')
    if (secret !== null) this.rememberSecret(profile.id, secret)
    const player: Player = { ...profile, isHost: false, connected: true, score: 0, activeFromRound: this.joinRound() }
    this.connToPlayer.set(connId, player.id)
    this.playerToConn.set(player.id, connId)
    if (peer !== null) this.peerOwner.set(peer, player.id)
    this.set({ players: [...this.current.players, player] })
    this.sendWelcome(connId, player.id)
    // Emitting flushes the new roster first: everyone knows the name before the toast.
    this.emit({ type: 'player-joined', playerId: player.id, name: player.name })
  }

  private remotePeer(connId: string): string | null {
    try {
      const id = this.server.remotePeerId?.(connId)
      return typeof id === 'string' && id ? id : null
    } catch {
      return null
    }
  }

  private rememberSecret(playerId: PlayerId, secret: string): void {
    this.secrets.set(playerId, secret)
    // Bounded: drop the oldest ids (players long gone) first.
    for (const id of this.secrets.keys()) {
      if (this.secrets.size <= MAX_SECRETS) break
      if (!this.findPlayer(id)) this.secrets.delete(id)
    }
    if (this.peerOwner.size > MAX_SECRETS) {
      for (const [peer, id] of this.peerOwner) if (!this.findPlayer(id)) this.peerOwner.delete(peer)
    }
  }

  private onDisconnect(connId: string): void {
    this.clearHelloTimer(connId)
    const playerId = this.connToPlayer.get(connId)
    if (playerId === undefined) return
    this.connToPlayer.delete(connId)
    // A newer connection of the same player already took over.
    if (this.playerToConn.get(playerId) !== connId) return
    this.playerToConn.delete(playerId)
    this.playerGone(playerId, false)
  }

  /** A player's connection went away (`left` = explicit leave). The host is never removed. */
  private playerGone(playerId: PlayerId, left: boolean): void {
    const player = this.findPlayer(playerId)
    if (!player || player.isHost || (!player.connected && !left)) return
    const event: GameEvent = { type: 'player-left', playerId, name: player.name }
    if (this.current.phase.kind === 'lobby') {
      if (left) {
        this.clearLeftNotice(playerId)
        this.emit(event)
        this.removePlayers([playerId])
        return
      }
      this.updatePlayer(playerId, { connected: false })
      this.armLeftNotice(playerId, event)
      this.armGrace(playerId)
      return
    }
    if (left) {
      this.departed(playerId)
      return
    }
    // In game a lost link is usually a reload or a network handover and comes back within
    // seconds: keep the seat as it is (see DISCONNECT_GRACE_MS). Only the ready wait stops
    // waiting for them — they get the round's audio again once they are back.
    this.armDrop(playerId)
    this.checkAllReady()
  }

  /**
   * In game: the player is gone for good (explicit leave, or the reconnect grace ran out).
   * They stop blocking the round; one who never played anything leaves the room entirely.
   */
  private departed(playerId: PlayerId): void {
    this.clearDrop(playerId)
    this.restoredPending.delete(playerId)
    const player = this.findPlayer(playerId)
    if (!player || player.isHost) return
    if (player.connected) {
      this.updatePlayer(playerId, { connected: false })
      this.emit({ type: 'player-left', playerId, name: player.name })
    }
    if (this.current.phase.kind !== 'lobby' && this.neverPlayed(playerId)) this.removePlayers([playerId])
    this.checkProgress()
  }

  /** No score, no result in any round and no move in the current one. */
  private neverPlayed(playerId: PlayerId): boolean {
    const s = this.current
    const player = this.findPlayer(playerId)
    if (!player || player.isHost || player.score !== 0) return false
    if (s.results.some((list) => list.some((r) => r.playerId === playerId))) return false
    return !this.movedThisRound(playerId)
  }

  /** Sent an arrangement or a confirmation in the current round. */
  private movedThisRound(playerId: PlayerId): boolean {
    const r = phaseRoundOf(this.current.phase)
    if (r < 0) return false
    const data = this.roundData.round === r ? this.roundData : null
    return (
      this.current.submissions[playerId]?.submitted === true ||
      (!!data && (data.orders.has(playerId) || data.arrangements.has(playerId)))
    )
  }

  private armDrop(playerId: PlayerId): void {
    this.clearDrop(playerId)
    const handle = this.deps.setTimeout(() => {
      this.dropTimers.delete(playerId)
      this.guard(() => {
        if (!this.destroyed && !this.playerToConn.has(playerId) && this.current.phase.kind !== 'lobby') this.departed(playerId)
      })
    }, DISCONNECT_GRACE_MS)
    this.dropTimers.set(playerId, handle)
  }

  private clearDrop(playerId: PlayerId): void {
    const handle = this.dropTimers.get(playerId)
    if (handle !== undefined) this.deps.clearTimeout(handle)
    this.dropTimers.delete(playerId)
  }

  private clearDrops(): void {
    for (const handle of this.dropTimers.values()) this.deps.clearTimeout(handle)
    this.dropTimers.clear()
  }

  /** Round a player joining right now can first play. */
  private joinRound(): number {
    const phase = this.current.phase
    switch (phase.kind) {
      case 'lobby':
        return 0
      case 'preparing':
        return phase.round
      case 'final':
        return Math.max(1, this.current.tracks.length)
      default:
        return phase.round + 1
    }
  }

  private armGrace(playerId: PlayerId): void {
    this.clearGrace(playerId)
    const handle = this.deps.setTimeout(() => {
      this.graceTimers.delete(playerId)
      const player = this.findPlayer(playerId)
      if (player && !player.connected && !player.isHost && this.current.phase.kind === 'lobby') this.removePlayers([playerId])
    }, LOBBY_GRACE_MS)
    this.graceTimers.set(playerId, handle)
  }

  private armLeftNotice(playerId: PlayerId, event: GameEvent): void {
    this.clearLeftNotice(playerId)
    const handle = this.deps.setTimeout(() => {
      this.leftNoticeTimers.delete(playerId)
      this.guard(() => {
        if (this.destroyed || this.playerToConn.has(playerId)) return
        // Still gone: tell the room now. (A kick or removal cancels this in forgetPlayer.)
        const player = this.findPlayer(playerId)
        if (player && !player.connected) this.emit(event)
      })
    }, LEFT_NOTICE_MS)
    this.leftNoticeTimers.set(playerId, handle)
  }

  private clearLeftNotice(playerId: PlayerId): void {
    const handle = this.leftNoticeTimers.get(playerId)
    if (handle !== undefined) this.deps.clearTimeout(handle)
    this.leftNoticeTimers.delete(playerId)
  }

  private clearGrace(playerId: PlayerId): void {
    const handle = this.graceTimers.get(playerId)
    if (handle !== undefined) this.deps.clearTimeout(handle)
    this.graceTimers.delete(playerId)
  }

  private clearHelloTimer(connId: string): void {
    const handle = this.helloTimers.get(connId)
    if (handle !== undefined) this.deps.clearTimeout(handle)
    this.helloTimers.delete(connId)
  }

  /** Drop every host-side trace of a player that is about to disappear from the state. */
  private forgetPlayer(playerId: PlayerId): void {
    this.clearGrace(playerId)
    this.clearLeftNotice(playerId)
    this.clearDrop(playerId)
    this.lastReactionAt.delete(playerId)
    this.restoredPending.delete(playerId)
    this.roundData.orders.delete(playerId)
    this.roundData.arrangements.delete(playerId)
  }

  private removePlayers(ids: readonly PlayerId[]): void {
    const gone = new Set(ids.filter((id) => id !== this.current.hostId))
    if (gone.size === 0) return
    for (const id of gone) this.forgetPlayer(id)
    const s = this.current
    let submissions = s.submissions
    let ready = s.ready
    for (const id of gone) {
      submissions = withoutKey(submissions, id)
      ready = withoutKey(ready, id)
    }
    const results = s.results.some((list) => list.some((r) => gone.has(r.playerId)))
      ? s.results.map((list) => list.filter((r) => !gone.has(r.playerId)))
      : s.results
    this.set({ players: s.players.filter((p) => !gone.has(p.id)), submissions, ready, results })
  }

  private findPlayer(playerId: PlayerId): Player | undefined {
    return this.current.players.find((p) => p.id === playerId)
  }

  private updatePlayer(playerId: PlayerId, patch: Partial<Player>): void {
    this.set({ players: this.current.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)) })
  }

  /**
   * Counts for "everyone submitted": connected — including a link that just dropped and is
   * probably coming back (DISCONNECT_GRACE_MS) — or expected back after a host refresh.
   */
  private isPresent(p: Player): boolean {
    return p.isHost || p.connected || this.restoredPending.has(p.id)
  }

  /** Counts for "everyone's audio is ready": a live link (or expected back after a host refresh). */
  private isReachable(p: Player): boolean {
    return p.isHost || this.playerToConn.has(p.id) || this.restoredPending.has(p.id)
  }

  // ---------------------------------------------------------------------------
  // Player messages (remote and local)

  private applyPlayerMsg(playerId: PlayerId, msg: ClientMsg): void {
    switch (msg.t) {
      case 'profile':
        this.updateProfile(playerId, msg.profile)
        break
      case 'ready':
        this.markReady(playerId, msg.round)
        break
      case 'arrange':
        this.onArrange(playerId, msg.round, msg.order)
        break
      case 'submit':
        this.onSubmit(playerId, msg.round, msg.order)
        break
      case 'reaction':
        this.onReaction(playerId, msg.emoji)
        break
      default:
        break
    }
  }

  private updateProfile(playerId: PlayerId, raw: unknown): void {
    const player = this.findPlayer(playerId)
    if (!player || !isRecord(raw)) return
    const name = 'name' in raw ? cleanPlayerName(raw.name) : player.name
    const avatar = 'avatar' in raw ? clampIndex(raw.avatar, AVATARS.length) : player.avatar
    const color = 'color' in raw ? clampIndex(raw.color, PLAYER_COLORS.length) : player.color
    if (name === player.name && avatar === player.avatar && color === player.color) return
    this.updatePlayer(playerId, { name, avatar, color })
  }

  private markReady(playerId: PlayerId, round: unknown): void {
    const s = this.current
    const phase = s.phase
    if (phase.kind !== 'preparing' && phase.kind !== 'intro' && phase.kind !== 'playing') return
    if (phase.round !== round || s.ready[playerId] === true) return
    this.set({ ready: { ...s.ready, [playerId]: true } })
    this.checkAllReady()
  }

  private roundDataFor(round: number): RoundPrivate {
    if (this.roundData.round !== round) this.roundData = emptyRoundData(round)
    return this.roundData
  }

  /** The round a player may act in right now (arrange / submit), or null. */
  private actionableRound(playerId: PlayerId, round: unknown, phases: readonly Phase['kind'][]): RoundPublic | null {
    const s = this.current
    const phase = s.phase
    if (!phases.includes(phase.kind) || !('round' in phase) || phase.round !== round) return null
    const pub = s.rounds[phase.round]
    const player = this.findPlayer(playerId)
    if (!pub || !player || player.activeFromRound > phase.round) return null
    if (s.submissions[playerId]?.submitted) return null
    return pub
  }

  /** Past the round's deadline plus the transit grace: nothing counts any more. */
  private pastDeadline(phase: Phase): boolean {
    return phase.kind === 'playing' && this.deps.now() > phase.endsAt + ARRIVAL_GRACE_MS
  }

  private onArrange(playerId: PlayerId, round: unknown, order: unknown): void {
    const pub = this.actionableRound(playerId, round, ['intro', 'playing'])
    if (!pub || this.pastDeadline(this.current.phase) || !isPermutation(order, pub.segments.length)) return
    this.roundDataFor(pub.index).arrangements.set(playerId, [...order])
    this.schedulePersist()
  }

  private onSubmit(playerId: PlayerId, round: unknown, order: unknown): void {
    const pub = this.actionableRound(playerId, round, ['playing'])
    const s = this.current
    const phase = s.phase
    if (!pub || phase.kind !== 'playing' || this.pastDeadline(phase) || !isPermutation(order, pub.segments.length)) return
    const player = this.findPlayer(playerId)
    if (!player) return

    const now = this.deps.now()
    const roundMs = s.settings.roundTime * 1000
    // A confirm that arrives inside the transit grace was sent before the deadline.
    const atMs = Math.min(roundMs, Math.max(0, Math.min(now, phase.endsAt) - phase.startedAt))
    const data = this.roundDataFor(pub.index)
    data.orders.set(playerId, [...order])
    data.arrangements.set(playerId, [...order])

    // The first confirm starts the final timer — unless the round clock already ran out, or
    // the board is untouched (initialOrder scores 0: it must not rush everyone else; clients
    // also ask for a second press before sending one).
    const untouched = order.length === pub.initialOrder.length && order.every((v, i) => v === pub.initialOrder[i])
    const first = !untouched && phase.firstSubmit === null && now < phase.endsAt
    const nextPhase: Phase = first
      ? { ...phase, endsAt: Math.min(phase.endsAt, now + s.settings.finalTimer * 1000), firstSubmit: { playerId, at: now } }
      : phase
    this.set({ submissions: { ...s.submissions, [playerId]: { submitted: true, atMs } }, phase: nextPhase })

    if (this.allSubmitted(pub.index)) {
      this.emit({ type: 'submitted', playerId, name: player.name })
      this.endRound(pub.index)
      return
    }
    if (first && nextPhase.kind === 'playing') {
      this.armRoundEnd(pub.index, nextPhase.endsAt)
      this.emit({ type: 'first-submit', playerId, name: player.name, endsAt: nextPhase.endsAt })
    } else {
      this.emit({ type: 'submitted', playerId, name: player.name })
    }
  }

  private onReaction(playerId: PlayerId, emoji: unknown): void {
    if (typeof emoji !== 'string' || !REACTIONS.includes(emoji)) return
    const now = this.deps.now()
    const last = this.lastReactionAt.get(playerId)
    if (last !== undefined && now - last < REACTION_THROTTLE_MS) return
    this.lastReactionAt.set(playerId, now)
    this.emit({ type: 'reaction', playerId, emoji })
  }

  // ---------------------------------------------------------------------------
  // Game flow: preparing → (ready) → intro → playing → reveal → … → final

  /** Cancel every pending step of the current game flow (timers, preparations, waits). */
  private cancelFlow(): void {
    this.clearPhaseTimer()
    if (this.restoreGraceTimer !== null) this.deps.clearTimeout(this.restoreGraceTimer)
    this.restoreGraceTimer = null
    this.restoredPending = new Set()
    this.readyWaitRound = null
    this.prepJobs.clear()
    this.prepared.clear()
    this.spares = []
    this.roundData = emptyRoundData(-1)
  }

  /**
   * Cancel the game and return to the lobby, scores reset. `removeDisconnected`
   * drops players who are gone (host "Rigioca"); otherwise (a failed start) they
   * get the usual lobby grace period.
   */
  private resetToLobby(removeDisconnected: boolean): void {
    this.gen++
    this.cancelFlow()
    this.clearDrops()
    const s = this.current
    // Gone = no live link, including links that dropped during the game and never came back.
    const here = (p: Player): boolean => p.isHost || this.playerToConn.has(p.id)
    const gone = s.players.filter((p) => !here(p)).map((p) => p.id)
    if (removeDisconnected) for (const id of gone) this.forgetPlayer(id)
    const players = s.players
      .filter((p) => here(p) || !removeDisconnected)
      .map((p) => {
        const connected = here(p)
        return p.score === 0 && p.activeFromRound === 0 && p.connected === connected ? p : { ...p, connected, score: 0, activeFromRound: 0 }
      })
    this.set({ phase: { kind: 'lobby' }, players, tracks: [], rounds: [], results: [], submissions: {}, ready: {} })
    if (!removeDisconnected) for (const id of gone) this.armGrace(id)
  }

  private async pickTracks(gen: number): Promise<void> {
    const settings = this.current.settings
    const playlist = settings.playlist
    if (!playlist) throw new Error(HOST_MESSAGES.noPlaylist)
    let all: TrackInfo[]
    try {
      all = await this.deps.getPlaylistTracks(playlist.id)
    } catch {
      throw new Error(HOST_MESSAGES.playlistFailed)
    }
    if (gen !== this.gen) return
    const seen = new Set<number>()
    const playable = (Array.isArray(all) ? all : []).filter((t) => isTrackInfo(t) && !seen.has(t.id) && seen.add(t.id))
    const want = settings.rounds + SPARE_TRACKS
    let picks: TrackInfo[]
    try {
      picks = this.deps.pickGameTracks(playable, want)
    } catch {
      picks = shuffleInPlace([...playable]).slice(0, want)
    }
    const picked = new Set<number>()
    picks = (Array.isArray(picks) ? picks : []).filter((t) => isTrackInfo(t) && !picked.has(t.id) && picked.add(t.id))
    if (picks.length < settings.rounds) throw new Error(HOST_MESSAGES.notEnoughTracks(settings.rounds))
    this.spares = picks.slice(settings.rounds)
    const tracks = picks.slice(0, settings.rounds)
    // Broadcast right away: clients start prefetching every preview while we cut round 0.
    this.set({
      tracks,
      rounds: tracks.map(() => null),
      phase: { kind: 'preparing', round: 0, message: HOST_MESSAGES.slicing },
    })
  }

  /** Enter round r: instant when it was pre-prepared, otherwise prepare it now. */
  private startRound(r: number): void {
    this.roundData = emptyRoundData(r)
    this.readyWaitRound = null
    const cached = this.prepared.get(r)
    if (cached) {
      this.publishRound(r, cached)
      return
    }
    this.set({ phase: { kind: 'preparing', round: r, message: HOST_MESSAGES.slicing }, submissions: {}, ready: {} })
    void this.runRound(r, this.gen)
  }

  private async runRound(r: number, gen: number): Promise<void> {
    const round = await this.obtainRound(r, gen)
    if (gen !== this.gen || this.destroyed) return
    const phase = this.current.phase
    if (phase.kind !== 'preparing' || phase.round !== r) return
    if (!round) {
      this.resetToLobby(false)
      this.emit({ type: 'info', message: HOST_MESSAGES.prepareFailed })
      return
    }
    this.publishRound(r, round)
  }

  /** Make round r public and wait for everyone's audio. Keeps `ready` flags already collected for r. */
  private publishRound(r: number, round: RoundPublic): void {
    const s = this.current
    const rounds = s.tracks.map((_, i) => (i === r ? round : (s.rounds[i] ?? null)))
    const sameRound = s.phase.kind === 'preparing' && s.phase.round === r
    this.set({
      rounds,
      phase: { kind: 'preparing', round: r, message: HOST_MESSAGES.syncing },
      submissions: {},
      ready: sameRound ? s.ready : {},
    })
    this.beginReadyWait(r)
  }

  private obtainRound(r: number, gen: number): Promise<RoundPublic | null> {
    const cached = this.prepared.get(r)
    if (cached) return Promise.resolve(cached)
    const job = this.prepJobs.get(r)
    if (!job) return this.prepareRound(r, gen)
    // A failed background attempt gets one more foreground try (the network may be back).
    return job.then((result) => (result || gen !== this.gen ? result : this.prepareRound(r, gen)))
  }

  /** Pre-prepare a round privately (background, while the previous one is played). */
  private prefetchRound(r: number): void {
    if (r < 0 || r >= this.current.tracks.length || this.prepared.has(r) || this.prepJobs.has(r)) return
    void this.prepareRound(r, this.gen)
  }

  private prepareRound(r: number, gen: number): Promise<RoundPublic | null> {
    const existing = this.prepJobs.get(r)
    if (existing) return existing
    const job: Promise<RoundPublic | null> = this.doPrepare(r, gen)
      .catch(() => null)
      .then((result) => {
        if (this.prepJobs.get(r) === job) this.prepJobs.delete(r)
        if (result && gen === this.gen) this.prepared.set(r, result)
        return gen === this.gen ? result : null
      })
    this.prepJobs.set(r, job)
    return job
  }

  /**
   * Download + analyze + cut tracks[r]. On failure swap in the next spare (max
   * MAX_SPARE_RETRIES). If every analysis failed but some audio decoded, fall
   * back to an equal-length cut of it rather than aborting the game.
   */
  private async doPrepare(r: number, gen: number): Promise<RoundPublic | null> {
    const n = this.current.settings.snippets
    let fallback: { track: TrackInfo; buffer: AudioBuffer } | null = null
    for (let attempt = 0; attempt <= MAX_SPARE_RETRIES; attempt++) {
      if (gen !== this.gen) return null
      if (attempt > 0) {
        const spare = this.spares.shift()
        if (!spare) break
        this.replaceTrack(r, spare)
      }
      const track = this.current.tracks[r]
      if (!track) return null
      const buffer = await this.attempt(() =>
        this.deps.loadAudio(trackKey(track.id), track.preview, () => this.deps.refreshPreview(track.id)),
      )
      if (gen !== this.gen) return null
      if (!buffer) continue
      if (!fallback && uniformSegments(buffer.duration, n)) fallback = { track, buffer }
      const plan = await this.attempt(() => this.deps.analyzeAndCut(buffer, n))
      if (gen !== this.gen) return null
      const segments = plan ? segmentsFromPlan(plan, n, buffer.duration) : null
      if (segments) return this.buildRound(r, track, segments, planBpm(plan))
    }
    if (!fallback || gen !== this.gen) return null
    const segments = uniformSegments(fallback.buffer.duration, n)
    if (!segments) return null
    if (this.current.tracks[r]?.id !== fallback.track.id) this.replaceTrack(r, fallback.track)
    return this.buildRound(r, fallback.track, segments, 0)
  }

  /** Run one preparation step with a timeout; null on any failure. */
  private async attempt<T>(step: () => Promise<T>): Promise<T | null> {
    let timer: unknown = null
    try {
      return await new Promise<T>((resolve, reject) => {
        timer = this.deps.setTimeout(() => reject(new Error('timeout')), PREPARE_STEP_TIMEOUT_MS)
        Promise.resolve().then(step).then(resolve, reject)
      })
    } catch {
      return null
    } finally {
      if (timer !== null) this.deps.clearTimeout(timer)
    }
  }

  private buildRound(r: number, track: TrackInfo, segments: Segment[], bpm: number): RoundPublic {
    const n = segments.length
    return { index: r, track, segments, initialOrder: scrambledOrder(n), hues: randomHues(n), bpm }
  }

  private replaceTrack(r: number, track: TrackInfo): void {
    const tracks = [...this.current.tracks]
    tracks[r] = track
    this.set({ tracks })
  }

  private beginReadyWait(r: number): void {
    this.readyWaitRound = r
    this.armPhaseTimer(this.deps.now() + READY_TIMEOUT_MS, () => this.finishReadyWait(r))
    this.checkAllReady()
  }

  private checkAllReady(): void {
    const r = this.readyWaitRound
    if (r === null) return
    const s = this.current
    if (s.phase.kind !== 'preparing' || s.phase.round !== r) return
    const waiting = s.players.filter((p) => p.activeFromRound <= r && this.isReachable(p))
    if (waiting.every((p) => s.ready[p.id] === true)) this.finishReadyWait(r)
  }

  private finishReadyWait(r: number): void {
    if (this.readyWaitRound !== r) return
    this.readyWaitRound = null
    const endsAt = this.deps.now() + INTRO_MS
    this.set({ phase: { kind: 'intro', round: r, endsAt } })
    this.armPhaseTimer(endsAt, () => this.startPlaying(r))
  }

  private startPlaying(r: number): void {
    const s = this.current
    if (s.phase.kind !== 'intro' || s.phase.round !== r) return
    const startedAt = this.deps.now()
    const endsAt = startedAt + s.settings.roundTime * 1000
    this.roundDataFor(r).orders.clear()
    this.set({ phase: { kind: 'playing', round: r, startedAt, endsAt, firstSubmit: null }, submissions: {} })
    this.armRoundEnd(r, endsAt)
    this.prefetchRound(r + 1)
  }

  /** The round ends ARRIVAL_GRACE_MS after its deadline, so moves already on their way still count. */
  private armRoundEnd(r: number, endsAt: number): void {
    this.armPhaseTimer(endsAt + ARRIVAL_GRACE_MS, () => this.endRound(r))
  }

  private allSubmitted(r: number): boolean {
    const s = this.current
    const active = s.players.filter((p) => p.activeFromRound <= r && this.isPresent(p))
    return active.length > 0 && active.every((p) => s.submissions[p.id]?.submitted === true)
  }

  private checkProgress(): void {
    this.checkAllReady()
    const phase = this.current.phase
    if (phase.kind === 'playing' && this.allSubmitted(phase.round)) this.endRound(phase.round)
  }

  private endRound(r: number): void {
    const s = this.current
    const phase = s.phase
    if (phase.kind !== 'playing' || phase.round !== r) return
    const round = s.rounds[r]
    if (!round) return
    this.clearPhaseTimer()
    const data = this.roundDataFor(r)
    // Scored: everyone still here at the end, plus whoever made a move before leaving.
    // A player who was gone the whole round gets no result ("nessuna risposta"), not a 0.
    const scored = s.players.filter(
      (p) =>
        p.isHost ||
        this.playerToConn.has(p.id) ||
        this.restoredPending.has(p.id) ||
        s.submissions[p.id]?.submitted === true ||
        data.orders.has(p.id) ||
        data.arrangements.has(p.id),
    )
    const list = buildRoundResults({
      players: scored,
      round,
      roundTimeMs: s.settings.roundTime * 1000,
      submissions: s.submissions,
      orders: data.orders,
      arrangements: data.arrangements,
    })
    const points = new Map(list.map((res) => [res.playerId, res.points]))
    const players = s.players.map((p) => {
      const add = points.get(p.id)
      return add ? { ...p, score: p.score + add } : p
    })
    const results = Array.from({ length: Math.max(s.results.length, r + 1) }, (_, i) => (i === r ? list : (s.results[i] ?? [])))
    const nextAt = this.deps.now() + REVEAL_AUTO_ADVANCE_MS
    this.set({ players, results, phase: { kind: 'reveal', round: r, nextAt } })
    this.armPhaseTimer(nextAt, () => this.nextRound())
    this.prefetchRound(r + 1)
  }

  private armPhaseTimer(at: number, fn: () => void): void {
    this.clearPhaseTimer()
    const gen = this.gen
    const due = { at, fn }
    this.phaseDue = due
    this.phaseTimer = this.deps.setTimeout(
      () => {
        this.phaseTimer = null
        if (this.phaseDue !== due) return
        this.phaseDue = null
        if (gen === this.gen && !this.destroyed) this.guard(fn)
      },
      Math.max(0, at - this.deps.now()),
    )
  }

  private clearPhaseTimer(): void {
    if (this.phaseTimer !== null) this.deps.clearTimeout(this.phaseTimer)
    this.phaseTimer = null
    this.phaseDue = null
  }

  /**
   * Timers of a hidden tab fire late (≥ 1 s in Chrome) and a suspended one not at all:
   * run the timeline steps whose deadline already passed, so a message or a wake-up never
   * lands in a phase that should be over (e.g. a confirm after the round's end).
   */
  private catchUp(): void {
    for (let i = 0; i < 4; i++) {
      const due = this.phaseDue
      if (!due || this.destroyed || this.deps.now() < due.at) return
      this.clearPhaseTimer()
      due.fn()
    }
  }

  // ---------------------------------------------------------------------------
  // Restore (host refresh recovery)

  private adopt(raw: RoomState): void {
    if (!isRecord(raw) || raw.hostId !== this.current.hostId || !Array.isArray(raw.players)) return
    const host = this.current.players[0]
    const tracks = Array.isArray(raw.tracks) ? raw.tracks.filter(isTrackInfo) : []
    const phase = sanitizePhase(raw.phase, tracks.length) ?? { kind: 'lobby' }
    const inGame = phase.kind !== 'lobby'

    const players: Player[] = []
    /** Players that were connected when the snapshot was taken: they are expected back. */
    const wereHere = new Set<PlayerId>()
    for (const p of raw.players as unknown[]) {
      const profile = sanitizeProfile(p)
      if (!profile || !isRecord(p) || players.some((q) => q.id === profile.id)) continue
      const score = inGame && isFiniteNumber(p.score) ? Math.max(0, Math.round(p.score)) : 0
      if (profile.id === host.id) {
        players.push({ ...host, score })
      } else if (players.length < MAX_PLAYERS) {
        const from = inGame && isFiniteNumber(p.activeFromRound) ? Math.max(0, Math.trunc(p.activeFromRound)) : 0
        players.push({ ...profile, isHost: false, connected: false, score, activeFromRound: from })
        if (p.connected === true) wereHere.add(profile.id)
      }
    }
    if (!players.some((p) => p.id === host.id)) players.unshift(host)

    const rawRounds: unknown[] = Array.isArray(raw.rounds) ? raw.rounds : []
    const rounds = tracks.map((_, i) => {
      const round = rawRounds[i]
      return isRoundPublic(round) && round.index === i ? round : null
    })
    const results = Array.isArray(raw.results)
      ? (raw.results as unknown[]).map((list) => (Array.isArray(list) ? list.filter(isRoundResult) : []))
      : []

    const priv = readPrivateSnapshot(raw.code, raw.seq)
    if (priv) {
      for (const id of priv.banned) this.banned.add(id)
      for (const [id, secret] of Object.entries(priv.secrets ?? {})) this.secrets.set(id, secret)
      if (inGame) {
        this.spares = priv.spares
        if ('round' in phase && priv.round === phase.round) {
          this.roundData = {
            round: priv.round,
            orders: new Map(Object.entries(priv.orders)),
            arrangements: new Map(Object.entries(priv.arrangements)),
          }
        }
      }
    }

    this.current = {
      code: this.server.code,
      hostId: host.id,
      players,
      settings: sanitizeSettings(raw.settings),
      phase,
      tracks: inGame ? tracks : [],
      rounds: inGame ? rounds : [],
      submissions: inGame ? sanitizeSubmissions(raw.submissions) : {},
      // The reloaded host has no decoded audio: its own UI reports ready again once it has.
      ready: inGame ? withoutKey(sanitizeReady(raw.ready), host.id) : {},
      results: inGame ? results : [],
      seq: (isFiniteNumber(raw.seq) ? raw.seq : 0) + RESTORE_SEQ_JUMP,
    }
    const others = players.filter((p) => !p.isHost).map((p) => p.id)
    if (phase.kind === 'lobby') {
      for (const id of others) this.armGrace(id)
    } else if (phase.kind !== 'final') {
      // Whoever was connected a moment ago may re-attach before they stop blocking the round.
      // Players who had already left before the refresh don't hold anybody up.
      this.restoredPending = new Set(others.filter((id) => wereHere.has(id)))
      this.restoreGraceTimer = this.deps.setTimeout(() => {
        this.restoreGraceTimer = null
        const missing = [...this.restoredPending]
        this.restoredPending = new Set()
        this.guard(() => {
          const ghosts = missing.filter((id) => !this.playerToConn.has(id) && this.neverPlayed(id))
          this.removePlayers(ghosts)
          this.checkProgress()
        })
      }, RESTORE_GRACE_MS)
    }
    // Resume the timeline on the next tick so the owner can subscribe first.
    const gen = this.gen
    this.deps.setTimeout(() => {
      if (gen === this.gen && !this.destroyed) this.guard(() => this.resume())
    }, 0)
  }

  private resume(): void {
    const s = this.current
    const phase = s.phase
    if (phase.kind === 'lobby' || phase.kind === 'final') return
    const r = phase.round
    switch (phase.kind) {
      case 'preparing': {
        if (s.tracks.length === 0) {
          void this.resumeTrackPick()
          return
        }
        this.roundDataFor(r)
        const round = s.rounds[r]
        if (round) this.beginReadyWait(r)
        else {
          this.set({ phase: { kind: 'preparing', round: r, message: HOST_MESSAGES.slicing } })
          void this.runRound(r, this.gen)
        }
        return
      }
      case 'intro':
        if (!s.rounds[r]) return this.startRound(r)
        this.armPhaseTimer(phase.endsAt, () => this.startPlaying(r))
        return
      case 'playing':
        if (!s.rounds[r]) return this.startRound(r)
        this.roundDataFor(r)
        this.armRoundEnd(r, phase.endsAt)
        this.prefetchRound(r + 1)
        return
      case 'reveal':
        if (phase.nextAt !== null) this.armPhaseTimer(phase.nextAt, () => this.nextRound())
        this.prefetchRound(r + 1)
        return
    }
  }

  private async resumeTrackPick(): Promise<void> {
    const gen = this.gen
    try {
      await this.pickTracks(gen)
    } catch (err) {
      if (gen !== this.gen) return
      this.resetToLobby(false)
      this.emit({ type: 'info', message: err instanceof Error ? err.message : HOST_MESSAGES.playlistFailed })
      return
    }
    if (gen === this.gen) void this.runRound(0, gen)
  }

  // ---------------------------------------------------------------------------
  // State publication

  /** Every mutation goes through here: new object, seq++, coalesced broadcast (phase changes at once). */
  private set(patch: Patch): void {
    const prev = this.current
    this.current = { ...prev, ...patch, seq: prev.seq + 1 }
    if (patch.phase !== undefined && patch.phase !== prev.phase) this.flushNow()
    else this.scheduleFlush()
  }

  private scheduleFlush(): void {
    if (this.flushPending || this.destroyed) return
    this.flushPending = true
    const token = ++this.flushToken
    const wait = this.lastFlushAt + STATE_FLUSH_INTERVAL_MS - this.deps.now()
    if (wait <= 0) {
      queueMicrotask(() => {
        if (this.flushPending && token === this.flushToken) this.flush()
      })
    } else {
      this.flushTimer = this.deps.setTimeout(() => {
        this.flushTimer = null
        if (this.flushPending && token === this.flushToken) this.flush()
      }, wait)
    }
  }

  private flushNow(): void {
    this.flushPending = true
    this.flush()
  }

  private flush(): void {
    if (!this.flushPending) return
    this.flushPending = false
    this.flushToken++
    if (this.flushTimer !== null) this.deps.clearTimeout(this.flushTimer)
    this.flushTimer = null
    if (this.destroyed) return
    const state = this.current
    if (state === this.lastFlushed) return
    this.lastFlushed = state
    const now = this.deps.now()
    this.lastFlushAt = now
    // Clients first: a local listener may synchronously trigger a newer flush (e.g. the host
    // UI answering `ready`), which must reach clients after this one.
    this.sendToAll({ t: 'state', state, hostNow: now })
    for (const listener of [...this.stateListeners]) {
      if (this.lastFlushed !== state) break // a newer state was already delivered to everyone
      try {
        listener(state)
      } catch (err) {
        console.error('[host] state listener failed', err)
      }
    }
    this.schedulePersist()
  }

  /** Send an event to the host UI and every client (`remoteOnly` skips the host UI). Pending state goes out first. */
  private emit(event: GameEvent, remoteOnly = false): void {
    if (this.destroyed) return
    if (this.flushPending) this.flush()
    this.sendToAll({ t: 'event', event })
    if (remoteOnly) return
    for (const listener of [...this.eventListeners]) {
      try {
        listener(event)
      } catch (err) {
        console.error('[host] event listener failed', err)
      }
    }
  }

  private sendWelcome(connId: string, playerId: PlayerId): void {
    const msg: WelcomeMsg = { t: 'welcome', you: playerId, state: this.current, hostNow: this.deps.now() }
    // Mid-round: the player's own arrangement as we last saw it (only ever sent to them).
    const r = phaseRoundOf(this.current.phase)
    if (r >= 0 && this.roundData.round === r && this.current.phase.kind !== 'reveal') {
      const order = this.roundData.orders.get(playerId) ?? this.roundData.arrangements.get(playerId)
      if (order) msg.mine = { round: r, order: [...order] }
    }
    this.send(connId, msg)
  }

  /** Only connections that completed `hello` receive state and events. */
  private sendToAll(msg: HostMsg): void {
    for (const connId of this.connToPlayer.keys()) this.send(connId, msg)
  }

  private send(connId: string, msg: HostMsg): void {
    try {
      this.server.send(connId, msg)
    } catch (err) {
      console.warn('[host] send failed', err)
    }
  }

  private reject(connId: string, reason: RejectReason): void {
    this.rejectedConns.add(connId)
    if (this.rejectedConns.size > MAX_SECRETS) this.rejectedConns.delete(this.rejectedConns.values().next().value as string)
    const playerId = this.connToPlayer.get(connId)
    this.connToPlayer.delete(connId)
    if (playerId !== undefined && this.playerToConn.get(playerId) === connId) {
      this.playerToConn.delete(playerId)
      this.playerGone(playerId, false)
    }
    this.dropConn(connId, reason)
  }

  private dropConn(connId: string, reason?: RejectReason): void {
    this.clearHelloTimer(connId)
    try {
      this.server.drop(connId, reason ? { t: 'reject', reason } : undefined)
    } catch (err) {
      console.warn('[host] drop failed', err)
    }
  }

  private schedulePersist(): void {
    if (this.persistTimer !== null || this.destroyed || !sessionStore()) return
    this.persistTimer = this.deps.setTimeout(() => {
      this.persistTimer = null
      this.persistNow()
    }, PERSIST_THROTTLE_MS)
  }

  /** Snapshot for host-refresh recovery: `{ v, savedAt, state }` (persist.ts shape) + host-only data. */
  private persistNow(): void {
    if (this.destroyed) return
    const storage = sessionStore()
    if (!storage) return
    const host: HostPrivateSnapshot = {
      round: this.roundData.round,
      orders: Object.fromEntries(this.roundData.orders),
      arrangements: Object.fromEntries(this.roundData.arrangements),
      spares: this.spares,
      banned: [...this.banned],
      secrets: Object.fromEntries(this.secrets),
    }
    try {
      storage.setItem(
        STORAGE_KEYS.hostSnapshot(this.current.code),
        JSON.stringify({ v: 1, savedAt: this.deps.now(), state: this.current, host }),
      )
    } catch {
      // Quota / blocked storage: recovery is best-effort.
    }
  }

  private guard(fn: () => void): void {
    try {
      fn()
    } catch (err) {
      console.error('[host]', err)
    }
  }
}
