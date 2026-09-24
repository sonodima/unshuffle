// PeerJS plumbing: lazy module load (keeps ~100 kB of WebRTC code and its
// import-time RTCPeerConnection probe off the initial page load), signaling
// server + ICE (STUN/TURN) configuration, tracked Peer creation/destruction and
// a typed "wait until open" helper.
//
// Deploy-time configuration (all optional, read from import.meta.env at build):
//
//   Signaling server (default: the public PeerJS cloud, wss://0.peerjs.com:443/):
//     VITE_PEERJS_HOST     peer.example.com  (also wss://peer.example.com:9000/app, or / = the page's host)
//     VITE_PEERJS_PORT     9000
//     VITE_PEERJS_PATH     /app              (the PeerServer's path, default /)
//     VITE_PEERJS_KEY      peerjs
//     VITE_PEERJS_SECURE   true | false      (default: same as the page, https → wss)
//   A self-hosted PeerServer is one command: `npx -p peer peerjs --port 9000 --path /app`
//   (the CLI ships in the `peer` package; `peerjs` is only the client library).
//
//   TURN relay — needed by players behind carrier-grade / symmetric NAT (most
//   4G/5G), and by UDP-blocking networks (offices, schools, hotels: TCP/TLS 443):
//     VITE_TURN_CREDENTIALS_URL   endpoint returning RTCIceServer[] (or {iceServers},
//                                 or the TURN REST shape {username, password, ttl, uris}),
//                                 fetched at runtime, e.g. Metered / Open Relay:
//                                 https://<app>.metered.live/api/v1/turn/credentials?apiKey=<key>
//     VITE_TURN_CREDENTIALS_METHOD GET (default) | POST
//     VITE_TURN_CREDENTIALS_TTL   seconds to reuse a response that has no ttl (default 3600)
//   or static credentials (e.g. ExpressTURN, your own coturn):
//     VITE_TURN_URLS        turn:h:80,turn:h:80?transport=tcp,turns:h:443?transport=tcp
//     VITE_TURN_USERNAME    …
//     VITE_TURN_CREDENTIAL  …
//   Use a hostname that matches the relay's TLS certificate for turns: URLs.
//   Everything here ends up public in the bundle: use front-end keys only.
//
// Every ICE server is validated before use: a malformed entry (typo in the
// scheme, `?transport=tls`, empty credentials…) would make Chrome throw in the
// RTCPeerConnection constructor and break EVERY connection, so it is dropped
// with a console warning and STUN / direct connectivity keep working.

import type { DataConnection, Peer, PeerOptions } from 'peerjs'
import { race } from './runtime'
import { NET_TIMING } from './timing'

export type PeerModule = typeof import('peerjs')
export type { DataConnection, Peer }

let modulePromise: Promise<PeerModule> | null = null

export function loadPeerJs(): Promise<PeerModule> {
  modulePromise ??= import('peerjs').catch((err: unknown) => {
    modulePromise = null
    throw err
  })
  return modulePromise
}

const env: Record<string, string | undefined> =
  (import.meta as { env?: Record<string, string | undefined> }).env ?? {}

const envString = (key: string): string => (env[key] ?? '').trim()

const warned = new Set<string>()
/** Configuration problems are the deployer's to fix: say so once, in the console. */
function warnOnce(message: string): void {
  if (warned.has(message)) return
  warned.add(message)
  console.warn(`[net] ${message}`)
}

// ---- signaling server --------------------------------------------------------

type SignalingOptions = Pick<PeerOptions, 'host' | 'port' | 'path' | 'key' | 'secure'>

function parseBool(value: string): boolean | undefined {
  if (/^(1|true|yes|on)$/i.test(value)) return true
  if (/^(0|false|no|off)$/i.test(value)) return false
  return undefined
}

