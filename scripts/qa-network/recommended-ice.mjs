// QA (network): the recommended ICE list shape — STUN (Google + Cloudflare) + a working TURN (elixir dev
// relay, stand-in for a real provider) + unreachable TCP/TLS fallbacks — through the real transport,
// relay forced on both sides (= two CGNAT phones). 3 joins each.
import { chromium } from 'playwright'
const URL = process.env.NET_LAB_URL ?? 'http://127.0.0.1:5306/lab/net.html'
const j = await (await fetch('https://turn.elixir-webrtc.org/?service=turn&username=qa', { method: 'POST' })).json()
const ice = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
  { urls: ['turn:turn.elixir-webrtc.org:3478?transport=udp'], username: j.username, credential: j.password },
  { urls: ['turn:192.0.2.1:80?transport=tcp', 'turns:192.0.2.1:443?transport=tcp'], username: 'u', credential: 'p' },
]
const browser = await chromium.launch({ channel: 'chrome', headless: true })
async function page() { const p = await (await browser.newContext()).newPage(); await p.goto(URL); await p.waitForFunction(() => !!window.netLab); return p }
for (const relay of [true, false]) {
  const h = await page(); const c = await page()
  for (const p of [h, c]) await p.evaluate(({ ice, relay }) => { window.netLab.setIce(ice); window.netLab.forceRelay(relay) }, { ice, relay })
  const hr = await h.evaluate(() => window.netLab.createHost())
  const out = []
  for (let i = 0; i < 3; i++) {
    const t = Date.now()
    const r = await c.evaluate((code) => window.netLab.joinRoom(code), hr.code)
    out.push(r.ok ? `${Date.now() - t}ms ${(await c.evaluate(() => window.netLab.icePaths())).slice(-1)[0]}` : `FAIL ${r.code}`)
    await c.evaluate(() => window.netLab.clientClose())
    await c.waitForTimeout(400)
  }
  console.log(`${relay ? 'relay forced' : 'policy all  '} → ${out.join(' | ')}`)
  await h.context().close(); await c.context().close()
}
await browser.close()
