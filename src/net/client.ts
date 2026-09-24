// Client side of the transport: one reliable JSON data channel to the host,
// heartbeats both ways, and automatic reconnection (same PeerJS id + token, so
// the host can tell a reconnecting tab from a new one).
//
// Reconnection, once the link is lost:
// - fast phase: attempts after 0.5 / 1 / 2 / 3 s… for ~30 s of visible time;
// - slow phase: one attempt every ~5 s up to 3 min of visible time, so a phone
//   host that switched apps (sharing the invite, a call) is picked up again;
// - ends early with 'host-gone' when the signaling server keeps saying the host's
//   id doesn't exist for longer than a reload takes (tab closed / host left).
// Dead links are noticed by the 10 s heartbeat, sooner on hints: ICE
// 'disconnected' / 'failed', a network change, a thawed tab, a lost signaling
// socket (each arms a short "prove you're alive" probe), or the host's 'away'
// goodbye when its page goes away.

import { PEER_PREFIX } from '../game/constants'
import { isHostMsg } from './protocol'
import type { ClientMsg, HostMsg } from './protocol'
import { NetError, NET_MESSAGES, isTransientPeerError, netErrorFromPeer, signalingError } from './errors'
import { closeConnection, destroyPeer, openPeer, prepareIceServers, waitForOpen } from './peer'
import type { DataConnection, OpenResult, Peer, PeerModule } from './peer'
import { Listeners, Scope, netLog, netStats, now, race, randomToken, reportListenerError } from './runtime'
import { NET_TIMING } from './timing'
import { DOWNSTREAM_LIMITS, HEARTBEAT, Reassembler, encodeMessage, isFrame } from './wire'
import type { ByeReason, Frame } from './wire'
import type { ClientCloseDetail, ClientConnection, ConnStatus } from './transport'

interface Link {
  readonly conn: DataConnection
  lastRx: number
  lastTx: number
  readonly rx: Reassembler
  /** Debug: behave like a silently dead network path. */
  frozen: boolean
  /** Something hinted the path may be gone: dead unless a frame arrives within probeSilenceMs. */
  probeSince: number
  /** Pending "ICE still disconnected?" check. */
  cancelIce: (() => void) | null
  /** We sent the host our 'away' goodbye (page hidden for good, or into the bfcache). */
  saidAway: boolean
}

/** 'signaling' = registering on the signaling server failed (no host involved yet). */
type Stage = 'signaling' | 'connect'
type AttemptFailure = { ok: false; type: string; stage: Stage }
type AttemptResult = { ok: true; conn: DataConnection } | AttemptFailure

/** Losses after which our signaling socket probably rides the same dead path. */
const SUSPECT_PATH = new Set(['heartbeat-timeout', 'probe-timeout', 'ice-disconnected', 'ice-failed'])

const newClientId = (): string => `${PEER_PREFIX}p-${randomToken(14)}`
const isSoftChannelError = (type: string): boolean => type === 'not-open-yet' || type === 'message-too-big'
const isOffline = (): boolean => typeof navigator !== 'undefined' && navigator.onLine === false
const isHidden = (): boolean => typeof document !== 'undefined' && document.hidden

/** Network Information API (Chrome / Android): 'change' on network switches. */
function networkInfo(): EventTarget | undefined {
  if (typeof navigator === 'undefined') return undefined
  const c = (navigator as Navigator & { connection?: unknown }).connection
  return c && typeof (c as EventTarget).addEventListener === 'function' ? (c as EventTarget) : undefined
}

export async function connectClient(mod: PeerModule, code: string): Promise<ClientConnectionImpl> {
  const client = new ClientConnectionImpl(mod, code)
  try {
    await client.start()
  } catch (err) {
    client.close()
    throw err
  }
  return client
}

