// QA (network): host built with an incomplete TURN config (VITE_TURN_URLS set, username missing).
import { chromium } from 'playwright'
const URL = 'http://127.0.0.1:5306/lab/net.html'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
async function page(label) {
  const p = await (await browser.newContext()).newPage()
  p.on('pageerror', (e) => console.log(`[${label}] pageerror:`, e.message.slice(0, 160)))
  await p.goto(URL)
  await p.waitForFunction(() => !!window.netLab)
  return p
}
const h = await page('host')
await h.evaluate(() => window.netLab.setIce([{ urls: ['stun:stun.l.google.com:19302'] }, { urls: ['turn:relay.example.com:3478'], username: '', credential: '' }]))
const hr = await h.evaluate(() => window.netLab.createHost())
console.log('host created', JSON.stringify(hr))
const c = await page('client')
const t = Date.now()
const r = await c.evaluate((code) => window.netLab.joinRoom(code), hr.code)
console.log('join →', JSON.stringify(r), `${Date.now() - t}ms`)
console.log('client log:', (await c.evaluate(() => window.netLab.log().map((e) => e.msg))).join(' / '))
console.log('host log:', (await h.evaluate(() => window.netLab.log().map((e) => e.msg))).join(' / '))
await browser.close()
