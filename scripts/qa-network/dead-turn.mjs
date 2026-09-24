// QA (network): does an unreachable TURN entry in iceServers slow down normal joins?
import { chromium } from 'playwright'
const URL = 'http://127.0.0.1:5306/lab/net.html'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
async function page() {
  const p = await (await browser.newContext()).newPage()
  await p.goto(URL)
  await p.waitForFunction(() => !!window.netLab)
  return p
}
for (const [label, ice] of [
  ['default (STUN only)', null],
  ['+ blackholed TURN udp/tcp/tls', [{ urls: ['stun:stun.l.google.com:19302'] }, { urls: ['turn:192.0.2.1:3478', 'turn:192.0.2.1:3478?transport=tcp', 'turns:192.0.2.1:443?transport=tcp'], username: 'u', credential: 'p' }]],
]) {
  const h = await page(); const c = await page()
  for (const p of [h, c]) await p.evaluate((ice) => window.netLab.setIce(ice), ice)
  const hr = await h.evaluate(() => window.netLab.createHost())
  const times = []
  for (let i = 0; i < 3; i++) {
    const t = Date.now()
    const r = await c.evaluate((code) => window.netLab.joinRoom(code), hr.code)
    times.push(r.ok ? Date.now() - t : `fail ${r.code}`)
    await c.evaluate(() => window.netLab.clientClose())
    await new Promise((r) => setTimeout(r, 500))
  }
  console.log(label.padEnd(32), 'join ms:', times.join(' / '))
  await h.context().close(); await c.context().close()
}
await browser.close()
