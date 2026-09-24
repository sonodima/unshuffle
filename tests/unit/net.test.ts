// Unit tests for the parts of the net layer that don't need a browser:
//   bun test tests/unit/net.test.ts
import { describe, expect, test } from 'bun:test'
import { DOWNSTREAM_LIMITS, Reassembler, UPSTREAM_LIMITS, encodeMessage } from '../../src/net/wire'
import { NET_MESSAGES, signalingError } from '../../src/net/errors'
import { getIceServers, parseTurnResponse, sanitizeIceServers } from '../../src/net/peer'
import { NET_TIMING } from '../../src/net/timing'
import { t } from '../../src/i18n'

function framesOf(msg: unknown) {
  let id = 0
  return encodeMessage(msg, () => ++id).map((f) => JSON.parse(JSON.stringify(f)))
}

function feed(rx: Reassembler, frames: ReturnType<typeof framesOf>) {
  const out = []
  for (const f of frames) if (f.k === 'c') out.push(rx.push(f))
  return out.filter(Boolean)
}

describe('Reassembler limits', () => {
  test('real client messages pass the upstream limits', () => {
    const rx = new Reassembler(UPSTREAM_LIMITS)
    // A 5000-number arrange is ~24 K chars.
    const order = Array.from({ length: 5000 }, (_, i) => i)
    const got = feed(rx, framesOf({ t: 'arrange', round: 1, order }))
    expect(got).toEqual([{ value: { t: 'arrange', round: 1, order } }])
  })

  test('an oversized client message overflows instead of being parsed', () => {
    const rx = new Reassembler(UPSTREAM_LIMITS)
    const frames = framesOf({ t: 'reaction', emoji: 'x'.repeat(200_000) })
    expect(frames.length).toBeGreaterThan(UPSTREAM_LIMITS.maxChunks)
    // The very first chunk already announces too many chunks.
    expect(rx.push(frames[0])).toEqual({ overflow: true })
  })

  test('char limit is enforced even when the chunk count is small', () => {
    const rx = new Reassembler({ maxChunks: 8, maxChars: 20_000 })
    const got = feed(rx, framesOf({ t: 'x', s: 'y'.repeat(30_000) }))
    expect(got).toEqual([{ overflow: true }])
  })

  test('host → client keeps the big limits', () => {
    const rx = new Reassembler(DOWNSTREAM_LIMITS)
    const s = 'z'.repeat(300_000)
    const got = feed(rx, framesOf({ t: 'state', s }))
    expect(got).toEqual([{ value: { t: 'state', s } }])
  })

  test('garbage chunk fields are ignored, not overflow', () => {
    const rx = new Reassembler(UPSTREAM_LIMITS)
    expect(rx.push({ k: 'c', id: 1, i: 0.5, n: 2, d: 'x' })).toBeUndefined()
    expect(rx.push({ k: 'c', id: 1, i: 0, n: 0, d: 'x' })).toBeUndefined()
    expect(rx.push({ k: 'c', id: 1, i: 0, n: 1, d: 5 as unknown as string })).toBeUndefined()
  })
})

describe('signalingError', () => {
  test('online: an unreachable server is the server, not "your internet"', () => {
    for (const type of ['network', 'socket-error', 'socket-closed', 'disconnected', 'timeout']) {
      const e = signalingError(type)
      expect(e.code).toBe('server')
      expect(e.message).toBe(NET_MESSAGES.signaling)
    }
  })
  test('a refusing server / unsupported browser keep their own messages', () => {
    expect(signalingError('server-error').message).toBe(NET_MESSAGES.server)
    expect(signalingError('browser-incompatible').code).toBe('unsupported')
  })
  test('offline wins', () => {
    const nav = globalThis.navigator as { onLine?: boolean } | undefined
    const desc = nav ? Object.getOwnPropertyDescriptor(Object.getPrototypeOf(nav), 'onLine') : undefined
    Object.defineProperty(globalThis.navigator, 'onLine', { configurable: true, get: () => false })
    try {
      expect(signalingError('network').code).toBe('network')
    } finally {
      delete (globalThis.navigator as { onLine?: boolean }).onLine
      if (desc) Object.defineProperty(Object.getPrototypeOf(nav), 'onLine', desc)
    }
  })
  test('messages are catalog keys with distinct texts', () => {
    expect(t(NET_MESSAGES.signaling).toLowerCase()).toContain('server di collegamento')
    expect(t(NET_MESSAGES.hostNoAnswer)).toContain('L’host non risponde')
    const texts = [NET_MESSAGES.signaling, NET_MESSAGES.joinTimeout, NET_MESSAGES.hostNoAnswer, NET_MESSAGES.roomNotFound].map((k) => t(k))
    expect(new Set(texts).size).toBe(4)
  })
})

