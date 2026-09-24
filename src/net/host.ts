// Host side of the transport: owns the room's Peer (id = PEER_PREFIX + code),
// accepts client data channels, runs heartbeats, keeps the signaling socket
// alive, and frames/chunks every message.
//
// The signaling socket is what lets dropped players back in, and a half-dead one
// (network handover, NAT mapping gone after sleep) looks perfectly 'open'. So it
// is quietly re-opened (same id + token, ~300 ms) whenever there is reason to
// doubt it: all clients timed out at once, our timers were frozen, we came back
// online or back from a long spell in the background.

import { PEER_PREFIX, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '../game/constants'
import { isClientMsg } from './protocol'
import type { ClientMsg, HostMsg } from './protocol'
import { NetError, NET_MESSAGES, isTransientPeerError, signalingError } from './errors'
import { closeConnection, createPeer, destroyPeer, openPeer, prepareIceServers } from './peer'
import type { DataConnection, Peer, PeerModule } from './peer'
import { Listeners, Scope, netLog, netStats, now, randomString, randomToken, reportListenerError } from './runtime'
import { NET_TIMING } from './timing'
import { HEARTBEAT, Reassembler, UPSTREAM_LIMITS, encodeMessage, isFrame } from './wire'
import type { Frame } from './wire'
import type { ConnStatus, HostServer } from './transport'

interface HostConn {
  readonly id: string
  readonly conn: DataConnection
  readonly remotePeer: string
  state: 'pending' | 'open' | 'dropping' | 'closed'
  lastRx: number
  lastTx: number
  readonly rx: Reassembler
  cancelTimer: () => void
}

/** Hard cap on simultaneous data channels (MAX_PLAYERS is enforced by the game). */
const MAX_CONNECTIONS = 40
/** Events kept while nobody listens yet (the app subscribes right after createHost resolves). */
const BACKLOG_MAX = 500
const TOKEN_KEY = (code: string): string => `unshuffle:net:host-token:${code}`

function loadToken(code: string): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY(code))
  } catch {
    return null
  }
}

function saveToken(code: string, token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY(code), token)
  } catch {
    // Private mode / storage disabled: reclaiming after a refresh just gets slower.
  }
}

function forgetToken(code: string): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY(code))
  } catch {
    // ignore
  }
}

// A Web Lock per hosted code, held for the host's lifetime. It is released
// when the tab closes or reloads, so a refreshed tab can reclaim its code,
// while a *duplicated* tab (which inherits sessionStorage, token included)
// sees the lock taken and won't hijack the live room.
const LOCK_NAME = (code: string): string => `unshuffle:net:host:${code}`

function locks(): LockManager | null {
  return typeof navigator !== 'undefined' && navigator.locks ? navigator.locks : null
}

async function isHostedElsewhere(code: string): Promise<boolean> {
  const lm = locks()
  if (!lm) return false
  try {
    const { held = [] } = await lm.query()
    return held.some((l) => l.name === LOCK_NAME(code))
  } catch {
    return false
  }
}

/** Holds the code's lock until the returned release function is called. */
function holdHostLock(code: string): () => void {
  const lm = locks()
  if (!lm) return () => {}
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  lm.request(LOCK_NAME(code), { ifAvailable: true }, (lock) => (lock ? held : undefined)).catch(() => {})
  return release
}

