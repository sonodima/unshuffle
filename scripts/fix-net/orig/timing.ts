// Transport timings (ms), tuned against the public PeerJS server (id
// registration ~150–500 ms, "peer-unavailable" for an unknown id ~200 ms,
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

  /** createHost() overall deadline. */
  createTimeoutMs: 15_000,
  /** How long a requested code is retried while the server still holds it. */
  reclaimWindowMs: 11_000,
  reclaimRetryMs: 1_500,
  /** One signaling registration / one connect attempt. */
  attemptTimeoutMs: 8_000,
  /** Backoff between transient failures while creating / joining. */
  retryDelaysMs: [400, 1_000, 2_000, 3_000],

  /** joinRoom() overall deadline. */
  joinTimeoutMs: 12_000,
  /** A connect attempt whose offer got no SDP answer by then is abandoned (host absent). */
  answerTimeoutMs: 3_000,
  /** Client auto-reconnect: total budget (visible time only) and backoff. */
  reconnectBudgetMs: 30_000,
  reconnectDelaysMs: [500, 1_000, 2_000, 3_000],
  /** Host signaling reconnect backoff (retried forever while the room is open). */
  hostReconnectDelaysMs: [300, 1_000, 2_000, 4_000, 8_000, 10_000],

  /** Host: force-close a dropped connection if the client didn't close it itself. */
  dropForceMs: 1_000,
  /** Host: a data channel must open within this after the offer. */
  pendingOpenTimeoutMs: 20_000,
  /** Client: after a 'reject', close anyway if the host doesn't. */
  rejectCloseMs: 3_000,
  /** Grace for queued frames (bye / leave) before a Peer is destroyed. */
  flushMs: 200,
} as const
