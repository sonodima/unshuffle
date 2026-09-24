// Minimal hash router. Routes:
//   #/             home
//   #/r/KXQPM      room link (the store keeps it in sync while in a room)
// The store writes the room hash itself (history.replaceState + a synthetic
// `hashchange`); this module parses hashes and offers helpers for links.

import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '../game/constants'

type RouteName = 'home' | 'room' | 'unknown'

interface HashRoute {
  name: RouteName
  /** Normalized path without the '#': '/', '/r/KXQPM'… */
  path: string
  /** Named segments. Room routes: `{ code }` (uppercased, even when invalid). */
  params: Readonly<Record<string, string>>
  /** Valid room code for 'room' routes, otherwise null. */
  code: string | null
  /** Raw `location.hash` the route was parsed from. */
  hash: string
}

const HOME_PATH = '/'

const EMPTY: Readonly<Record<string, string>> = Object.freeze({})
const ROOM_RE = /^\/r\/([^/?#]+)$/i

/** True for a well-formed room code (5 letters of ROOM_CODE_ALPHABET, case-insensitive). */
export function isValidRoomCode(code: string | null | undefined): code is string {
  if (typeof code !== 'string') return false
  const upper = code.toUpperCase()
  if (upper.length !== ROOM_CODE_LENGTH) return false
  for (const ch of upper) if (!ROOM_CODE_ALPHABET.includes(ch)) return false
  return true
}

/** '#/r/abcde/?x' → '/r/abcde'. Anything empty → '/'. */
export function normalizePath(hashOrPath: string): string {
  let p = String(hashOrPath ?? '').trim()
  if (p.startsWith('#')) p = p.slice(1)
  const q = p.indexOf('?')
  if (q >= 0) p = p.slice(0, q)
  try {
    p = decodeURIComponent(p)
  } catch {
    // keep the raw path
  }
  if (!p.startsWith('/')) p = `/${p}`
  p = p.replace(/\/{2,}/g, '/')
  if (p.length > 1) p = p.replace(/\/+$/, '')
  return p || '/'
}

export function parseHash(hash: string): HashRoute {
  const path = normalizePath(hash)
  if (path === HOME_PATH) return { name: 'home', path, params: EMPTY, code: null, hash }
  const room = ROOM_RE.exec(path)
  if (room) {
    const code = room[1].toUpperCase()
    return { name: 'room', path: `/r/${code}`, params: Object.freeze({ code }), code: isValidRoomCode(code) ? code : null, hash }
  }
  return { name: 'unknown', path, params: EMPTY, code: null, hash }
}

/**
 * Go to a path ('/', roomPath(code)…). `replace` swaps the
 * current history entry (no back-button step). Always notifies `hashchange` listeners.
 */
export function navigate(path: string, opts: { replace?: boolean } = {}): void {
  try {
    const hash = `#${normalizePath(path)}`
    if (location.hash === hash) return
    if (opts.replace && typeof history !== 'undefined' && typeof history.replaceState === 'function') {
      const oldURL = location.href
      history.replaceState(history.state, '', hash)
      window.dispatchEvent(
        typeof HashChangeEvent === 'function' ? new HashChangeEvent('hashchange', { oldURL, newURL: location.href }) : new Event('hashchange'),
      )
    } else {
      location.hash = hash
    }
  } catch {
    // Sandboxed frames can refuse history access: routing is cosmetic there.
  }
}

export function roomPath(code: string): string {
  return `/r/${String(code).toUpperCase()}`
}

export function roomHash(code: string): string {
  return `#${roomPath(code)}`
}