export class ClientConnectionImpl implements ClientConnection {
  readonly code: string
  private readonly mod: PeerModule
  private readonly hostId: string
  private myId = newClientId()
  private token = randomToken()
  private peer: Peer | null = null
  private link: Link | null = null
  private readonly scope = new Scope()
  private readonly abort = new AbortController()
  private readonly messageL = new Listeners<[HostMsg]>()
  private readonly statusL = new Listeners<[ConnStatus, string | undefined]>()
  private status: ConnStatus = 'connecting'
  private statusDetail: string | undefined
  /** Messages received before the app subscribed to onMessage; flushed once it does. */
  private backlog: HostMsg[] | null = []
  private done = false
  private rejected = false
  private reconnecting = false
  private chunkSeq = 0
  private lastTick = now()
  /** Hidden-time bookkeeping: reconnect budgets count visible time only. */
  private hiddenAt = 0
  private hiddenTotal = 0
  private signalingRetries = 0
  private cancelSignalingRetry: (() => void) | null = null
  /** Debug: links left open on purpose by debugAbandon(); closed on teardown. */
  private abandoned: DataConnection[] = []

  constructor(mod: PeerModule, code: string) {
    this.mod = mod
    this.code = code
    this.hostId = PEER_PREFIX + code
    netStats.clients++
    if (isHidden()) this.hiddenAt = now()
    const win = typeof window === 'undefined' ? undefined : window
    this.scope.interval(() => this.tick(), NET_TIMING.tickMs)
    this.scope.listen(win, 'online', () => this.onPathHint('online', true))
    // Fires on network switches, but on desktop also on mere bandwidth estimates: probe only, no wake.
    this.scope.listen(networkInfo(), 'change', () => this.onPathHint('network-change', false))
    this.scope.listen(typeof document === 'undefined' ? undefined : document, 'visibilitychange', () =>
      this.onVisibility(),
    )
    this.scope.listen(win, 'pagehide', () => this.onPageHide())
    this.scope.listen(win, 'pageshow', (e) => this.onPageShow(e))
  }

  // ---- public API ----

  send(msg: ClientMsg): void {
    const link = this.link
    if (this.done || this.status !== 'open' || !link) return
    this.sendFrames(link, encodeMessage(msg, () => ++this.chunkSeq))
  }

