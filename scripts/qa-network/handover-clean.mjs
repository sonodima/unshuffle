// QA (network): phone switches network and the OS closes the old sockets cleanly (the common case):
// client's data channel goes silent (freezeLink) AND its signaling socket closes (dropSignaling).
// How long until the transport is 'open' again?
import { chromium } from 'playwright'
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
const t0 = await c.evaluate(() => { const t = Date.now(); window.netLab.freezeLink(); window.netLab.dropSignaling('client'); return t })
const res = await c.waitForFunction((t0) => window.netLab.events.find((e) => e.wall > t0 && e.kind === 'client:status' && e.data?.s === 'open') ?? null, t0, { timeout: 60_000, polling: 100 }).then((x) => x.jsonValue()).catch(() => null)
console.log('recovered:', res ? `+${res.wall - t0}ms` : 'no')
console.log('client log:', (await c.evaluate((t0) => window.netLab.log().filter((e) => e.at >= t0).map((e) => `+${e.at - t0}ms ${e.msg}`), t0)).join(' | '))
await browser.close()
