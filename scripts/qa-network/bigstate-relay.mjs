// QA (network): a large RoomState (lab bigState ≈ final screen with 10 rounds of results) through a
// relay-only TURN path: chunk count, delivery time, integrity. Also a 20/s burst of it.
import { chromium } from 'playwright'
const URL = process.env.NET_LAB_URL ?? 'http://127.0.0.1:5306/lab/net.html'
const j = await (await fetch('https://turn.elixir-webrtc.org/?service=turn&username=qa', { method: 'POST' })).json()
const turn = [{ urls: 'turn:turn.elixir-webrtc.org:3478?transport=udp', username: j.username, credential: j.password }]
const browser = await chromium.launch({ channel: 'chrome', headless: true })
async function page() {
  const ctx = await browser.newContext()
  await ctx.addInitScript(() => {
    window.__frames = { n: 0, max: 0 }
    const send = RTCDataChannel.prototype.send
    RTCDataChannel.prototype.send = function (d) { const n = d?.byteLength ?? d?.length ?? 0; window.__frames.n++; if (n > window.__frames.max) window.__frames.max = n; return send.call(this, d) }
  })
  const p = await ctx.newPage()
  await p.goto(URL)
  await p.waitForFunction(() => !!window.netLab)
  return p
}
const h = await page(); const c = await page()
for (const p of [h, c]) await p.evaluate((t) => { window.netLab.setIce(t); window.netLab.forceRelay(true) }, turn)
const hr = await h.evaluate(() => window.netLab.createHost())
const jr = await c.evaluate((code) => window.netLab.joinRoom(code), hr.code)
console.log('join relay-only', JSON.stringify(jr), 'paths', JSON.stringify(await c.evaluate(() => window.netLab.icePaths())))
await c.waitForTimeout(500)
const count = () => c.evaluate(() => window.netLab.events.filter((e) => e.kind === 'client:message' && e.data?.t === 'state').length)
const before = await count()
const f0 = await h.evaluate(() => ({ ...window.__frames }))
const t0 = Date.now()
const chars = await h.evaluate(() => window.netLab.hostBroadcastBig())
await c.waitForFunction((b) => window.netLab.events.filter((e) => e.kind === 'client:message' && e.data?.t === 'state').length > b, before, { timeout: 30000, polling: 20 })
const t1 = Date.now()
const f1 = await h.evaluate(() => ({ ...window.__frames }))
const ok = await c.evaluate(() => { const m = window.netLab.events.filter((e) => e.kind === 'client:message' && e.data?.t === 'state').pop().data; return { tracks: m.state.tracks.length, results: m.state.results.length, title: m.state.tracks[3].title } })
console.log(`one big state: ${chars} JSON chars → ${f1.n - f0.n} frames (max ${f1.max} B), delivered in ${t1 - t0} ms, integrity ${JSON.stringify(ok)}`)
// 20 per second for 3 s
const b2 = await count()
const t2 = Date.now()
await h.evaluate(async () => { for (let i = 0; i < 60; i++) { window.netLab.hostBroadcastBig(); await new Promise((r) => setTimeout(r, 50)) } })
await c.waitForFunction((b) => window.netLab.events.filter((e) => e.kind === 'client:message' && e.data?.t === 'state').length >= b + 60, b2, { timeout: 60000, polling: 50 }).catch(() => null)
console.log(`60 big states at 20/s: received ${(await count()) - b2}/60, last one ${Date.now() - t2} ms after the first send (sending took ~3000 ms)`)
console.log('client status', JSON.stringify(await c.evaluate(() => window.netLab.status())))
await browser.close()
