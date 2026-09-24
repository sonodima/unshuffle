// Probes TURN/STUN servers from Chrome: which ones hand out relay candidates.
import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage()
await page.goto(process.env.NET_LAB_URL ?? 'http://localhost:5205/lab/net.html')
const extra = process.argv[2] ? JSON.parse(process.argv[2]) : null
const servers = extra ?? [
  { urls: 'turn:eu-0.turn.peerjs.com:3478', username: 'peerjs', credential: 'peerjsp' },
  { urls: 'turn:us-0.turn.peerjs.com:3478', username: 'peerjs', credential: 'peerjsp' },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:global.relay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'stun:stun.l.google.com:19302' },
]
for (const s of servers) {
  const r = await page.evaluate(async (s) => {
    const pc = new RTCPeerConnection({ iceServers: [s], iceTransportPolicy: s.urls.startsWith('stun') ? 'all' : 'relay' })
    pc.createDataChannel('x')
    const cands = []
    const errors = []
    pc.onicecandidate = (e) => e.candidate && e.candidate.candidate && cands.push(e.candidate.candidate)
    pc.onicecandidateerror = (e) => errors.push(`${e.errorCode} ${e.errorText}`)
    const t = performance.now()
    await pc.setLocalDescription(await pc.createOffer())
    await new Promise((res) => { const iv = setInterval(() => { if (pc.iceGatheringState === 'complete' || performance.now() - t > 8000) { clearInterval(iv); res() } }, 50) })
    pc.close()
    return { ms: Math.round(performance.now() - t), cands: cands.map((c) => c.split(' ').slice(4, 8).join(' ')), errors: [...new Set(errors)] }
  }, s)
  console.log(s.urls, JSON.stringify(r))
}
await browser.close()
