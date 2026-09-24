// QA (network): what a malformed TURN config (e.g. a typo in VITE_TURN_URLS) does to the
// real transport. The client uses the bad config, the host the defaults.
import { chromium } from 'playwright'
const URL = 'http://127.0.0.1:5306/lab/net.html'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
async function page() {
  const p = await (await browser.newContext()).newPage()
  await p.goto(URL)
  await p.waitForFunction(() => !!window.netLab)
  return p
}
const h = await page()
const hr = await h.evaluate(() => window.netLab.createHost())
const cases = {
  typoScheme: [{ urls: ['stun:stun.l.google.com:19302'] }, { urls: ['tun:relay.example.com:3478'], username: 'u', credential: 'p' }],
  spaceInHost: [{ urls: ['turn:relay example.com:3478'], username: 'u', credential: 'p' }],
  tlsTransportParam: [{ urls: ['turns:relay.example.com:443?transport=tls'], username: 'u', credential: 'p' }],
  emptyCreds: [{ urls: ['turn:relay.example.com:3478'], username: '', credential: '' }],
}
for (const [name, ice] of Object.entries(cases)) {
  const c = await page()
  const ctor = await c.evaluate((ice) => { try { new RTCPeerConnection({ iceServers: ice }).close(); return 'ok' } catch (e) { return `${e.name}: ${e.message}` } }, ice)
  await c.evaluate((ice) => window.netLab.setIce(ice), ice)
  const t = Date.now()
  const r = await c.evaluate((code) => window.netLab.joinRoom(code), hr.code)
  const log = await c.evaluate(() => window.netLab.log().map((e) => e.msg))
  console.log(name.padEnd(18), '| new RTCPeerConnection →', ctor, '| join →', JSON.stringify(r), `${Date.now() - t}ms`, '| log:', log.slice(0, 4).join(' / '))
  await c.evaluate(() => window.netLab.clientClose())
  await c.context().close()
}
await browser.close()
