// fix-net: the host's renderer crashes (no pagehide, no goodbye, sockets die with it) —
// like a phone OS killing the tab. How does the guest notice, and how fast is "host gone"?
//   node scripts/fix-net/crash-host.mjs
import { chromium } from 'playwright'
const URL = process.env.NET_LAB_URL ?? 'http://127.0.0.1:5460/lab/fix-net.html'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
async function page() {
  const p = await (await browser.newContext()).newPage()
  p.on('crash', () => console.log('(host renderer crashed)'))
  await p.goto(URL)
  await p.waitForFunction(() => !!window.netLab)
  return p
}
const h = await page()
const c = await page()
const r = await h.evaluate(() => window.netLab.createHost())
await c.evaluate((code) => window.netLab.joinRoom(code), r.code)
await c.waitForTimeout(2000)
const cdp = await h.context().newCDPSession(h)
const t0 = await c.evaluate(() => Date.now())
void cdp.send('Page.crash').catch(() => {})
const res = await c.waitForFunction((t0) => window.netLab.events.find((e) => e.wall > t0 && e.kind === 'client:status' && e.data.s === 'closed') ?? null, t0, { timeout: 60000, polling: 200 }).then((x) => x.jsonValue()).catch(() => null)
const statuses = await c.evaluate((t0) => window.netLab.events.filter((e) => e.wall > t0 && e.kind === 'client:status').map((e) => `+${e.wall - t0}ms ${e.data.s}${e.data.d ? ` (${e.data.d})` : ''}`), t0)
console.log('client statuses:', statuses.join(' | '))
console.log('client log:', (await c.evaluate((t0) => window.netLab.log().filter((e) => e.at > t0).map((e) => `+${e.at - t0}ms ${e.msg}`), t0)).join(' | '))
console.log(res && res.data.d === 'host-gone' ? `PASS host-gone after ${res.wall - t0} ms` : `FAIL ${JSON.stringify(res)}`)
await browser.close()