function signalingFromEnv(): SignalingOptions {
  const out: SignalingOptions = {}
  const rawHost = envString('VITE_PEERJS_HOST')
  // '/' = the page's own host name (PeerJS resolves it), e.g. a PeerServer behind the same domain.
  if (rawHost === '/') out.host = '/'
  else if (rawHost) {
    try {
      const url = new URL(/^[a-z]+:\/\//i.test(rawHost) ? rawHost : `wss://${rawHost}`)
      if (!url.hostname) throw new Error('no hostname')
      // IPv6 literals keep their brackets: PeerJS builds `wss://${host}:${port}…`.
      out.host = url.hostname
      if (url.port) out.port = Number(url.port)
      if (url.pathname && url.pathname !== '/') out.path = url.pathname
      if (/^[a-z]+:\/\//i.test(rawHost)) out.secure = url.protocol === 'wss:' || url.protocol === 'https:'
    } catch {
      warnOnce(`VITE_PEERJS_HOST "${rawHost}" is not a valid host name: using the public PeerJS server.`)
      return {}
    }
  }
  const port = envString('VITE_PEERJS_PORT')
  if (port) {
    const n = Number(port)
    if (Number.isInteger(n) && n > 0 && n < 65_536) out.port = n
    else warnOnce(`VITE_PEERJS_PORT "${port}" is not a valid port: ignored.`)
  }
  const path = envString('VITE_PEERJS_PATH')
  if (path) out.path = path
  const key = envString('VITE_PEERJS_KEY')
  if (key) out.key = key
  const secure = envString('VITE_PEERJS_SECURE')
  if (secure) {
    const b = parseBool(secure)
    if (b === undefined) warnOnce(`VITE_PEERJS_SECURE "${secure}" is not true/false: ignored.`)
    else out.secure = b
  }
  // Port / path / key without a host would silently point at the cloud with odd settings.
  if (!out.host && Object.keys(out).length) {
    warnOnce('VITE_PEERJS_PORT / PATH / KEY / SECURE need VITE_PEERJS_HOST: using the public PeerJS server.')
    return {}
  }
  return out
}

const signaling: SignalingOptions = signalingFromEnv()

// ---- ICE servers ---------------------------------------------------------------

/** Two independent STUN providers (stun1.l.google.com is the same host as stun.l.google.com). */
const DEFAULT_STUN: RTCIceServer = { urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }

const ICE_URL_RE = /^(stuns?|turns?):\S+$/i
const isTurnUrl = (url: string): boolean => /^turns?:/i.test(url)

function asStrings(value: unknown): string[] {
  if (typeof value === 'string') return value.split(/[\s,]+/)
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  return []
}

/**
 * Shape check for one ICE server from config / a credentials endpoint: known
 * schemes only, TURN URLs only with non-empty credentials (Chrome throws
 * "TURN server with empty username or password" for those). Null if nothing is left.
 */
function normalizeServer(raw: unknown, source: string): RTCIceServer | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  // `url` is the legacy spelling some providers (Twilio) still send.
  const urls = [...new Set([...asStrings(r.urls), ...asStrings(r.url)].map((u) => u.trim()).filter(Boolean))]
  const username = typeof r.username === 'string' ? r.username : ''
  const credential = typeof r.credential === 'string' ? r.credential : typeof r.password === 'string' ? r.password : ''
  const kept: string[] = []
  for (const url of urls) {
    if (!ICE_URL_RE.test(url)) warnOnce(`Ignoring ICE server URL "${url}" from ${source}: not a stun:/turn: URL.`)
    else if (isTurnUrl(url) && (!username || !credential)) {
      warnOnce(`Ignoring TURN URL "${url}" from ${source}: username or credential missing.`)
    } else kept.push(url)
  }
  if (!kept.length) return null
  const hasTurn = kept.some(isTurnUrl)
  return hasTurn ? { urls: kept, username, credential } : { urls: kept }
}

function normalizeList(list: readonly unknown[], source: string): RTCIceServer[] {
  const out: RTCIceServer[] = []
  for (const raw of list) {
    const s = normalizeServer(raw, source)
    if (s) out.push(s)
  }
  return out
}

/** Can the browser build a peer connection with these servers? (No network traffic.) */
function constructs(servers: RTCIceServer[]): boolean {
  let pc: RTCPeerConnection | undefined
  try {
    pc = new RTCPeerConnection({ iceServers: servers })
    return true
  } catch {
    return false
  } finally {
    try {
      pc?.close()
    } catch {
      // ignore
    }
  }
}

const validated = new Map<string, RTCIceServer[]>()

/**
 * Drops every server / URL this browser refuses, so one bad entry can never take
 * down the rest (the constructor throws for the whole list). Memoized per list.
 */
export function sanitizeIceServers(servers: readonly RTCIceServer[]): RTCIceServer[] {
  const key = JSON.stringify(servers)
  const hit = validated.get(key)
  if (hit) return hit
  const shaped = normalizeList(servers, 'the ICE config')
  let out = shaped
  if (typeof RTCPeerConnection === 'function' && !constructs(shaped)) {
    out = []
    for (const server of shaped) {
      if (constructs([server])) {
        out.push(server)
        continue
      }
      const urls = asStrings(server.urls).filter((url) => {
        const ok = constructs([{ ...server, urls: [url] }])
        if (!ok) warnOnce(`Ignoring ICE server URL "${url}": this browser rejects it.`)
        return ok
      })
      if (urls.length) out.push({ ...server, urls })
    }
  }
  if (validated.size > 20) validated.clear()
  validated.set(key, out)
  return out
}

function staticTurnFromEnv(): RTCIceServer[] {
  const urls = asStrings(envString('VITE_TURN_URLS')).map((u) => u.trim()).filter(Boolean)
  if (!urls.length) return []
  const server = normalizeServer(
    { urls, username: envString('VITE_TURN_USERNAME'), credential: envString('VITE_TURN_CREDENTIAL') },
    'VITE_TURN_URLS',
  )
  return server ? [server] : []
}

const STATIC_TURN = staticTurnFromEnv()
const TURN_CREDENTIALS_URL = envString('VITE_TURN_CREDENTIALS_URL')
const TURN_CREDENTIALS_METHOD = /^post$/i.test(envString('VITE_TURN_CREDENTIALS_METHOD')) ? 'POST' : 'GET'
const TURN_TTL_MS = (() => {
  const s = Number(envString('VITE_TURN_CREDENTIALS_TTL'))
  return Number.isFinite(s) && s >= 60 ? s * 1000 : NET_TIMING.turnDefaultTtlMs
})()

interface TurnCache {
  servers: RTCIceServer[]
  expiresAt: number
}

let turnCache: TurnCache | null = null
let turnInflight: Promise<void> | null = null
let turnRetryAt = 0

/**
 * Accepts the common credential-endpoint shapes: RTCIceServer[] (Metered),
 * {iceServers: [...] | {...}} (Cloudflare), {ice_servers: [...]} (Twilio),
 * {v: {iceServers}} (Xirsys), {username, password, ttl, uris} (TURN REST API).
 */
export function parseTurnResponse(json: unknown): { servers: RTCIceServer[]; ttlMs: number | null } {
  let list: unknown[] = []
  let ttlMs: number | null = null
  if (Array.isArray(json)) list = json
  else if (typeof json === 'object' && json !== null) {
    const o = json as Record<string, unknown>
    const nested = typeof o.v === 'object' && o.v !== null ? (o.v as Record<string, unknown>) : null
    const servers = o.iceServers ?? o.ice_servers ?? nested?.iceServers
    if (Array.isArray(servers)) list = servers
    else if (typeof servers === 'object' && servers !== null) list = [servers]
    else if (o.uris || o.urls) list = [{ urls: o.uris ?? o.urls, username: o.username, credential: o.credential ?? o.password }]
    const ttl = Number(o.ttl)
    if (Number.isFinite(ttl) && ttl > 0) ttlMs = ttl * 1000
    const expires = Number(o.expiresAt ?? o.expires_at ?? o.expires)
    if (Number.isFinite(expires) && expires > 0) {
      const at = expires < 1e12 ? expires * 1000 : expires
      ttlMs = Math.min(ttlMs ?? Infinity, at - Date.now())
    }
  }
  return { servers: normalizeList(list, 'the TURN credentials endpoint'), ttlMs }
}

async function fetchTurn(): Promise<void> {
  const url = TURN_CREDENTIALS_URL
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null
  const timer = setTimeout(() => ctrl?.abort(), 10_000)
  try {
    const res = await fetch(url, {
      method: TURN_CREDENTIALS_METHOD,
      credentials: 'omit',
      cache: 'no-store',
      signal: ctrl?.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const { servers, ttlMs } = parseTurnResponse(await res.json())
    if (!servers.length) throw new Error('no usable ICE servers in the response')
    const ttl = Math.max(60_000, ttlMs ?? TURN_TTL_MS)
    turnCache = { servers, expiresAt: Date.now() + ttl }
    turnRetryAt = 0
    applyToLivePeers()
  } catch (err) {
    turnRetryAt = Date.now() + NET_TIMING.turnRetryMs
    warnOnce(`TURN credentials unavailable (${err instanceof Error ? err.message : String(err)}): relayed connections may fail.`)
  } finally {
    clearTimeout(timer)
  }
}

function turnNeedsFetch(): boolean {
  if (!TURN_CREDENTIALS_URL || typeof fetch !== 'function') return false
  const t = Date.now()
  if (turnCache && t < turnCache.expiresAt - NET_TIMING.turnRefreshMarginMs) return false
  return t >= turnRetryAt
}

/**
 * Makes sure runtime TURN credentials are fetched (or being fetched). Waits at
 * most `waitMs` for them; a slow endpoint keeps loading in the background and
 * live Peers pick the result up for their next connection. Never rejects.
 */
export function prepareIceServers(waitMs: number = NET_TIMING.turnFetchTimeoutMs): Promise<void> {
  if (!turnInflight && turnNeedsFetch()) {
    turnInflight = fetchTurn().finally(() => {
      turnInflight = null
    })
  }
  const pending = turnInflight
  if (!pending || waitMs <= 0) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, waitMs)
    void pending.then(() => {
      clearTimeout(timer)
      resolve()
    })
  })
}

