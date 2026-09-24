// Transport timings (ms), tuned against the public PeerJS server (id
// registration ~150–500 ms, "peer-unavailable" for an unknown id ~200–450 ms,
// channel open ~250–700 ms).

export const NET_TIMING = {
  /** Keepalive frame when nothing else was sent for this long. */
  heartbeatMs: 2_000,
  /** A link is dead after this long without receiving ANY frame. */
  deadAfterMs: 10_000,
  /** Heartbeat / liveness check period. */
  tickMs: 1_000,
  /** A gap between ticks this large means our timers were frozen (suspended tab). */
  suspendGapMs: 4_000,
  /**
   * Client: after a hint that the path may have changed (network change, back
   * online, tab thawed), a link that stays silent this long is dead. The host
   * sends something at least every ~3 s, so this is well clear of a healthy link.
   */
  probeSilenceMs: 5_000,
  /** Client: ICE 'disconnected' for this long = the path is gone (the heartbeat is the backstop). */
  iceDisconnectedMs: 3_000,

  /** createHost() overall deadline. */
  createTimeoutMs: 15_000,
  /** How long a requested code is retried while the server still holds it. */
  reclaimWindowMs: 11_000,
  reclaimRetryMs: 1_500,
  /** One signaling registration (a WebSocket that can't open by then is blocked or black-holed). */
  registerTimeoutMs: 5_000,
  /** One connect attempt (registration + offer/answer + ICE). */
  attemptTimeoutMs: 8_000,
  /** Backoff between transient failures while creating / joining. */
  retryDelaysMs: [400, 1_000, 2_000, 3_000],
  /** Create / join give up on the signaling server after this many failures in a row… */
  maxSignalingFailures: 3,
  /** …or after this many registration timeouts (each one already waited registerTimeoutMs). */
  maxSignalingTimeouts: 2,

  /** joinRoom() overall deadline. */
  joinTimeoutMs: 12_000,
  /**
   * A connect attempt whose offer got no SDP answer by then is abandoned. A live
   * host answers within a few hundred ms; a host on a very slow link or with a
   * briefly frozen tab takes longer, so the next attempt waits answerRetryTimeoutMs.
   */
  answerTimeoutMs: 4_000,
  answerRetryTimeoutMs: 6_000,
  /** Reconnecting to a host whose id the server says doesn't exist (a reload in progress). */
  answerAbsentTimeoutMs: 3_000,

  /** Client auto-reconnect, fast phase: budget (visible time only) and backoff. */
  reconnectBudgetMs: 30_000,
  reconnectDelaysMs: [500, 1_000, 2_000, 3_000],
  /**
   * Then a slow phase (a phone host sharing the invite or taking a call comes
   * back on its own): one attempt every reconnectSlowDelayMs until the episode
   * has lasted reconnectHardCapMs of visible time (or reconnectWallCapMs overall).
   */
  reconnectSlowDelayMs: 5_000,
  reconnectHardCapMs: 180_000,
  reconnectWallCapMs: 20 * 60_000,
  /**
   * The signaling server keeps answering "no such peer" for the host's id for
   * this long → the host is gone for good (closed tab, left). A reloading host
   * reclaims its code within a few seconds (its old id is freed first: while the
   * server still holds it, offers go unanswered instead, which doesn't count).
   */
  hostGoneAfterMs: 10_000,

  /** Host signaling reconnect backoff (retried forever while the room is open). */
  hostReconnectDelaysMs: [300, 1_000, 2_000, 3_000, 5_000],
  /**
   * Host: re-open a signaling socket we have reason to doubt (a client timed out,
   * our timers were frozen, back online) at most this often. A recycle normally
   * takes ~300 ms and is silent; it shows 'reconnecting' only after recycleQuietMs.
   */
  recycleMinGapMs: 10_000,
  recycleQuietMs: 3_000,
  /** …after a thaw, once the socket had a moment to deliver what queued up meanwhile. */
  recycleThawDelayMs: 1_500,
  /** Host: a hidden tab this long may have lost its signaling socket (phone app switch). */
  recycleAfterHiddenMs: 20_000,

  /** Host: force-close a dropped connection if the client didn't close it itself. */
  dropForceMs: 1_000,
  /** Host: a data channel must open within this after the offer. */
  pendingOpenTimeoutMs: 20_000,
  /** Client: after a 'reject', close anyway if the host doesn't. */
  rejectCloseMs: 3_000,
  /** Grace for queued frames (bye / leave) before a Peer is destroyed. */
  flushMs: 200,

  /** Runtime TURN credentials (VITE_TURN_CREDENTIALS_URL): how long create / join wait for them. */
  turnFetchTimeoutMs: 2_500,
  /** …and how long fetched credentials are reused when the response has no ttl. */
  turnDefaultTtlMs: 60 * 60_000,
  /** Refresh them this long before they expire; retry a failed fetch after turnRetryMs. */
  turnRefreshMarginMs: 2 * 60_000,
  turnRetryMs: 30_000,
} as const
