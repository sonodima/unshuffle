// QA (network): probes free/public STUN + TURN servers from headless Chrome.
//
//  1. gather  — one RTCPeerConnection, iceTransportPolicy 'relay' (or 'all' for STUN),
//               ONLY that server configured: which candidate types / relay protocols
//               come back, icecandidateerror codes, time to first relay candidate.
//  2. connect — two RTCPeerConnections (in-page signaling), BOTH relay-only through
//               that server: data channel open time, 20 ping-pong RTTs, and a burst of
//               40 × 15 KB messages (ordered, reliable = what PeerJS JSON uses).
//
// Usage: node scripts/qa-network/turn-probe.mjs [--only=substr] [--no-connect]
// Output: table on stdout + scripts/qa-network/turn-probe.json
import { chromium } from 'playwright'
import { createHmac } from 'node:crypto'
import { writeFileSync } from 'node:fs'

const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7)
const NO_CONNECT = process.argv.includes('--no-connect')
const BASE = process.env.BASE ?? 'http://127.0.0.1:5306/lab/net.html'

// coturn "TURN REST API" credentials (use-auth-secret): username = expiry[:user], password = b64(HMAC-SHA1(secret, username)).
function restCreds(secret, ttlS = 3600, user = 'unshuffle') {
  const username = `${Math.floor(Date.now() / 1000) + ttlS}:${user}`
  const credential = createHmac('sha1', secret).update(username).digest('base64')
  return { username, credential }
}

async function elixirCreds() {
  try {
    const r = await fetch('https://turn.elixir-webrtc.org/?service=turn&username=unshuffleqa', { method: 'POST', signal: AbortSignal.timeout(8000) })
    const j = await r.json()
    return { username: j.username, credential: j.password ?? j.credential, uris: j.uris }
  } catch (e) {
    return { error: String(e) }
  }
}

const OR = { username: 'openrelayproject', credential: 'openrelayproject' }
const SA = restCreds('openrelayprojectsecret')
const FREE = { username: 'free', credential: 'free' }
const elixir = await elixirCreds()
console.log('elixir creds:', JSON.stringify(elixir).slice(0, 200))