/** STUN first, then runtime TURN, then static TURN; validated. */
export function getIceServers(): RTCIceServer[] {
  return sanitizeIceServers([DEFAULT_STUN, ...(turnCache?.servers ?? []), ...STATIC_TURN])
}

// ---- Peers ---------------------------------------------------------------------

type PeerConfig = RTCConfiguration & { sdpSemantics?: string }

/**
 * Live Peers → the RTCConfiguration object they were created with. PeerJS hands
 * that same object to every RTCPeerConnection it creates, so refreshed TURN
 * credentials reach a long-lived host Peer by updating it in place.
 */
const livePeers = new Map<Peer, PeerConfig>()

function applyToLivePeers(): void {
  if (!livePeers.size) return
  const servers = getIceServers()
  for (const config of livePeers.values()) config.iceServers = servers
}

/**
 * Creates a Peer on the configured signaling server (default: the public PeerJS
 * cloud). `token` lets the server hand the same id back to us after a refresh or
 * a dropped socket, even before it noticed the old socket died.
 */
export function createPeer(mod: PeerModule, id: string, token: string): Peer {
  const config: PeerConfig = { iceServers: getIceServers(), sdpSemantics: 'unified-plan' }
  const peer = new mod.Peer(id, { debug: 0, token, config, ...signaling })
  livePeers.set(peer, config)
  return peer
}