describe('ICE config', () => {
  test('default: two independent STUN providers, nothing else', () => {
    const servers = getIceServers()
    expect(servers).toEqual([{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }])
  })

  test('TURN entries without credentials and non-ICE URLs are dropped, STUN survives', () => {
    const out = sanitizeIceServers([
      { urls: ['stun:stun.l.google.com:19302'] },
      { urls: ['tun:relay.example.com:3478'], username: 'u', credential: 'p' },
      { urls: ['turn:relay.example.com:3478'], username: '', credential: '' },
      { urls: ['turn:relay example.com:3478'], username: 'u', credential: 'p' },
      { urls: 'turn:ok.example.com:80?transport=tcp', username: 'u', credential: 'p' },
    ])
    expect(out).toEqual([
      { urls: ['stun:stun.l.google.com:19302'] },
      { urls: ['turn:ok.example.com:80?transport=tcp'], username: 'u', credential: 'p' },
    ])
  })

  test('memoized per list', () => {
    const list = [{ urls: 'stun:a.example.com:3478' }]
    expect(sanitizeIceServers(list)).toBe(sanitizeIceServers([{ urls: 'stun:a.example.com:3478' }]))
  })
})

describe('parseTurnResponse', () => {
  const turn = { urls: ['turn:h:80', 'turn:h:80?transport=tcp', 'turns:h:443?transport=tcp'], username: 'u', credential: 'c' }

  test('Metered: plain RTCIceServer[] (string urls too)', () => {
    const r = parseTurnResponse([{ urls: 'stun:stun.relay.metered.ca:80' }, { urls: 'turn:global.relay.metered.ca:80', username: 'u', credential: 'c' }])
    expect(r.servers).toEqual([
      { urls: ['stun:stun.relay.metered.ca:80'] },
      { urls: ['turn:global.relay.metered.ca:80'], username: 'u', credential: 'c' },
    ])
    expect(r.ttlMs).toBeNull()
  })

  test('Cloudflare: {iceServers: {...}} object', () => {
    expect(parseTurnResponse({ iceServers: turn }).servers).toEqual([turn])
  })

  test('Twilio: {ice_servers: [{url, urls}], ttl: "86400"}', () => {
    const r = parseTurnResponse({ ttl: '86400', ice_servers: [{ url: 'turn:h:3478?transport=udp', urls: 'turn:h:3478?transport=udp', username: 'u', credential: 'c' }] })
    expect(r.servers).toEqual([{ urls: ['turn:h:3478?transport=udp'], username: 'u', credential: 'c' }])
    expect(r.ttlMs).toBe(86_400_000)
  })

  test('Xirsys: {v: {iceServers: {...}}}', () => {
    expect(parseTurnResponse({ s: 'ok', v: { iceServers: turn } }).servers).toEqual([turn])
  })

  test('TURN REST API: {username, password, ttl, uris}', () => {
    const r = parseTurnResponse({ username: '1790:x', password: 'pw', ttl: 3600, uris: ['turn:1.2.3.4:3478?transport=udp'] })
    expect(r.servers).toEqual([{ urls: ['turn:1.2.3.4:3478?transport=udp'], username: '1790:x', credential: 'pw' }])
    expect(r.ttlMs).toBe(3_600_000)
  })

  test('expiresAt (epoch seconds) wins when sooner', () => {
    const at = Math.floor(Date.now() / 1000) + 600
    const r = parseTurnResponse({ iceServers: [turn], ttl: 86400, expiresAt: at })
    expect(r.ttlMs).toBeGreaterThan(590_000)
    expect(r.ttlMs).toBeLessThanOrEqual(600_000)
  })

  test('garbage → nothing usable', () => {
    for (const j of [null, 'x', 42, {}, { iceServers: 'nope' }, [{ urls: ['http://x'] }], [{ urls: 'turn:h:80' }]]) {
      expect(parseTurnResponse(j).servers).toEqual([])
    }
  })
})

describe('timing sanity', () => {
  test('host-gone decision comes well after a reload but before the old 30 s', () => {
    expect(NET_TIMING.hostGoneAfterMs).toBeGreaterThanOrEqual(8_000)
    expect(NET_TIMING.hostGoneAfterMs).toBeLessThan(NET_TIMING.reconnectBudgetMs)
  })
  test('slow reconnect phase outlasts a phone host switching apps', () => {
    expect(NET_TIMING.reconnectHardCapMs).toBeGreaterThanOrEqual(120_000)
    expect(NET_TIMING.reconnectSlowDelayMs).toBeLessThanOrEqual(NET_TIMING.reconnectHardCapMs / 10)
  })
  test('a probe waits longer than the host ever stays silent', () => {
    // host tick 1 s + heartbeat every 2 s → at most ~3 s between frames
    expect(NET_TIMING.probeSilenceMs).toBeGreaterThan(NET_TIMING.heartbeatMs + NET_TIMING.tickMs + 1_000)
  })
  test('join deadline leaves room for a slow host: 1st answer wait + 2nd answer wait', () => {
    expect(NET_TIMING.answerTimeoutMs + NET_TIMING.answerRetryTimeoutMs).toBeLessThanOrEqual(NET_TIMING.joinTimeoutMs)
  })
})