  onMessage(cb: (msg: HostMsg) => void): () => void {
    const off = this.messageL.add(cb)
    if (this.backlog) {
      queueMicrotask(() => {
        const backlog = this.backlog
        this.backlog = null
        if (backlog) for (const msg of backlog) this.messageL.emit(msg)
      })
    }
    return off
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

  /** Leaves silently: no status events after this, no reconnection. */
  close(): void {
    if (this.done) return
    this.done = true
    this.status = 'closed'
    this.statusDetail = 'closed-by-app'
    netLog('client', `close ${this.code}`)
    this.messageL.clear()
    this.statusL.clear()
    this.teardown('leave')
  }

  // ---- debug hooks (netDebug) ----

  debugBreak(): boolean {
    if (!this.link) return false
    this.link.conn.close()
    return true
  }

  debugFreeze(): boolean {
    if (!this.link) return false
    this.link.frozen = true
    return true
  }

  /** Reconnect while leaving the old channel open (host must supersede it). */
  debugAbandon(): boolean {
    const link = this.link
    if (!link || this.done) return false
    link.conn.removeAllListeners()
    link.cancelIce?.()
    this.abandoned.push(link.conn)
    this.link = null
    void this.reconnectLoop('debug-abandon')
    return true
  }

  debugDropSignaling(): boolean {
    const peer = this.peer
    if (!peer || peer.destroyed || peer.disconnected) return false
    peer.disconnect()
    return true
  }

  debugPeerId(): string {
    return this.myId
  }

  // ---- connection lifecycle ----

  /** First connection: resolves when the channel is open, rejects with a NetError. */
  async start(): Promise<void> {
    const deadline = now() + NET_TIMING.joinTimeoutMs
    let backoffIndex = 0
    let signalingFailures = 0
    let signalingTimeouts = 0
    let unanswered = 0
    let last: AttemptFailure | null = null
    for (;;) {
      const remaining = deadline - now()
      if (remaining <= 0) throw joinError(last)
      const answerMs = unanswered ? NET_TIMING.answerRetryTimeoutMs : NET_TIMING.answerTimeoutMs
      const r = await this.attempt(remaining, answerMs)
      if (r.ok) {
        this.adopt(r.conn)
        this.setStatus('open')
        return
      }
      last = r
      netLog('client', `join attempt failed: ${r.stage}/${r.type}`)
      if (r.type === 'aborted') throw new NetError('unknown', NET_MESSAGES.unknown)
      if (r.type === 'browser-incompatible') throw new NetError('unsupported', NET_MESSAGES.unsupported)
      if (isOffline()) throw new NetError('network', NET_MESSAGES.network)

      if (r.stage === 'signaling') {
        // A random id collision (ensurePeer already picked another id): go again.
        if (r.type !== 'unavailable-id' && !isTransientPeerError(r.type)) throw signalingError(r.type)
        signalingFailures++
        if (r.type === 'timeout') signalingTimeouts++
        if (
          signalingFailures >= NET_TIMING.maxSignalingFailures ||
          signalingTimeouts >= NET_TIMING.maxSignalingTimeouts
        ) {
          throw signalingError(r.type)
        }
      } else {
        signalingFailures = 0
        signalingTimeouts = 0
        // Only the server's explicit "no such peer" means the room doesn't exist.
        if (r.type === 'peer-unavailable') throw new NetError('room-not-found', NET_MESSAGES.roomNotFound)
        if (r.type === 'no-answer') {
          // The public server answers "peer-unavailable" to only every other
          // offer for the same unknown id (the rest go unanswered), and a host
          // on a very slow link (or with a briefly frozen tab) answers late:
          // one more offer, waiting longer for the answer.
          if (++unanswered >= 2 || deadline - now() < 1_500) throw new NetError('timeout', NET_MESSAGES.hostNoAnswer)
          continue
        }
        // The host answered but no data path opened in time (NAT / firewall).
        if (r.type === 'timeout') throw new NetError('timeout', NET_MESSAGES.joinTimeout)
      }
      const backoff = NET_TIMING.retryDelaysMs[Math.min(backoffIndex++, NET_TIMING.retryDelaysMs.length - 1)]
      if (now() + backoff + 500 >= deadline) throw joinError(r)
      await this.scope.sleep(backoff)
    }
  }

  /** One try: make sure signaling is up, then open a data channel to the host. */
  private async attempt(timeoutMs: number, answerMs: number): Promise<AttemptResult> {
    const deadline = now() + timeoutMs
    const opened = await this.ensurePeer(Math.min(timeoutMs, NET_TIMING.registerTimeoutMs))
    if (!opened.ok) return { ok: false, type: opened.type, stage: opened.type === 'aborted' ? 'connect' : 'signaling' }
    if (this.done) return { ok: false, type: 'aborted', stage: 'connect' }
    const remaining = deadline - now()
    if (remaining <= 0) return { ok: false, type: 'timeout', stage: 'connect' }
    const peer = opened.peer

    let conn: DataConnection | undefined
    try {
      conn = peer.connect(this.hostId, { reliable: true, serialization: 'json' })
    } catch {
      conn = undefined
    }
    if (!conn) return { ok: false, type: 'network', stage: 'connect' }
    const c = conn
    const result = await race<AttemptResult>(
      {
        timeoutMs: remaining,
        onTimeout: { ok: false, type: 'timeout', stage: 'connect' },
        signal: this.abort.signal,
        onAbort: { ok: false, type: 'aborted', stage: 'connect' },
      },
      (settle) => {
        // A live host answers the SDP offer within a few hundred ms, long
        // before ICE completes; no answer at all means nobody is there.
        const answered = (): boolean => !!c.peerConnection?.remoteDescription
        const answerTimer = setTimeout(() => {
          if (!answered()) settle({ ok: false, type: 'no-answer', stage: 'connect' })
        }, Math.min(answerMs, remaining))
        netStats.timers++
        const onOpen = (): void => settle({ ok: true, conn: c })
        const onConnError = (err: { type: string }): void => {
          if (!isSoftChannelError(err.type)) settle({ ok: false, type: 'channel-failed', stage: 'connect' })
        }
        const onConnClose = (): void => settle({ ok: false, type: 'channel-failed', stage: 'connect' })
        const onPeerError = (err: { type: string }): void => {
          // "Unknown id" from the signaling server. Once the host has answered
          // this offer it can only be a late reply to an earlier attempt.
          if (err.type === 'peer-unavailable' && !answered()) {
            settle({ ok: false, type: 'peer-unavailable', stage: 'connect' })
          }
        }
        const onPeerGone = (): void => settle({ ok: false, type: 'network', stage: 'signaling' })
        c.on('open', onOpen)
        c.on('error', onConnError)
        c.on('close', onConnClose)
        peer.on('error', onPeerError)
        peer.on('disconnected', onPeerGone)
        peer.on('close', onPeerGone)
        return () => {
          clearTimeout(answerTimer)
          netStats.timers--
          c.off('open', onOpen)
          c.off('error', onConnError)
          c.off('close', onConnClose)
          peer.off('error', onPeerError)
          peer.off('disconnected', onPeerGone)
          peer.off('close', onPeerGone)
        }
      },
    )
    if (!result.ok || this.done) {
      closeConnection(c)
      return result.ok ? { ok: false, type: 'aborted', stage: 'connect' } : result
    }
    return result
  }

  /** A Peer registered on the signaling server, reusing ours when possible. */
  private async ensurePeer(timeoutMs: number): Promise<OpenResult> {
    const current = this.peer
    if (current && !current.destroyed) {
      if (current.open) return { ok: true, peer: current }
      if (current.disconnected && !this.link) {
        // Nothing alive on it: a fresh Peer (same id + token) is the most reliable path.
        this.dropPeer()
      } else {
        if (current.disconnected) {
          try {
            current.reconnect()
          } catch {
            this.dropPeer()
          }
        }
        if (this.peer === current) {
          const r = await waitForOpen(current, timeoutMs, this.abort.signal)
          if (!r.ok && this.peer === current && !this.link) this.dropPeer()
          return r
        }
      }
    } else if (current) {
      this.dropPeer()
    }

    const r = await openPeer(this.mod, this.myId, this.token, timeoutMs, this.abort.signal)
    if (!r.ok) {
      if (r.type === 'unavailable-id') this.renewIdentity()
      return r
    }
    if (this.done) {
      destroyPeer(r.peer)
      return { ok: false, type: 'aborted' }
    }
    this.peer = r.peer
    this.attachPeer(r.peer)
    return r
  }

  private attachPeer(peer: Peer): void {
    peer.on('connection', (c) => closeConnection(c))
    peer.on('open', () => {
      if (peer === this.peer) this.signalingRetries = 0
    })
    peer.on('disconnected', () => this.onSignalingLost(peer))
    peer.on('close', () => {
      if (peer === this.peer) this.dropPeer()
    })
    peer.on('error', (err) => netLog('client', `peer error ${err.type}`))
  }

  /**
   * Signaling dropped while the data channel is fine: the channel keeps
   * working, but reconnect the socket in the background so a later
   * reconnection to the host doesn't have to wait for it. A dropped socket is
   * also a hint that the network changed under us: make the link prove it's alive.
   */
  private onSignalingLost(peer: Peer): void {
    if (this.done || peer !== this.peer || !this.link || this.cancelSignalingRetry) return
    this.probe(this.link, 'signaling-lost')
    const delays = [1_000, 2_000, 5_000, 10_000, 20_000]
    const delay = delays[Math.min(this.signalingRetries, delays.length - 1)]
    this.cancelSignalingRetry = this.scope.timeout(() => {
      this.cancelSignalingRetry = null
      if (this.done || peer !== this.peer || peer.destroyed || !peer.disconnected || !this.link) return
      this.signalingRetries++
      try {
        peer.reconnect()
      } catch {
        // Replaced on the next host reconnection.
      }
    }, delay)
  }

  private dropPeer(): void {
    const peer = this.peer
    this.peer = null
    this.cancelSignalingRetry?.()
    this.cancelSignalingRetry = null
    destroyPeer(peer)
  }

  private renewIdentity(): void {
    this.dropPeer()
    this.myId = newClientId()
    this.token = randomToken()
  }

  private adopt(conn: DataConnection): void {
    const t = now()
    const link: Link = {
      conn,
      lastRx: t,
      lastTx: t,
      rx: new Reassembler(DOWNSTREAM_LIMITS),
      frozen: false,
      probeSince: 0,
      cancelIce: null,
      saidAway: false,
    }
    this.link = link
    conn.on('data', (data) => this.onData(link, data))
    conn.on('close', () => this.onLinkLost(link, 'link-closed'))
    conn.on('error', (err) => {
      if (!isSoftChannelError(err.type)) this.onLinkLost(link, `link-error:${err.type}`)
    })
    conn.on('iceStateChanged', (state) => this.onIceState(link, state))
    netLog('client', `connected to ${this.code} as ${this.myId}`)
  }

  private onData(link: Link, data: unknown): void {
    if (this.done || link !== this.link || link.frozen) return
    link.lastRx = now()
    if (!isFrame(data)) return
    switch (data.k) {
      case 'm':
        this.onAppMessage(data.m)
        break
      case 'c': {
        const done = link.rx.push(data)
        if (done && 'value' in done) this.onAppMessage(done.value)
        break
      }
      case 'bye':
        if (this.rejected) this.finish('rejected')
        // The host's page is going away (closed, reloading): reconnect now; a
        // reloading host reclaims its code, a closed one ends as 'host-gone'.
        else if (data.r === 'away') this.onLinkLost(link, 'host-away')
        else this.finish(data.r === 'closed' ? 'host-closed' : 'dropped')
        break
      case 'hb':
        break
    }
  }

  private onAppMessage(msg: unknown): void {
    if (this.done || !isHostMsg(msg)) return
    if (msg.t === 'reject' && !this.rejected) {
      this.rejected = true
      this.scope.timeout(() => this.finish('rejected'), NET_TIMING.rejectCloseMs)
    }
    if (!this.backlog) return this.messageL.emit(msg)
    this.backlog.push(msg)
    if (this.backlog.length > 500) this.backlog.shift()
  }

  /** ICE 'failed' ends the link now; 'disconnected' only if it doesn't recover quickly. */
  private onIceState(link: Link, state: RTCIceConnectionState): void {
    if (this.done || link !== this.link) return
    if (state === 'disconnected') {
      if (link.cancelIce) return
      link.cancelIce = this.scope.timeout(() => {
        link.cancelIce = null
        if (link === this.link && link.conn.peerConnection?.iceConnectionState === 'disconnected') {
          this.onLinkLost(link, 'ice-disconnected')
        }
      }, NET_TIMING.iceDisconnectedMs)
      return
    }
    link.cancelIce?.()
    link.cancelIce = null
    if (state === 'failed') this.onLinkLost(link, 'ice-failed')
  }

  private onLinkLost(link: Link, reason: string): void {
    if (link !== this.link) return
    this.link = null
    link.cancelIce?.()
    link.cancelIce = null
    link.rx.clear()
    closeConnection(link.conn)
    if (this.done) return
    netLog('client', `link lost (${reason})`)
    if (this.rejected) {
      this.finish('rejected')
      return
    }
    void this.reconnectLoop(reason)
  }

  /** The link must show a sign of life within probeSilenceMs (see tick). */
  private probe(link: Link, reason: string): void {
    if (link.frozen || link !== this.link) return
    if (!link.probeSince) {
      link.probeSince = now()
      netLog('client', `probing the link (${reason})`)
    }
    // Our own frame gets the host's side of the path exercised too.
    this.sendFrames(link, [HEARTBEAT])
  }

  /** Back online / network switched / tab thawed: test the link, optionally skip any reconnect backoff. */
  private onPathHint(reason: string, wake: boolean): void {
    if (this.done) return
    if (wake) this.scope.wake()
    if (this.link) this.probe(this.link, reason)
  }

  private onVisibility(): void {
    if (this.done || typeof document === 'undefined') return
    const t = now()
    if (document.hidden) {
      if (!this.hiddenAt) this.hiddenAt = t
      return
    }
    const hiddenFor = this.hiddenAt ? t - this.hiddenAt : 0
    if (this.hiddenAt) {
      this.hiddenTotal += hiddenFor
      this.hiddenAt = 0
    }
    this.scope.wake()
    // After a long spell in the background the path may be gone without us being told.
    if (hiddenFor >= NET_TIMING.deadAfterMs) this.onPathHint('visible-again', false)
  }

  /**
   * The page is going away (closed, reloaded, navigated) — or into the
   * back/forward cache. Tell the host now, so it doesn't wait ~10 s of silence
   * to notice (a lobby player who closed the tab must not look connected).
   * Best effort: the browser may not flush it.
   */
  private onPageHide(): void {
    const link = this.link
    if (this.done || !link || link.frozen || !link.conn.open) return
    link.saidAway = true
    try {
      void link.conn.send({ k: 'bye', r: 'away' } satisfies Frame)
    } catch {
      // Unloading anyway.
    }
  }

  /** Back from the bfcache after saying goodbye: that link is dead to the host. */
  private onPageShow(e: Event): void {
    if (this.done || !(e as PageTransitionEvent).persisted) return
    const link = this.link
    if (link?.saidAway) this.onLinkLost(link, 'page-restored')
    else this.onPathHint('page-restored', true)
  }

  /** Visible time elapsed since `since` (hidden time doesn't use up reconnect budgets). */
  private visibleSince(since: number): number {
    const t = now()
    const hidden = this.hiddenTotal + (this.hiddenAt ? t - Math.max(this.hiddenAt, since) : 0)
    return t - since - hidden
  }

  private async reconnectLoop(reason: string): Promise<void> {
    if (this.reconnecting || this.done) return
    this.reconnecting = true
    this.setStatus('reconnecting', reason)
    const startedAt = now()
    this.hiddenTotal = 0
    this.hiddenAt = isHidden() ? startedAt : 0
    // The signaling socket usually rode the same path that just died: re-register
    // (same id + token, ~300 ms) instead of offering into a half-dead socket.
    if (SUSPECT_PATH.has(reason)) this.dropPeer()
    void prepareIceServers(0)
    const delays = NET_TIMING.reconnectDelaysMs
    let attempts = 0
    let unanswered = 0
    /** First 'peer-unavailable' of the current streak, and how many in a row. */
    let absentSince = 0
    let absentCount = 0
    let detail: ClientCloseDetail = 'gave-up'
    try {
      while (!this.done) {
        const visible = this.visibleSince(startedAt)
        if (visible >= NET_TIMING.reconnectHardCapMs || now() - startedAt >= NET_TIMING.reconnectWallCapMs) break
        let delay: number =
          visible < NET_TIMING.reconnectBudgetMs
            ? delays[Math.min(attempts, delays.length - 1)]
            : NET_TIMING.reconnectSlowDelayMs
        // Take the deciding "is the host still gone?" sample right when it can decide.
        if (absentSince) delay = Math.min(delay, Math.max(250, absentSince + NET_TIMING.hostGoneAfterMs - now()))
        if (!(await this.scope.sleep(delay)) || this.done) return
        attempts++
        // In a "no such peer" streak an unanswered offer is most likely the server
        // skipping its reply (see below), not a slow host: don't wait long for it.
        const answerMs = absentSince
          ? NET_TIMING.answerAbsentTimeoutMs
          : unanswered
            ? NET_TIMING.answerRetryTimeoutMs
            : NET_TIMING.answerTimeoutMs
        const r = await this.attempt(NET_TIMING.attemptTimeoutMs, answerMs)
        if (this.done) {
          if (r.ok) closeConnection(r.conn)
          return
        }
        if (r.ok) {
          this.adopt(r.conn)
          netLog('client', `reconnected after ${attempts} attempt(s), ${Math.round(now() - startedAt)} ms`)
          this.setStatus('open', 'reconnected')
          return
        }
        netLog('client', `reconnect attempt ${attempts} failed: ${r.stage}/${r.type}`)
        if (r.type === 'browser-incompatible') break
        // Our own signaling / network trouble says nothing about the host.
        if (r.stage === 'signaling') continue

        // The public server answers only every other offer to an id it doesn't
        // know (the others just go unanswered), so 'no-answer' neither extends
        // nor breaks a "no such peer" streak; an answered offer does break it.
        if (r.type === 'peer-unavailable') {
          const t = now()
          if (!absentSince) absentSince = t
          absentCount++
          if (absentCount >= 2 && t - absentSince >= NET_TIMING.hostGoneAfterMs) {
            detail = 'host-gone'
            break
          }
        } else if (r.type !== 'no-answer') {
          absentSince = 0
          absentCount = 0
        }
        if (r.type === 'no-answer') {
          // Offers keep vanishing: our signaling socket may be half-dead even
          // though PeerJS thinks it's open. Re-register (same id + token) right
          // away, then every few misses (a suspended host doesn't answer either).
          unanswered++
          if (unanswered === 1 || unanswered % 3 === 0) this.dropPeer()
        } else {
          unanswered = 0
        }
      }
      if (!this.done) this.finish(detail)
    } finally {
      this.reconnecting = false
    }
  }

  // ---- plumbing ----

  private setStatus(status: ConnStatus, detail?: string): void {
    if (this.done || (status === this.status && detail === this.statusDetail)) return
    this.status = status
    this.statusDetail = detail
    netLog('client', `status ${status}${detail ? ` (${detail})` : ''}`)
    this.statusL.emit(status, detail)
  }

  private sendFrames(link: Link, frames: Frame[]): void {
    if (link.frozen || !link.conn.open) return
    try {
      for (const f of frames) void link.conn.send(f)
      link.lastTx = now()
    } catch {
      this.onLinkLost(link, 'send-failed')
    }
  }

  private tick(): void {
    const t = now()
    const suspended = t - this.lastTick > NET_TIMING.suspendGapMs
    this.lastTick = t
    const link = this.link
    if (!link) return
    if (suspended) {
      // Our timers were frozen: don't call the link dead for the silence we
      // slept through, but make it prove it's alive soon.
      link.lastRx = t
      this.onPathHint('thawed', true)
      return
    }
    if (link.probeSince) {
      if (link.lastRx > link.probeSince) link.probeSince = 0
      else if (t - link.probeSince > NET_TIMING.probeSilenceMs) return this.onLinkLost(link, 'probe-timeout')
    }
    if (t - link.lastRx > NET_TIMING.deadAfterMs) this.onLinkLost(link, 'heartbeat-timeout')
    else if (t - link.lastTx >= NET_TIMING.heartbeatMs) this.sendFrames(link, [HEARTBEAT])
  }

  /** Terminal 'closed' (host closed / rejected / gave up). */
  private finish(detail: ClientCloseDetail): void {
    if (this.done) return
    this.done = true
    this.status = 'closed'
    this.statusDetail = detail
    netLog('client', `closed (${detail})`)
    this.teardown()
    this.statusL.emit('closed', detail)
    this.messageL.clear()
    this.statusL.clear()
  }

  private teardown(bye?: ByeReason): void {
    this.abort.abort()
    this.scope.dispose()
    this.backlog = null
    netStats.clients--
    const link = this.link
    const peer = this.peer
    this.link = null
    this.peer = null
    this.cancelSignalingRetry = null
    for (const c of this.abandoned.splice(0)) closeConnection(c)
    if (!link) {
      destroyPeer(peer)
      return
    }
    link.conn.removeAllListeners()
    if (bye && link.conn.open) {
      try {
        void link.conn.send({ k: 'bye', r: bye } satisfies Frame)
      } catch {
        // Channel already failing; the host's heartbeat will notice.
      }
    }
    // Give queued frames (the app's 'leave', our 'bye') a moment to flush.
    netStats.timers++
    setTimeout(() => {
      netStats.timers--
      closeConnection(link.conn)
      destroyPeer(peer)
    }, NET_TIMING.flushMs)
  }
}

/** The NetError for a join that ran out of time / tries, by where it last failed. */
function joinError(last: AttemptFailure | null): NetError {
  if (!last) return new NetError('timeout', NET_MESSAGES.joinTimeout)
  if (isOffline()) return new NetError('network', NET_MESSAGES.network)
  if (last.stage === 'signaling') return signalingError(last.type)
  if (last.type === 'no-answer') return new NetError('timeout', NET_MESSAGES.hostNoAnswer)
  if (last.type === 'channel-failed' || last.type === 'timeout' || last.type === 'network') {
    return new NetError('timeout', NET_MESSAGES.joinTimeout)
  }
  return netErrorFromPeer(last.type, NET_MESSAGES.joinTimeout)
}