export function randomRoomCode(): string {
  return randomString(ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH)
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const isOffline = (): boolean => typeof navigator !== 'undefined' && navigator.onLine === false

/**
 * Registers PEER_PREFIX + code on the signaling server.
 * - `requested`: retried while the server still holds it (e.g. right after a
 *   refresh), then we fall back to a fresh random code.
 * - transient network/server failures are retried with backoff, but a server
 *   that can't be reached at all is reported as such within a few seconds.
 */
async function claimHostPeer(
  mod: PeerModule,
  requested: string | null,
  startedAt: number,
): Promise<{ peer: Peer; code: string; token: string }> {
  const deadline = startedAt + NET_TIMING.createTimeoutMs
  const reclaimUntil = now() + NET_TIMING.reclaimWindowMs
  const takenHere = requested !== null && (await isHostedElsewhere(requested))
  if (takenHere) netLog('host', `${requested} is hosted by another tab of this browser`)
  let code = requested !== null && !takenHere ? requested : randomRoomCode()
  let reclaiming = requested !== null && !takenHere
  let signalingFailures = 0
  let signalingTimeouts = 0
  let collisions = 0
  let lastError: NetError | null = null

  for (;;) {
    const remaining = deadline - now()
    if (remaining <= 250) throw lastError ?? new NetError('timeout', NET_MESSAGES.createTimeout)
    const token = (reclaiming ? loadToken(code) : null) ?? randomToken()
    const result = await openPeer(mod, PEER_PREFIX + code, token, Math.min(NET_TIMING.registerTimeoutMs, remaining))
    if (result.ok) {
      saveToken(code, token)
      netLog('host', `registered ${code}${requested && code !== requested ? ` (requested ${requested})` : ''}`)
      return { peer: result.peer, code, token }
    }
    netLog('host', `register ${code} failed: ${result.type}`)

    if (result.type === 'unavailable-id') {
      if (reclaiming && now() + NET_TIMING.reclaimRetryMs < reclaimUntil) {
        await sleep(NET_TIMING.reclaimRetryMs)
        continue
      }
      reclaiming = false
      if (++collisions > 20) throw new NetError('server', NET_MESSAGES.server)
      code = randomRoomCode()
      continue
    }
    if (result.type === 'browser-incompatible') throw new NetError('unsupported', NET_MESSAGES.unsupported)
    if (isOffline()) throw new NetError('network', NET_MESSAGES.network)
    // Registration never succeeded, so whatever went wrong is between us and the
    // signaling server ("your internet is down" would be wrong: we're online).
    lastError = signalingError(result.type)
    if (!isTransientPeerError(result.type)) throw lastError
    if (result.type === 'timeout') signalingTimeouts++
    if (
      ++signalingFailures >= NET_TIMING.maxSignalingFailures ||
      signalingTimeouts >= NET_TIMING.maxSignalingTimeouts
    ) {
      throw lastError
    }
    const backoff = NET_TIMING.retryDelaysMs[Math.min(signalingFailures - 1, NET_TIMING.retryDelaysMs.length - 1)]
    if (now() + backoff + 250 >= deadline) throw lastError
    await sleep(backoff)
  }
}

/** `startedAt`: when the user asked (module loading counts against createTimeoutMs too). */
export async function createHostServer(
  mod: PeerModule,
  requested: string | null,
  startedAt: number = now(),
): Promise<HostServer> {
  const { peer, code, token } = await claimHostPeer(mod, requested, startedAt)
  return new HostServerImpl(mod, peer, code, token)
}

export class HostServerImpl implements HostServer {
  readonly code: string
  private readonly mod: PeerModule
  private readonly token: string
  private readonly peerId: string
  private peer: Peer
  private readonly conns = new Map<string, HostConn>()
  private readonly scope = new Scope()
  private readonly messageL = new Listeners<[string, ClientMsg]>()
  private readonly connectL = new Listeners<[string]>()
  private readonly disconnectL = new Listeners<[string]>()
  private readonly statusL = new Listeners<[ConnStatus, string | undefined]>()
  private status: ConnStatus = 'open'
  private statusDetail: string | undefined
  private closed = false
  private chunkSeq = 0
  /** Events that happened before the app subscribed to onMessage; flushed once it does. */
  private backlog: (() => void)[] | null = []
  private reconnectAttempts = 0
  private cancelReconnect: (() => void) | null = null
  private reconnectStartedAt = 0
  private lastTick = now()
  /** A quiet signaling recycle is in progress since then (0 = none). */
  private recycleSince = 0
  private lastRecycleAt = -Infinity
  private cancelDelayedRecycle: (() => void) | null = null
  /** The next 'disconnected' is the one recycleSignaling() caused: reconnect without a status change. */
  private quietDisconnect = false
  private hiddenAt = 0
  private readonly releaseLock: () => void

  constructor(mod: PeerModule, peer: Peer, code: string, token: string) {
    this.mod = mod
    this.peer = peer
    this.code = code
    this.token = token
    this.peerId = PEER_PREFIX + code
    this.releaseLock = holdHostLock(code)
    netStats.hosts++
    this.attach(peer)
    this.scope.interval(() => this.tick(), NET_TIMING.tickMs)
    const win = typeof window === 'undefined' ? undefined : window
    if (typeof document !== 'undefined' && document.hidden) this.hiddenAt = now()
    this.scope.listen(win, 'online', () => {
      this.reconnectNow()
      this.recycleSignaling('online')
    })
    this.scope.listen(typeof document === 'undefined' ? undefined : document, 'visibilitychange', () =>
      this.onVisibility(),
    )
    this.scope.listen(win, 'pagehide', () => this.onPageHide())
    this.scope.listen(win, 'pageshow', (e) => {
      if ((e as PageTransitionEvent).persisted) this.recycleSignaling('page-restored')
    })
  }

  // ---- public API ----

  onMessage(cb: (connId: string, msg: ClientMsg) => void): () => void {
    const off = this.messageL.add(cb)
    this.flushBacklogSoon()
    return off
  }

  onConnect(cb: (connId: string) => void): () => void {
    return this.connectL.add(cb)
  }

  onDisconnect(cb: (connId: string) => void): () => void {
    return this.disconnectL.add(cb)
  }

  /** Replays the current status to the new listener immediately. */
  onStatus(cb: (status: ConnStatus, detail?: string) => void): () => void {
    const off = this.statusL.add(cb)
    try {
      cb(this.status, this.statusDetail)
    } catch (err) {
      reportListenerError(err)
    }
    return off
  }

  send(connId: string, msg: HostMsg): void {
    const hc = this.conns.get(connId)
    if (!hc || hc.state !== 'open') return
    const frames = encodeMessage(msg, () => ++this.chunkSeq)
    this.sendFrames(hc, frames)
  }

  broadcast(msg: HostMsg): void {
    let frames: Frame[] | null = null
    for (const hc of this.conns.values()) {
      if (hc.state !== 'open') continue
      frames ??= encodeMessage(msg, () => ++this.chunkSeq)
      this.sendFrames(hc, frames)
    }
  }

  drop(connId: string, finalMsg?: HostMsg): void {
    const hc = this.conns.get(connId)
    if (!hc) return
    if (hc.state !== 'open') {
      if (hc.state === 'pending') this.finalize(hc, 'dropped')
      return
    }
    if (finalMsg) this.sendFrames(hc, encodeMessage(finalMsg, () => ++this.chunkSeq))
    // The client closes the channel as soon as it reads 'bye' (one trip later,
    // so finalMsg is guaranteed to have arrived); force-close if it doesn't.
    this.sendFrames(hc, [{ k: 'bye', r: 'dropped' }])
    hc.state = 'dropping'
    hc.cancelTimer()
    hc.cancelTimer = this.scope.timeout(() => this.finalize(hc, 'dropped'), NET_TIMING.dropForceMs)
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    netLog('host', `close ${this.code}`)
    this.messageL.clear()
    this.connectL.clear()
    this.disconnectL.clear()
    this.statusL.clear()
    this.backlog = null
    this.status = 'closed'
    this.scope.dispose()
    this.releaseLock()
    forgetToken(this.code)
    netStats.hosts--
    const conns = [...this.conns.values()]
    this.conns.clear()
    for (const hc of conns) {
      if (hc.state === 'open') this.sendFrames(hc, [{ k: 'bye', r: 'closed' }])
      hc.state = 'closed'
      hc.conn.removeAllListeners()
    }
    // Let the goodbyes flush (clients close on 'bye'), then tear everything down.
    const peer = this.peer
    peer.removeAllListeners()
    peer.on('connection', (c) => closeConnection(c))
    netStats.timers++
    setTimeout(() => {
      netStats.timers--
      for (const hc of conns) closeConnection(hc.conn)
      destroyPeer(peer)
    }, conns.length ? NET_TIMING.flushMs : 0)
  }

  /** Remote PeerJS id of a connection (stable across that tab's reconnects). */
  remotePeerId(connId: string): string | null {
    return this.conns.get(connId)?.remotePeer ?? null
  }

  // ---- debug hooks (netDebug) ----

  debugBreak(connId: string): boolean {
    const hc = this.conns.get(connId)
    if (!hc) return false
    hc.conn.close()
    return true
  }

  debugDropSignaling(): boolean {
    if (this.closed || this.peer.disconnected) return false
    this.peer.disconnect()
    return true
  }

  debugConnIds(): string[] {
    return [...this.conns.values()].filter((c) => c.state === 'open').map((c) => c.id)
  }

  // ---- internals ----

  private setStatus(status: ConnStatus, detail?: string): void {
    if (this.closed || (status === this.status && detail === this.statusDetail)) return
    this.status = status
    this.statusDetail = detail
    netLog('host', `status ${status}${detail ? ` (${detail})` : ''}`)
    this.statusL.emit(status, detail)
  }

  private deliver(fn: () => void): void {
    if (!this.backlog) return fn()
    this.backlog.push(fn)
    if (this.backlog.length > BACKLOG_MAX) this.backlog.shift()
  }

  private flushBacklogSoon(): void {
    if (!this.backlog) return
    queueMicrotask(() => {
      const backlog = this.backlog
      this.backlog = null
      if (backlog) for (const fn of backlog) fn()
    })
  }

  private attach(peer: Peer): void {
    peer.on('connection', (conn) => {
      if (peer === this.peer) this.accept(conn)
      else closeConnection(conn)
    })
    peer.on('open', () => {
      if (peer !== this.peer) return
      if (this.recycleSince) netLog('host', `signaling recycled in ${Math.round(now() - this.recycleSince)} ms`)
      this.recycleSince = 0
      this.quietDisconnect = false
      this.reconnectAttempts = 0
      this.reconnectStartedAt = 0
      this.setStatus('open')
    })
    peer.on('disconnected', () => {
      if (peer === this.peer) this.onSignalingLost('signaling-lost')
    })
    peer.on('close', () => {
      if (peer === this.peer) this.onSignalingLost('peer-destroyed')
    })
    peer.on('error', (err) => {
      if (peer !== this.peer) return
      netLog('host', `peer error ${err.type}`)
      // Someone else grabbed our id while our socket was down: keep retrying,
      // the server frees it once that socket goes away.
      if (err.type === 'unavailable-id') this.setStatus('reconnecting', 'id-taken')
    })
  }

  private onSignalingLost(detail: string): void {
    if (this.closed) return
    if (this.quietDisconnect) {
      // Our own recycle: straight back, the room stays 'open' unless it drags on (see tick).
      this.quietDisconnect = false
      this.scheduleReconnect(0)
      return
    }
    this.recycleSince = 0
    this.setStatus('reconnecting', this.statusDetail === 'id-taken' ? 'id-taken' : detail)
    this.scheduleReconnect()
  }

  private scheduleReconnect(delayMs?: number): void {
    if (this.closed || this.cancelReconnect) return
    const delays = NET_TIMING.hostReconnectDelaysMs
    const delay = delayMs ?? delays[Math.min(this.reconnectAttempts, delays.length - 1)]
    this.cancelReconnect = this.scope.timeout(() => {
      this.cancelReconnect = null
      this.reconnect()
    }, delay)
  }

  /**
   * Re-opens a signaling socket we have reason to doubt (same id + token). A
   * healthy socket costs one ~300 ms re-registration; a half-dead one — which
   * PeerJS keeps calling 'open' while offers from (re)joining players vanish —
   * gets replaced before those players give up.
   */
  private recycleSignaling(reason: string, delayMs = 0): void {
    if (this.closed) return
    if (delayMs > 0) {
      this.cancelDelayedRecycle ??= this.scope.timeout(() => {
        this.cancelDelayedRecycle = null
        this.recycleSignaling(reason)
      }, delayMs)
      return
    }
    const peer = this.peer
    // Not open → a regular reconnect is already under way.
    if (peer.destroyed || peer.disconnected || !peer.open || this.cancelReconnect) return
    const t = now()
    if (t - this.lastRecycleAt < NET_TIMING.recycleMinGapMs) return
    this.lastRecycleAt = t
    this.recycleSince = t
    this.quietDisconnect = true
    netLog('host', `recycle signaling (${reason})`)
    try {
      peer.disconnect()
    } catch {
      this.quietDisconnect = false
      this.recycleSince = 0
    }
  }

  private onVisibility(): void {
    if (typeof document === 'undefined') return
    const t = now()
    if (document.hidden) {
      if (!this.hiddenAt) this.hiddenAt = t
      return
    }
    const hiddenFor = this.hiddenAt ? t - this.hiddenAt : 0
    this.hiddenAt = 0
    this.reconnectNow()
    // A phone host back from another app: its socket may not have survived.
    if (hiddenFor >= NET_TIMING.recycleAfterHiddenMs) this.recycleSignaling('visible-again')
  }

  /**
   * The page is going away (closed, reloaded, navigated) or into the bfcache:
   * tell every client now, so they start reconnecting at once — a reload
   * reclaims this code within seconds, a closed tab ends as 'host-gone' — instead
   * of playing on for ~10 s against a host that isn't there. Best effort.
   */
  private onPageHide(): void {
    if (this.closed) return
    for (const hc of this.conns.values()) {
      if (hc.state === 'open') this.sendFrames(hc, [{ k: 'bye', r: 'away' }])
    }
  }

  /** Skip the backoff (tab visible again / back online). */
  private reconnectNow(): void {
    if (this.closed || this.status !== 'reconnecting' || !this.cancelReconnect) return
    this.cancelReconnect()
    this.cancelReconnect = null
    this.reconnect()
  }

  private reconnect(): void {
    if (this.closed) return
    this.reconnectAttempts++
    this.reconnectStartedAt = now()
    const peer = this.peer
    if (!peer.destroyed && peer.disconnected) {
      try {
        netLog('host', `signaling reconnect #${this.reconnectAttempts}`)
        peer.reconnect()
        return
      } catch {
        // Fall through and replace the Peer.
      }
    }
    if (!peer.destroyed && !peer.disconnected) return // already (re)connecting
    // The Peer is gone (its data channels died with it); register a fresh one
    // under the same id + token. Clients reconnect to it on their own.
    netLog('host', `recreate peer #${this.reconnectAttempts}`)
    destroyPeer(peer)
    const next = createPeer(this.mod, this.peerId, this.token)
    this.peer = next
    this.attach(next)
  }

  private accept(conn: DataConnection): void {
    if (this.closed || this.conns.size >= MAX_CONNECTIONS) {
      closeConnection(conn)
      return
    }
    const existing = this.conns.get(conn.connectionId)
    if (existing) this.finalize(existing, 'replaced')
    const hc: HostConn = {
      id: conn.connectionId,
      conn,
      remotePeer: conn.peer,
      state: 'pending',
      lastRx: now(),
      lastTx: now(),
      rx: new Reassembler(UPSTREAM_LIMITS),
      cancelTimer: () => {},
    }
    // A tab has one connect attempt in flight at a time: its older offers still
    // pending here were abandoned (a burst of them arrives when this tab thaws
    // after being frozen). Don't let them pile up to MAX_CONNECTIONS.
    for (const other of [...this.conns.values()]) {
      if (other.remotePeer === hc.remotePeer && other.state === 'pending') this.finalize(other, 'superseded-offer')
    }
    this.conns.set(hc.id, hc)
    hc.cancelTimer = this.scope.timeout(() => {
      if (hc.state === 'pending') this.finalize(hc, 'open-timeout')
    }, NET_TIMING.pendingOpenTimeoutMs)

    conn.on('open', () => {
      if (hc.state !== 'pending') return
      hc.cancelTimer()
      hc.state = 'open'
      hc.lastRx = hc.lastTx = now()
      // A tab keeps a single link to us: a new one means its previous link is
      // dead even if our heartbeat hasn't noticed yet. Retire it first so the
      // app sees disconnect(old) → connect(new).
      for (const other of [...this.conns.values()]) {
        if (other !== hc && other.remotePeer === hc.remotePeer && other.state !== 'closed') {
          this.finalize(other, 'superseded')
        }
      }
      netLog('host', `connect ${hc.id} from ${hc.remotePeer}`)
      this.deliver(() => this.connectL.emit(hc.id))
    })
    conn.on('data', (data) => this.onData(hc, data))
    conn.on('close', () => this.finalize(hc, 'close'))
    conn.on('error', (err) => {
      // Send-side hiccups are not fatal; negotiation failures are followed by close().
      if (err.type === 'not-open-yet' || err.type === 'message-too-big') return
      this.finalize(hc, `error:${err.type}`)
    })
  }

  private onData(hc: HostConn, data: unknown): void {
    if (hc.state === 'closed') return
    hc.lastRx = now()
    if (!isFrame(data)) return
    switch (data.k) {
      case 'm':
        this.onAppMessage(hc, data.m)
        break
      case 'c': {
        const done = hc.rx.push(data)
        if (!done) break
        // Client messages are tiny: a huge one is a broken or hostile peer.
        if ('overflow' in done) this.finalize(hc, 'oversize')
        else this.onAppMessage(hc, done.value)
        break
      }
      case 'bye':
        // 'away' too: the tab is closing or reloading. The game keeps an in-game
        // player's seat (and gives a lobby player a grace period), so a reload
        // re-attaches seamlessly, while a closed tab stops looking connected at once.
        this.finalize(hc, `bye:${data.r}`)
        break
      case 'hb':
        break
    }
  }

  private onAppMessage(hc: HostConn, msg: unknown): void {
    if (hc.state !== 'open' || !isClientMsg(msg)) return
    this.deliver(() => {
      if (hc.state === 'open') this.messageL.emit(hc.id, msg)
    })
  }

  private sendFrames(hc: HostConn, frames: Frame[]): void {
    if (!hc.conn.open) return
    try {
      for (const f of frames) void hc.conn.send(f)
      hc.lastTx = now()
    } catch {
      this.finalize(hc, 'send-failed')
    }
  }

  /** Ends a connection exactly once; onDisconnect only for channels that opened. */
  private finalize(hc: HostConn, reason: string): void {
    if (hc.state === 'closed') return
    const wasOpen = hc.state === 'open' || hc.state === 'dropping'
    hc.state = 'closed'
    hc.cancelTimer()
    hc.rx.clear()
    if (this.conns.get(hc.id) === hc) this.conns.delete(hc.id)
    closeConnection(hc.conn)
    netLog('host', `disconnect ${hc.id} (${reason})`)
    if (wasOpen) this.deliver(() => this.disconnectL.emit(hc.id))
  }

  private tick(): void {
    const t = now()
    // Timers were frozen (tab suspended, laptop asleep): don't declare everyone
    // dead on the first tick back, give the channels a fresh window instead.
    const suspended = t - this.lastTick > NET_TIMING.suspendGapMs
    this.lastTick = t
    let timedOut = 0
    let alive = 0
    for (const hc of [...this.conns.values()]) {
      if (hc.state !== 'open') continue
      if (suspended) {
        hc.lastRx = t
        continue
      }
      if (t - hc.lastRx > NET_TIMING.deadAfterMs) {
        this.finalize(hc, 'heartbeat-timeout')
        timedOut++
      } else {
        alive++
        if (t - hc.lastTx >= NET_TIMING.heartbeatMs) this.sendFrames(hc, [HEARTBEAT])
      }
    }
    // Our timers were frozen, or every client went silent at once: the problem is
    // probably on our side, and our signaling socket may be as dead as the links.
    // (One phone locking among several players is just that player.) A recycle
    // leaves the id unregistered for a moment, so it isn't done on a whim.
    // After a thaw, first let the socket deliver what queued up meanwhile (offers
    // from players reconnecting right now) in case it survived.
    if (suspended) this.recycleSignaling('thawed', NET_TIMING.recycleThawDelayMs)
    else if (timedOut && (!alive || timedOut > 1)) this.recycleSignaling('clients-timed-out')
    // A quiet recycle that doesn't come back quickly is a real outage: say so.
    if (this.recycleSince && t - this.recycleSince > NET_TIMING.recycleQuietMs && !this.peer.open) {
      this.recycleSince = 0
      this.quietDisconnect = false
      this.setStatus('reconnecting', 'signaling-lost')
      this.reconnectStartedAt ||= t
    }
    // Long-lived room: keep runtime TURN credentials fresh for players joining later.
    void prepareIceServers(0)
    // A reconnect that neither opened nor failed: abort it and try again.
    if (
      this.status === 'reconnecting' &&
      !this.cancelReconnect &&
      this.reconnectStartedAt &&
      t - this.reconnectStartedAt > NET_TIMING.attemptTimeoutMs
    ) {
      this.reconnectStartedAt = 0
      if (!this.peer.destroyed && !this.peer.disconnected) this.peer.disconnect()
      else this.scheduleReconnect()
    }
  }
}
