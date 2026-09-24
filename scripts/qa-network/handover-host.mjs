// QA (network): the HOST's signaling socket goes half-dead (browser still thinks it is open,
// nothing gets through) while its data channel to a client dies at the same time — a host
// phone whose Wi-Fi degrades / hands over. Does the room recover?
import { chromium } from 'playwright'
const URL = process.env.NET_LAB_URL ?? 'http://127.0.0.1:5306/lab/net.html'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
async function page(label, blackholeable) {
  const p = await (await browser.newContext()).newPage()
  const sockets = []
  if (blackholeable) {
    await p.routeWebSocket(/0\.peerjs\.com/, (ws) => {
      const server = ws.connectToServer()
      const entry = { dead: false }
      sockets.push(entry)
      ws.onMessage((m) => { if (!entry.dead) server.send(m) })
      server.onMessage((m) => { if (!entry.dead) ws.send(m) })
      server.onClose(() => { if (!entry.dead) ws.close() }) // a dead path never delivers the server's FIN
    })
  }
  await p.goto(URL)
  await p.waitForFunction(() => !!window.netLab)
  return { p, sockets }
}
const h = await page('host', true)
const c = await page('client', false)
const hr = await h.p.evaluate(() => window.netLab.createHost())
await c.p.evaluate((code) => window.netLab.joinRoom(code), hr.code)
await c.p.waitForTimeout(2000)
const t0 = Date.now()
for (const s of h.sockets) s.dead = true
await c.p.evaluate(() => window.netLab.freezeLink()) // the host↔client path dies
const res = await c.p.waitForFunction(
  (t0) => window.netLab.events.find((e) => e.wall > t0 && e.kind === 'client:status' && (e.data?.s === 'open' || e.data?.s === 'closed')) ?? null,
  t0, { timeout: 120_000, polling: 200 },
).then((x) => x.jsonValue()).catch(() => null)
console.log('client outcome:', res ? `${res.data.s} (${res.data.d}) after ${res.wall - t0} ms` : 'none in 120 s')
console.log('client log:\n' + (await c.p.evaluate((t0) => window.netLab.log().filter((e) => e.at > t0).map((e) => `  +${e.at - t0}ms ${e.msg}`).join('\n'), t0)))
console.log('host status now:', JSON.stringify(await h.p.evaluate(() => window.netLab.status())))
console.log('host log:\n' + (await h.p.evaluate((t0) => window.netLab.log().filter((e) => e.at > t0).map((e) => `  +${e.at - t0}ms ${e.msg}`).join('\n'), t0)))
await browser.close()