export function destroyPeer(peer: Peer | null | undefined): void {
  if (!peer || !livePeers.delete(peer)) return
  try {
    peer.destroy()
  } catch {
    // Already torn down by PeerJS.
  }
  peer.removeAllListeners()
}

/** Closes a data connection and detaches our listeners. Safe to call repeatedly. */
export function closeConnection(conn: DataConnection | null | undefined): void {
  if (!conn) return
  conn.removeAllListeners()
  try {
    conn.close()
  } catch {
    // PeerJS may throw while its negotiator is half torn down.
  }
}

export type OpenResult = { ok: true; peer: Peer } | { ok: false; type: string }

/**
 * Creates a Peer and waits for the signaling server to confirm its id.
 * On failure the Peer is destroyed and the PeerJS error type is returned
 * ('unavailable-id', 'network', 'server-error', …, or our own 'timeout' / 'aborted').
 */
export async function openPeer(
  mod: PeerModule,
  id: string,
  token: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<OpenResult> {
  let peer: Peer
  try {
    peer = createPeer(mod, id, token)
  } catch {
    // PeerJS validates its options synchronously (e.g. a malformed server host).
    return { ok: false, type: 'network' }
  }
  const result = await waitForOpen(peer, timeoutMs, signal)
  if (!result.ok) destroyPeer(peer)
  return result
}

/** Waits until `peer` is registered on the signaling server (already open → immediate). */
export function waitForOpen(peer: Peer, timeoutMs: number, signal?: AbortSignal): Promise<OpenResult> {
  if (peer.open) return Promise.resolve({ ok: true, peer })
  if (peer.destroyed) return Promise.resolve({ ok: false, type: 'network' })
  return race<OpenResult>(
    { timeoutMs, onTimeout: { ok: false, type: 'timeout' }, signal, onAbort: { ok: false, type: 'aborted' } },
    (settle) => {
      const onOpen = (): void => settle({ ok: true, peer })
      const onError = (err: { type: string }): void => {
        // peer-unavailable / webrtc errors concern connections, not our registration.
        if (err.type === 'peer-unavailable' || err.type === 'webrtc') return
        settle({ ok: false, type: err.type })
      }
      const onGone = (): void => settle({ ok: false, type: 'network' })
      peer.on('open', onOpen)
      peer.on('error', onError)
      peer.on('disconnected', onGone)
      peer.on('close', onGone)
      return () => {
        peer.off('open', onOpen)
        peer.off('error', onError)
        peer.off('disconnected', onGone)
        peer.off('close', onGone)
      }
    },
  )
}
