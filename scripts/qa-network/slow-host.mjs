// QA (network): host on a very slow mobile link — every signaling WebSocket message to/from the host
// is delayed by D ms each way (EDGE / congested 3G). The client gives up on an offer without SDP answer
// after answerTimeoutMs = 3 s and reports "Stanza non trovata" after two of them.
//   node scripts/qa-network/slow-host.mjs <delayMs...>
import { chromium } from 'playwright'
const URL = process.env.NET_LAB_URL ?? 'http://127.0.0.1:5306/lab/net.html'
const delays = process.argv.slice(2).map(Number)
const browser = await chromium.launch({ channel: 'chrome', headless: true })
for (const D of delays.length ? delays : [600, 1200, 1600]) {
  const hctx = await browser.newContext()
  const h = await hctx.newPage()
  await h.routeWebSocket(/0\.peerjs\.com/, (ws) => {
    const server = ws.connectToServer()
    ws.onMessage((m) => setTimeout(() => server.send(m), D))
    server.onMessage((m) => setTimeout(() => ws.send(m), D))
  })
  await h.goto(URL)
  await h.waitForFunction(() => !!window.netLab)
  const hr = await h.evaluate(() => window.netLab.createHost())
  const cctx = await browser.newContext()
  const c = await cctx.newPage()
  await c.goto(URL)
  await c.waitForFunction(() => !!window.netLab)
  const r = await c.evaluate((code) => window.netLab.joinRoom(code), hr.code)
  const log = await c.evaluate(() => window.netLab.log().map((e) => e.msg).filter((m) => m.includes('attempt') || m.includes('connected')))
  console.log(`host WS delay ${D} ms each way: host create ${hr.ms} ms; join → ${JSON.stringify({ ok: r.ok, code: r.code, message: r.message, ms: r.ms })} | ${log.join(' / ')}`)
  await hctx.close(); await cctx.close()
}
await browser.close()
