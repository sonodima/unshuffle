// fix-net: runtime TURN credentials end to end. The credentials endpoint is
// mocked in the browser with a REAL short-lived credential (TURN REST shape,
// from the elixir-webrtc dev relay, test use only), both peers are forced to
// relay-only, and a full host/guest exchange must go through the relay.
//   node scripts/fix-net/turn-relay.mjs
import { chromium } from 'playwright'
const URL = process.env.NET_LAB_URL ?? 'http://127.0.0.1:5460/lab/fix-net.html'
const creds = await (await fetch('https://turn.elixir-webrtc.org/?service=turn&username=fixnet', { method: 'POST' })).json()
console.log('credential shape:', Object.keys(creds).join(','), 'ttl', creds.ttl)
const browser = await chromium.launch({ channel: 'chrome', headless: true })
async function page(label) {
  const p = await (await browser.newContext()).newPage()
  p.on('console', (m) => (m.type() === 'warning' || m.type() === 'error') && console.log(`[${label}] ${m.type()}: ${m.text().slice(0, 160)}`))
  await p.route('https://turn.fixnet.test/**', (route) =>
    route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify(creds) }),
  )
  await p.goto(URL)
  await p.waitForFunction(() => !!window.netLab)
  await p.evaluate(async () => {
    window.netLab.setTurnUrl('https://turn.fixnet.test/credentials')
    await window.netLab.prepareIce(2500)
    window.netLab.forceRelay(true)
  })
  return p
}
const h = await page('host')
const c = await page('client')
console.log('client ICE servers:', JSON.stringify(await c.evaluate(() => window.netLab.iceServers())))
const r = await h.evaluate(() => window.netLab.createHost())
const j = await c.evaluate((code) => window.netLab.joinRoom(code), r.code)
console.log('create', JSON.stringify(r), 'join', JSON.stringify(j))
let ok = j.ok
if (j.ok) {
  const n0 = await c.evaluate(() => window.netLab.events.length)
  await c.evaluate(() => window.netLab.clientSend({ t: 'ping', c: 7 }))
  await c.waitForFunction((n0) => window.netLab.events.slice(n0).some((e) => e.kind === 'client:message' && e.data.t === 'pong'), n0, { timeout: 8000 })
  await h.evaluate(() => window.netLab.hostBroadcastBig())
  await c.waitForFunction((n0) => window.netLab.events.slice(n0).some((e) => e.kind === 'client:message' && e.data.t === 'state'), n0, { timeout: 8000 })
  const paths = await c.evaluate(() => window.netLab.icePaths())
  console.log('ICE paths:', paths.join(' | '))
  ok = paths.length > 0 && paths.every((p) => p.startsWith('relay'))
}
console.log(ok ? 'PASS relay-only game traffic via runtime TURN credentials' : 'FAIL')
await browser.close()
process.exit(ok ? 0 : 1)
