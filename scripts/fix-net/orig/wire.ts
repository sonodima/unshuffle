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
  /** Intentional close; the receiver must not try to reconnect. r = reason. */
  | { k: 'bye'; r: ByeReason }

export type ByeReason = 'closed' | 'dropped' | 'leave'

/** PeerJS rejects frames of >= 16300 bytes; keep a comfortable margin. */
export const MAX_FRAME_BYTES = 15_000
/** JSON text this short can never exceed MAX_FRAME_BYTES (<= 3 UTF-8 bytes per UTF-16 unit). */
const SAFE_INLINE_CHARS = 4_900
const CHUNK_OVERHEAD_BYTES = 80
const MAX_MESSAGE_CHARS = 8_000_000
const MAX_CHUNKS = 2_000

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

/** Reassembles chunked messages of one connection (the channel is ordered & reliable). */
export class Reassembler {
  private current: { id: number; n: number; parts: string[]; chars: number } | null = null

  /** Returns the decoded message when `frame` completes it, otherwise undefined. */
  push(frame: ChunkFrame): { value: unknown } | undefined {
    const { id, i, n, d } = frame
    if (typeof d !== 'string' || !Number.isInteger(n) || n < 1 || n > MAX_CHUNKS || i < 0 || i >= n) return undefined
    if (i === 0) this.current = { id, n, parts: [], chars: 0 }
    const cur = this.current
    // Out-of-sequence chunk (a previous message was cut short): drop it.
    if (!cur || cur.id !== id || cur.n !== n || cur.parts.length !== i) {
      this.current = null
      return undefined
    }
    cur.parts.push(d)
    cur.chars += d.length
    if (cur.chars > MAX_MESSAGE_CHARS) {
      this.current = null
      return undefined
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
