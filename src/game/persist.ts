// Persistence: the player's profile (localStorage, survives visits) and the
// current session (sessionStorage, survives a refresh of this tab only):
// which room we are in, the host's state snapshot, the live arrangement.
// Every access is guarded — storage can be missing, full or blocked.

import { AVATARS, PLAYER_COLORS, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './constants'
import { randomPlayerName, sanitizeName } from './names'
import { randomInt } from './shuffle'
import type { PlayerProfile, RoomState } from './types'

export const STORAGE_KEYS = {
  profile: 'unshuffle:profile',
  /** Private re-attach key of this browser's profile (never broadcast). */
  secret: 'unshuffle:secret',
  session: 'unshuffle:session',
  hostSnapshot: (code: string) => `unshuffle:host:${code}`,
  arrangement: (code: string, round: number) => `unshuffle:arr:${code}:${round}`,
  arrangementPrefix: (code: string) => `unshuffle:arr:${code}:`,
} as const

/** A host snapshot older than this is not resumed after a refresh. */
const HOST_SNAPSHOT_MAX_AGE_MS = 10 * 60_000

type StorageKind = 'local' | 'session'

function storage(kind: StorageKind): Storage | null {
  try {
    const s = kind === 'local' ? globalThis.localStorage : globalThis.sessionStorage
    return s ?? null
  } catch {
    return null
  }
}

function readJson(kind: StorageKind, key: string): unknown {
  try {
    const raw = storage(kind)?.getItem(key)
    return raw == null ? null : (JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

function writeJson(kind: StorageKind, key: string, value: unknown): boolean {
  try {
    const s = storage(kind)
    if (!s) return false
    s.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

function remove(kind: StorageKind, key: string): void {
  try {
    storage(kind)?.removeItem(key)
  } catch {
    // Blocked storage: nothing to clean up.
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function isIndex(x: unknown, length: number): x is number {
  return typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < length
}

export function isRoomCode(code: unknown): code is string {
  if (typeof code !== 'string' || code.length !== ROOM_CODE_LENGTH) return false
  for (const ch of code) if (!ROOM_CODE_ALPHABET.includes(ch)) return false
  return true
}

const PLAYER_ID_RE = /^[A-Za-z0-9_-]{1,64}$/
const SECRET_RE = /^[A-Za-z0-9_-]{16,128}$/

/**
 * A usable player id: 1–64 URL-safe characters (profiles use UUIDs), never a
 * name that `Object.prototype` already has — ids key plain records on the wire.
 */
export function isPlayerId(id: unknown): id is string {
  return typeof id === 'string' && PLAYER_ID_RE.test(id) && !(id in Object.prototype)
}

/** Shape of a re-attach secret (see loadPlayerSecret). */
export function isPlayerSecret(x: unknown): x is string {
  return typeof x === 'string' && SECRET_RE.test(x)
}

/** True if `order` contains every integer 0..n-1 exactly once. */
export function isPermutation(order: unknown, n: number): order is number[] {
  if (!Array.isArray(order) || order.length !== n || n < 1) return false
  const seen = new Uint8Array(n)
  for (const v of order) {
    if (!isIndex(v, n) || seen[v]) return false
    seen[v] = 1
  }
  return true
}

// ---- profile ----------------------------------------------------------------

/** RFC 4122 v4 id. crypto.randomUUID only exists in secure contexts (not plain-http LAN dev), so fall back. */
function generateId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch {
    // fall through
  }
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(bytes)
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Fresh profile: new id, fun name, random avatar + color. */
function randomProfile(): PlayerProfile {
  return {
    id: generateId(),
    name: randomPlayerName(),
    avatar: randomInt(AVATARS.length),
    color: randomInt(PLAYER_COLORS.length),
  }
}

/**
 * Validate / repair a stored profile. Keeps the id when it is usable and
 * replaces any invalid field with a random one. Null when there is no usable id.
 */
export function normalizeProfile(raw: unknown): PlayerProfile | null {
  if (!isRecord(raw)) return null
  const id = typeof raw.id === 'string' ? raw.id.trim() : ''
  if (!isPlayerId(id)) return null
  const name = sanitizeName(raw.name)
  return {
    id,
    name: name || randomPlayerName(),
    avatar: isIndex(raw.avatar, AVATARS.length) ? raw.avatar : randomInt(AVATARS.length),
    color: isIndex(raw.color, PLAYER_COLORS.length) ? raw.color : randomInt(PLAYER_COLORS.length),
  }
}

/** Stored profile, or a freshly generated one (which is saved right away). Never throws. */
export function loadProfile(): PlayerProfile {
  const stored = normalizeProfile(readJson('local', STORAGE_KEYS.profile))
  const profile = stored ?? randomProfile()
  saveProfile(profile)
  return profile
}

export function saveProfile(profile: PlayerProfile): void {
  writeJson('local', STORAGE_KEYS.profile, {
    id: profile.id,
    name: profile.name,
    avatar: profile.avatar,
    color: profile.color,
  })
}

// ---- re-attach secret ---------------------------------------------------------

let secretCache: { id: string; secret: string } | null = null

function randomSecret(): string {
  const bytes = new Uint8Array(24)
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(bytes)
    else throw new Error('no crypto')
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * This browser's private key for `profileId`, sent with every `hello` so the host
 * can tell the real owner of a seat from someone who copied the (public) player
 * id. Lives in localStorage next to the profile (every tab of this browser shares
 * it), is never part of RoomState, and is created on first use. Never throws.
 */
export function loadPlayerSecret(profileId: string): string {
  if (secretCache?.id === profileId) return secretCache.secret
  const raw = readJson('local', STORAGE_KEYS.secret)
  let secret = isRecord(raw) && raw.id === profileId && isPlayerSecret(raw.secret) ? raw.secret : null
  if (!secret) {
    secret = randomSecret()
    writeJson('local', STORAGE_KEYS.secret, { id: profileId, secret })
  }
  // Blocked storage: at least stay stable for this page's lifetime.
  secretCache = { id: profileId, secret }
  return secret
}

// ---- session (this tab) ---------------------------------------------------

export interface SessionInfo {
  role: 'host' | 'client'
  code: string
}

export function loadSession(): SessionInfo | null {
  const raw = readJson('session', STORAGE_KEYS.session)
  if (!isRecord(raw)) return null
  if ((raw.role !== 'host' && raw.role !== 'client') || !isRoomCode(raw.code)) return null
  return { role: raw.role, code: raw.code }
}

export function saveSession(session: SessionInfo): void {
  writeJson('session', STORAGE_KEYS.session, { role: session.role, code: session.code })
}

/**
 * Forget the session. With `code`: only if the stored session is that room's
 * (a newer session for another room is kept), plus that room's host snapshot
 * and saved arrangements.
 */
export function clearSession(code?: string | null): void {
  if (!code || loadSession()?.code === code) remove('session', STORAGE_KEYS.session)
  if (code) {
    clearHostSnapshot(code)
    clearArrangements(code)
  }
}

// ---- host snapshot (host refresh recovery) ----------------------------------

interface HostSnapshot {
  v: 1
  savedAt: number
  state: RoomState
}

function looksLikeRoom(x: unknown): x is RoomState {
  return (
    isRecord(x) &&
    typeof x.code === 'string' &&
    typeof x.hostId === 'string' &&
    Array.isArray(x.players) &&
    isRecord(x.phase) &&
    typeof x.phase.kind === 'string' &&
    isRecord(x.settings) &&
    typeof x.seq === 'number'
  )
}

/** Write the host's state snapshot (sessionStorage `unshuffle:host:CODE`, shape `HostSnapshot`). */
export function saveHostSnapshot(state: RoomState, now = Date.now()): boolean {
  const snapshot: HostSnapshot = { v: 1, savedAt: now, state }
  return writeJson('session', STORAGE_KEYS.hostSnapshot(state.code), snapshot)
}

/**
 * The host snapshot for `code` if it exists and is fresh. Accepts `{ state | room,
 * savedAt | at | ts | time }` wrappers as well as a bare RoomState carrying a
 * `savedAt` field; a snapshot without any timestamp is not trusted.
 */
export function loadHostSnapshot(code: string, maxAgeMs = HOST_SNAPSHOT_MAX_AGE_MS, now = Date.now()): RoomState | null {
  const raw = readJson('session', STORAGE_KEYS.hostSnapshot(code))
  if (!isRecord(raw)) return null
  const state = looksLikeRoom(raw.state) ? raw.state : looksLikeRoom(raw.room) ? raw.room : looksLikeRoom(raw) ? raw : null
  if (!state || state.code !== code) return null
  const stamp = [raw.savedAt, raw.at, raw.ts, raw.time].find((t): t is number => typeof t === 'number' && Number.isFinite(t))
  if (stamp === undefined) return null
  const age = now - stamp
  if (age < 0 || age > maxAgeMs) return null
  return state
}

function clearHostSnapshot(code: string): void {
  remove('session', STORAGE_KEYS.hostSnapshot(code))
}

// ---- live arrangement (client refresh mid-round) ----------------------------

/** Remember my arrangement for a round, tagged with the track so a later game in the same room can't reuse it. */
export function saveArrangement(code: string, round: number, trackId: number, order: readonly number[]): void {
  writeJson('session', STORAGE_KEYS.arrangement(code, round), { track: trackId, order })
}

/** Saved arrangement for this round + track, only if it is a valid permutation of n snippets. */
export function loadArrangement(code: string, round: number, trackId: number, n: number): number[] | null {
  const raw = readJson('session', STORAGE_KEYS.arrangement(code, round))
  if (!isRecord(raw) || raw.track !== trackId || !isPermutation(raw.order, n)) return null
  return [...raw.order]
}

export function clearArrangements(code: string): void {
  const s = storage('session')
  if (!s) return
  try {
    const prefix = STORAGE_KEYS.arrangementPrefix(code)
    const keys: string[] = []
    for (let i = 0; i < s.length; i++) {
      const key = s.key(i)
      if (key?.startsWith(prefix)) keys.push(key)
    }
    for (const key of keys) s.removeItem(key)
  } catch {
    // Blocked storage: nothing to clean up.
  }
}
