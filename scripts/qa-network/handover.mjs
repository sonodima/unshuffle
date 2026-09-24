// QA (network): simulates a phone switching Wi-Fi → 4G mid-game. At t=0 the client's
// data channel goes silent (freezeLink) AND its PeerJS signaling WebSocket turns into a
// black hole (still "open" for the browser, nothing gets through either way) — the usual
// state right after a network handover. Measures how long the transport needs to be
// back ('open'), and which recovery path it took.
//   node scripts/qa-network/handover.mjs
import { chromium } from 'playwright'

const URL = process.env.NET_LAB_URL ?? 'http://127.0.0.1:5306/lab/net.html'
const browser = await chromium.launch({ channel: 'chrome', headless: true })

async function page(label, blackholeable) {
  const ctx = await browser.newContext()
  const p = await ctx.newPage()
  const sockets = []
  if (blackholeable) {
    await p.routeWebSocket(/0\.peerjs\.com/, (ws) => {
      const server = ws.connectToServer()
      const entry = { dead: false }
      sockets.push(entry)
      ws.onMessage((m) => {
        if (!entry.dead) server.send(m)
      })
      server.onMessage((m) => {
        if (!entry.dead) ws.send(m)
      })
    })
  }
  p.on('pageerror', (e) => console.log(`[${label}] pageerror`, e.message))
  await p.goto(URL)
  await p.waitForFunction(() => !!window.netLab)
  return { p, sockets }
}

const h = await page('host', false)
const c = await page('client', true)
const hr = await h.p.evaluate(() => window.netLab.createHost())
const jr = await c.p.evaluate((code) => window.netLab.joinRoom(code), hr.code)
console.log('joined', JSON.stringify(jr), 'client sockets', c.sockets.length)
await c.p.waitForTimeout(2000)

const t0 = await c.p.evaluate(() => Date.now())
for (const s of c.sockets) s.dead = true
await c.p.evaluate(() => window.netLab.freezeLink())
const opened = await c.p.waitForFunction(
  (t0) => window.netLab.events.find((e) => e.wall > t0 && e.kind === 'client:status' && e.data?.s === 'open') ?? null,
  t0,
  { timeout: 60_000, polling: 100 },
).then((hnd) => hnd.jsonValue()).catch(() => null)
const statuses = await c.p.evaluate((t0) => window.netLab.events.filter((e) => e.wall > t0 && e.kind === 'client:status').map((e) => `+${e.wall - t0}ms ${e.data.s}${e.data.d ? ` (${e.data.d})` : ''}`), t0)
console.log('client statuses:', statuses.join(' | '))
console.log(opened ? `recovered after ${opened.wall - t0} ms` : 'NOT recovered within 60 s')
const log = await c.p.evaluate((t0) => window.netLab.log().filter((e) => e.at > t0).map((e) => `+${e.at - t0}ms ${e.msg}`), t0)
console.log(log.join('\n'))
console.log('client WebSockets opened in total:', c.sockets.length)
await browser.close()
