// QA (network): Chrome with --webrtc-ip-handling-policy=disable_non_proxied_udp (WebRTC may
// not use UDP unless proxied = what a UDP-blocking corporate/school/hotel network looks like).
// Host + client in the same browser; default ICE config (Google STUN, no TURN).
import { chromium } from 'playwright'
const URL = 'http://127.0.0.1:5306/lab/net.html'
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--webrtc-ip-handling-policy=disable_non_proxied_udp'] })
async function page() {
  const p = await (await browser.newContext()).newPage()
  await p.goto(URL)
  await p.waitForFunction(() => !!window.netLab)
  return p
}
const h = await page()
const c = await page()
const hr = await h.evaluate(() => window.netLab.createHost())
const t = Date.now()
const r = await c.evaluate((code) => window.netLab.joinRoom(code), hr.code)
console.log('UDP blocked, STUN only → join', JSON.stringify(r), `${Date.now() - t} ms`)
const cands = await c.evaluate(async () => {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
  pc.createDataChannel('x')
  const out = []
  pc.onicecandidate = (e) => e.candidate?.candidate && out.push(`${e.candidate.type}/${e.candidate.protocol}`)
  await pc.setLocalDescription(await pc.createOffer())
  await new Promise((r) => setTimeout(r, 3000))
  pc.close()
  return out
})
console.log('candidates gathered with UDP blocked:', JSON.stringify(cands))
await browser.close()
