// QA (network): host JS frozen for N seconds (phone host switches to WhatsApp to share the code,
// Debugger.pause = timers/JS stopped, sockets stay open like a backgrounded tab). Does the guest
// ride it out and is it back 'open' afterwards?
//   node scripts/qa-network/host-freeze.mjs <seconds>
import { chromium } from 'playwright'
const SECS = Number(process.argv[2] ?? 20)
const URL = process.env.NET_LAB_URL ?? 'http://127.0.0.1:5306/lab/net.html'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
async function page() {
  const p = await (await browser.newContext()).newPage()
  await p.goto(URL)
  await p.waitForFunction(() => !!window.netLab)
  return p
}
const h = await page()
const c = await page()
const hr = await h.evaluate(() => window.netLab.createHost())
await c.evaluate((code) => window.netLab.joinRoom(code), hr.code)
await c.waitForTimeout(1500)
const cdp = await h.context().newCDPSession(h)
await cdp.send('Debugger.enable')
const t0 = await c.evaluate(() => Date.now())
await cdp.send('Debugger.pause')
await c.waitForTimeout(SECS * 1000)
await cdp.send('Debugger.resume')
const tResume = await c.evaluate(() => Date.now())
const res = await c.waitForFunction(
  (t0) => { const ev = window.netLab.events.filter((e) => e.wall > t0 && e.kind === 'client:status'); const last = ev[ev.length - 1]; return last && (last.data.s === 'open' || last.data.s === 'closed') ? last : null },
  t0, { timeout: 60_000, polling: 200 },
).then((x) => x.jsonValue()).catch(() => null)
const statuses = await c.evaluate((t0) => window.netLab.events.filter((e) => e.wall > t0 && e.kind === 'client:status').map((e) => `+${e.wall - t0}ms ${e.data.s}${e.data.d ? ` (${e.data.d})` : ''}`), t0)
console.log(`host frozen ${SECS}s (resumed at +${tResume - t0}ms) → client statuses: ${statuses.join(' | ') || 'none'}`)
console.log('outcome:', res ? `${res.data.s} ${res.data.d ?? ''} at +${res.wall - t0}ms` : 'no terminal status within 60 s after resume')
console.log('client log:', (await c.evaluate((t0) => window.netLab.log().filter((e) => e.at > t0).map((e) => `+${e.at - t0}ms ${e.msg}`), t0)).join(' | '))
console.log('host log:', (await h.evaluate((t0) => window.netLab.log().filter((e) => e.at > t0).map((e) => `+${e.at - t0}ms ${e.msg}`), t0)).join(' | '))
await browser.close()