/** [label, iceServer, policy] */
const CANDIDATES = [
  // STUN (policy all, expect srflx)
  ['stun google 19302', { urls: 'stun:stun.l.google.com:19302' }, 'all'],
  ['stun cloudflare 3478', { urls: 'stun:stun.cloudflare.com:3478' }, 'all'],
  ['stun twilio 3478', { urls: 'stun:global.stun.twilio.com:3478' }, 'all'],
  ['stun openrelay 80', { urls: 'stun:openrelay.metered.ca:80' }, 'all'],
  ['stun freestun 3478', { urls: 'stun:freestun.net:3478' }, 'all'],
  // Open Relay (Metered) static creds
  ['openrelay udp:80', { urls: 'turn:openrelay.metered.ca:80', ...OR }, 'relay'],
  ['openrelay udp:443', { urls: 'turn:openrelay.metered.ca:443', ...OR }, 'relay'],
  ['openrelay tcp:80', { urls: 'turn:openrelay.metered.ca:80?transport=tcp', ...OR }, 'relay'],
  ['openrelay tcp:443', { urls: 'turn:openrelay.metered.ca:443?transport=tcp', ...OR }, 'relay'],
  ['openrelay tls:443', { urls: 'turns:openrelay.metered.ca:443?transport=tcp', ...OR }, 'relay'],
  // Open Relay "staticauth" (coturn REST secret published by Metered for Nextcloud Talk)
  ['staticauth udp:80', { urls: 'turn:staticauth.openrelay.metered.ca:80', ...SA }, 'relay'],
  ['staticauth udp:3478', { urls: 'turn:staticauth.openrelay.metered.ca:3478', ...SA }, 'relay'],
  ['staticauth tcp:80', { urls: 'turn:staticauth.openrelay.metered.ca:80?transport=tcp', ...SA }, 'relay'],
  ['staticauth tcp:443', { urls: 'turn:staticauth.openrelay.metered.ca:443?transport=tcp', ...SA }, 'relay'],
  ['staticauth tls:443', { urls: 'turns:staticauth.openrelay.metered.ca:443?transport=tcp', ...SA }, 'relay'],
  // Metered global relay with the public creds (needs account creds, expected to fail)
  ['metered-global udp:80 (public creds)', { urls: 'turn:global.relay.metered.ca:80', ...OR }, 'relay'],
  ['metered-global tls:443 (public creds)', { urls: 'turns:global.relay.metered.ca:443?transport=tcp', ...OR }, 'relay'],
  // freestun.net / freeturn.net
  ['freestun udp:3478', { urls: 'turn:freestun.net:3478', ...FREE }, 'relay'],
  ['freestun tcp:3478', { urls: 'turn:freestun.net:3478?transport=tcp', ...FREE }, 'relay'],
  ['freestun tls:5350', { urls: 'turns:freestun.net:5350', ...FREE }, 'relay'],
  ['freeturn udp:3478', { urls: 'turn:freeturn.net:3478', ...FREE }, 'relay'],
  ['freeturn tls:5349', { urls: 'turns:freeturn.net:5349', ...FREE }, 'relay'],
  // Dead PeerJS defaults (baseline) + old gist entries
  ['peerjs eu-0 udp:3478', { urls: 'turn:eu-0.turn.peerjs.com:3478', username: 'peerjs', credential: 'peerjsp' }, 'relay'],
  ['anyfirewall tcp:443', { urls: 'turn:turn.anyfirewall.com:443?transport=tcp', username: 'webrtc', credential: 'webrtc' }, 'relay'],
  ['gist 192.158.29.39 udp', { urls: 'turn:192.158.29.39:3478?transport=udp', username: '28224511:1379330808', credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=' }, 'relay'],
  // Elixir WebRTC public test deployment (dev only per its README)
  ...(elixir.username
    ? [['elixir-webrtc udp:3478 (dev only)', { urls: 'turn:turn.elixir-webrtc.org:3478?transport=udp', username: elixir.username, credential: elixir.credential }, 'relay']]
    : []),
].filter(([label]) => !ONLY || label.includes(ONLY))

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage()
await page.goto(BASE)

async function gather(server, policy) {
  return page.evaluate(
    async ({ server, policy }) => {
      const pc = new RTCPeerConnection({ iceServers: [server], iceTransportPolicy: policy })
      pc.createDataChannel('x')
      const cands = []
      const errors = []
      const t = performance.now()
      let firstRelay = null
      pc.onicecandidate = (e) => {
        const c = e.candidate
        if (!c || !c.candidate) return
        if (c.type === 'relay' && firstRelay === null) firstRelay = Math.round(performance.now() - t)
        cands.push({ type: c.type, protocol: c.protocol, relayProtocol: c.relayProtocol ?? null, address: c.address, port: c.port })
      }
      pc.onicecandidateerror = (e) => errors.push(`${e.errorCode} ${e.errorText}`.trim())
      await pc.setLocalDescription(await pc.createOffer())
      await new Promise((res) => {
        const iv = setInterval(() => {
          if (pc.iceGatheringState === 'complete' || performance.now() - t > 12000) {
            clearInterval(iv)
            res()
          }
        }, 50)
      })
      const ms = Math.round(performance.now() - t)
      pc.close()
      return { ms, firstRelay, cands, errors: [...new Set(errors)] }
    },
    { server, policy },
  )
}

async function connect(server) {
  return page.evaluate(async (server) => {
    const cfg = { iceServers: [server], iceTransportPolicy: 'relay' }
    const a = new RTCPeerConnection(cfg)
    const b = new RTCPeerConnection(cfg)
    a.onicecandidate = (e) => e.candidate && b.addIceCandidate(e.candidate).catch(() => {})
    b.onicecandidate = (e) => e.candidate && a.addIceCandidate(e.candidate).catch(() => {})
    const t0 = performance.now()
    const dcA = a.createDataChannel('game', { ordered: true })
    const dcBp = new Promise((res) => (b.ondatachannel = (e) => res(e.channel)))
    const opened = new Promise((res, rej) => {
      dcA.onopen = () => res(Math.round(performance.now() - t0))
      setTimeout(() => rej(new Error('dc open timeout 20s')), 20000)
      a.oniceconnectionstatechange = () => a.iceConnectionState === 'failed' && rej(new Error('ice failed'))
    })
    await a.setLocalDescription(await a.createOffer())
    await b.setRemoteDescription(a.localDescription)
    await b.setLocalDescription(await b.createAnswer())
    await a.setRemoteDescription(b.localDescription)
    let openMs
    try {
      openMs = await opened
    } catch (e) {
      a.close()
      b.close()
      return { ok: false, error: e.message }
    }
    const dcB = await dcBp
    // Echo server on B
    dcB.onmessage = (e) => dcB.send(e.data)
    // RTT
    const rtts = []
    for (let i = 0; i < 20; i++) {
      const s = performance.now()
      await new Promise((res) => {
        dcA.onmessage = () => res()
        dcA.send(`p${i}`)
      })
      rtts.push(performance.now() - s)
    }
    // Burst of 40 x 15 KB echoed back
    const payload = 'x'.repeat(15000)
    const bs = performance.now()
    await new Promise((res) => {
      let n = 0
      dcA.onmessage = () => ++n === 40 && res()
      for (let i = 0; i < 40; i++) dcA.send(payload)
    })
    const burstMs = Math.round(performance.now() - bs)
    // Which path?
    const stats = await a.getStats()
    let path = null
    stats.forEach((r) => {
      if (r.type === 'candidate-pair' && r.nominated && r.state === 'succeeded') {
        const l = stats.get(r.localCandidateId)
        const rm = stats.get(r.remoteCandidateId)
        path = `${l?.candidateType}/${l?.relayProtocol ?? l?.protocol} ${l?.address}:${l?.port} ↔ ${rm?.candidateType} ${rm?.address}:${rm?.port}`
      }
    })
    const sctpMax = a.sctp?.maxMessageSize ?? null
    a.close()
    b.close()
    rtts.sort((x, y) => x - y)
    return {
      ok: true,
      openMs,
      rttMedian: Math.round(rtts[10]),
      rttMax: Math.round(rtts[19]),
      burst40x15kBms: burstMs,
      path,
      sctpMaxMessageSize: sctpMax,
    }
  }, server)
}

const results = []
for (const [label, server, policy] of CANDIDATES) {
  const g = await gather(server, policy)
  const types = [...new Set(g.cands.map((c) => (c.type === 'relay' ? `relay(${c.relayProtocol})` : c.type)))]
  const relays = g.cands.filter((c) => c.type === 'relay')
  const row = { label, server: { ...server, credential: server.credential ? '***' : undefined }, policy, gather: { ms: g.ms, firstRelayMs: g.firstRelay, types, relayAddrs: [...new Set(relays.map((c) => `${c.address}`))], errors: g.errors } }
  if (policy === 'relay' && relays.length && !NO_CONNECT) row.connect = await connect(server)
  results.push(row)
  const c = row.connect
  console.log(
    `${label.padEnd(40)} gather ${String(g.ms).padStart(5)}ms firstRelay=${g.firstRelay ?? '-'} types=[${types.join(',')}] err=[${g.errors.join('; ').slice(0, 90)}]` +
      (c ? (c.ok ? ` | CONNECT open=${c.openMs}ms rtt=${c.rttMedian}/${c.rttMax}ms burst=${c.burst40x15kBms}ms path=${c.path}` : ` | CONNECT FAIL ${c.error}`) : ''),
  )
}
writeFileSync(new URL('./turn-probe.json', import.meta.url), JSON.stringify({ at: new Date().toISOString(), results }, null, 2))
await browser.close()
