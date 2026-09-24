// vite.config.ts → headTags: the preconnect origin of the signaling server must be the
// one src/net/peer.ts actually connects to (same parsing rules, same fallbacks).
//   bun test tests/unit/head-tags.test.ts
import { describe, expect, test } from 'bun:test'
import { signalingOrigin } from '../../vite.config.ts'

describe('signalingOrigin', () => {
  test('defaults to the public PeerJS cloud', () => {
    expect(signalingOrigin({})).toBe('https://0.peerjs.com')
    expect(signalingOrigin({ VITE_PEERJS_HOST: '   ' })).toBe('https://0.peerjs.com')
  })

  test('a bare host is secure on 443 unless told otherwise', () => {
    expect(signalingOrigin({ VITE_PEERJS_HOST: 'peer.example.com' })).toBe('https://peer.example.com')
    expect(signalingOrigin({ VITE_PEERJS_HOST: 'peer.example.com', VITE_PEERJS_PORT: '9000' })).toBe('https://peer.example.com:9000')
    expect(signalingOrigin({ VITE_PEERJS_HOST: 'peer.example.com', VITE_PEERJS_SECURE: 'false' })).toBe('http://peer.example.com:443')
    expect(signalingOrigin({ VITE_PEERJS_HOST: 'peer.example.com', VITE_PEERJS_SECURE: 'false', VITE_PEERJS_PORT: '80' })).toBe(
      'http://peer.example.com',
    )
  })

  test('a full URL sets scheme and port', () => {
    expect(signalingOrigin({ VITE_PEERJS_HOST: 'wss://peer.example.com:9000/app' })).toBe('https://peer.example.com:9000')
    expect(signalingOrigin({ VITE_PEERJS_HOST: 'ws://10.0.0.5:9000' })).toBe('http://10.0.0.5:9000')
    expect(signalingOrigin({ VITE_PEERJS_HOST: 'https://peer.example.com' })).toBe('https://peer.example.com')
    // An explicit port variable wins over the URL's, as in peer.ts.
    expect(signalingOrigin({ VITE_PEERJS_HOST: 'wss://peer.example.com:9000', VITE_PEERJS_PORT: '9443' })).toBe(
      'https://peer.example.com:9443',
    )
  })

  test('an invalid port is ignored, an invalid host falls back to the cloud', () => {
    expect(signalingOrigin({ VITE_PEERJS_HOST: 'peer.example.com', VITE_PEERJS_PORT: 'abc' })).toBe('https://peer.example.com')
    expect(signalingOrigin({ VITE_PEERJS_HOST: 'not a host' })).toBe('https://0.peerjs.com')
  })

  test("'/' (the page's own host) needs no preconnect", () => {
    expect(signalingOrigin({ VITE_PEERJS_HOST: '/' })).toBeNull()
    expect(signalingOrigin({ VITE_PEERJS_HOST: '/', VITE_PEERJS_PORT: '9000' })).toBeNull()
  })

  test('IPv6 literals keep their brackets', () => {
    expect(signalingOrigin({ VITE_PEERJS_HOST: 'wss://[::1]:9000' })).toBe('https://[::1]:9000')
  })
})
