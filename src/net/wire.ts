// Transport-level framing inside the PeerJS JSON data channel.
//
// PeerJS' JSON serializer refuses (silently, with an 'error' event) any payload
// of 16300+ encoded bytes, and a full RoomState easily exceeds that. So large
// messages are sent as ordered chunks of their JSON text and reassembled on the
// other side. Heartbeats and goodbyes travel in the same envelope.

/** Frames on the wire. `k` = kind. */
export type Frame =
  /** A whole app message. */
  | { k: 'm'; m: unknown }
  /** Chunk `i` of `n` of the JSON text of app message `id`. */
  | { k: 'c'; id: number; i: number; n: number; d: string }
  /** Keepalive. */
  | { k: 'hb' }
  /** Goodbye. r = reason; see ByeReason for what the receiver does with it. */
  | { k: 'bye'; r: ByeReason }

/**
 * - closed / dropped / leave: intentional close, the receiver must not try to reconnect.
 * - away: the sender's page is going away (tab closed, reload, navigation). Not a
 *   decision to leave: the receiver treats the link as lost right away instead of
 *   waiting for the heartbeat timeout, and a client keeps trying to reconnect
 *   (a reloading host comes back under the same code).
 */
export type ByeReason = 'closed' | 'dropped' | 'leave' | 'away'

/** PeerJS rejects frames of >= 16300 bytes; keep a comfortable margin. */
export const MAX_FRAME_BYTES = 15_000
/** JSON text this short can never exceed MAX_FRAME_BYTES (<= 3 UTF-8 bytes per UTF-16 unit). */
const SAFE_INLINE_CHARS = 4_900
const CHUNK_OVERHEAD_BYTES = 80

export interface ReassemblerLimits {
  /** Most chunks one message may announce. */
  readonly maxChunks: number
  /** Most JSON characters one message may add up to. */
  readonly maxChars: number
}

/** Host → client: a full RoomState can be large (tracks, results, …). */
export const DOWNSTREAM_LIMITS: ReassemblerLimits = { maxChunks: 2_000, maxChars: 8_000_000 }

/**
 * Client → host: real messages (hello, arrange, submit, reaction…) are well under
 * 1 KB, so anything near these limits is garbage or abuse and must not cost a
 * phone host main-thread time (JSON.parse + GC) on every frame.
 */
export const UPSTREAM_LIMITS: ReassemblerLimits = { maxChunks: 8, maxChars: 64_000 }

export const HEARTBEAT: Frame = { k: 'hb' }

export function isFrame(x: unknown): x is Frame {
  if (typeof x !== 'object' || x === null) return false
  const k = (x as { k?: unknown }).k
  return k === 'm' || k === 'c' || k === 'hb' || k === 'bye'
}

/** UTF-8 byte length of a string (lone surrogates count as 3, like TextEncoder's U+FFFD). */
export function utf8Length(s: string): number {
  let bytes = 0
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c < 0x80) bytes += 1
    else if (c < 0x800) bytes += 2
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const next = s.charCodeAt(i + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4
        i++
      } else bytes += 3
    } else bytes += 3
  }
  return bytes
}

const isHighSurrogate = (c: number): boolean => c >= 0xd800 && c <= 0xdbff

/**
 * Encodes one app message into frames. `nextId` provides message ids for
 * chunked messages. Returns [] for values JSON cannot represent.
 */
export function encodeMessage(msg: unknown, nextId: () => number): Frame[] {
  let json: string | undefined
  try {
    json = JSON.stringify(msg)
  } catch {
    return []
  }
  if (json === undefined) return []
  // {"k":"m","m":<json>} adds 14 bytes.
  if (json.length <= SAFE_INLINE_CHARS || utf8Length(json) + 14 <= MAX_FRAME_BYTES) return [{ k: 'm', m: msg }]

  const pieces: string[] = []
  const budget = MAX_FRAME_BYTES - CHUNK_OVERHEAD_BYTES
  let size = 12_000
  let pos = 0
  while (pos < json.length) {
    let end = Math.min(json.length, pos + size)
    if (end < json.length && isHighSurrogate(json.charCodeAt(end - 1))) end--
    let piece = json.slice(pos, end)
    let bytes = utf8Length(JSON.stringify(piece))
    while (bytes > budget && end - pos > 1) {
      end = pos + Math.max(1, Math.floor(((end - pos) * budget) / bytes) - 16)
      if (end < json.length && end - pos > 1 && isHighSurrogate(json.charCodeAt(end - 1))) end--
      piece = json.slice(pos, end)
      bytes = utf8Length(JSON.stringify(piece))
    }
    pieces.push(piece)
    // Adapt the next guess to this message's escaping density.
    size = Math.max(256, Math.floor(((end - pos) * budget) / Math.max(1, bytes)))
    pos = end
  }
  const id = nextId()
  const n = pieces.length
  return pieces.map((d, i) => ({ k: 'c', id, i, n, d }))
}

type ChunkFrame = Extract<Frame, { k: 'c' }>

/**
 * `{ value }` when a frame completes a message, `{ overflow: true }` when a
 * message breaks the limits (the sender is broken or hostile), otherwise undefined.
 */
export type ReassembleResult = { value: unknown } | { overflow: true } | undefined

/** Reassembles chunked messages of one connection (the channel is ordered & reliable). */
export class Reassembler {
  private readonly limits: ReassemblerLimits
  private current: { id: number; n: number; parts: string[]; chars: number } | null = null

  constructor(limits: ReassemblerLimits = DOWNSTREAM_LIMITS) {
    this.limits = limits
  }

  push(frame: ChunkFrame): ReassembleResult {
    const { id, i, n, d } = frame
    if (typeof d !== 'string' || !Number.isInteger(n) || !Number.isInteger(i) || n < 1 || i < 0 || i >= n) {
      return undefined
    }
    if (n > this.limits.maxChunks) {
      this.current = null
      return { overflow: true }
    }
    if (i === 0) this.current = { id, n, parts: [], chars: 0 }
    const cur = this.current
    // Out-of-sequence chunk (a previous message was cut short): drop it.
    if (!cur || cur.id !== id || cur.n !== n || cur.parts.length !== i) {
      this.current = null
      return undefined
    }
    cur.parts.push(d)
    cur.chars += d.length
    if (cur.chars > this.limits.maxChars) {
      this.current = null
      return { overflow: true }
    }
    if (cur.parts.length < n) return undefined
    this.current = null
    try {
      return { value: JSON.parse(cur.parts.join('')) as unknown }
    } catch {
      return undefined
    }
  }

  clear(): void {
    this.current = null
  }
}
