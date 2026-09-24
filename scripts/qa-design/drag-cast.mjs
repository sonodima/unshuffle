// Record a mouse drag on the board lab with CDP screencast (lift → over → drop settle).
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5303'
const OUT = new URL('./frames/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(`${BASE}/lab/board.html?n=8&audio=synth&ui=0`, { waitUntil: 'load' })
await page.waitForTimeout(2500)
const box = async (pos) => page.locator(`.sb-item[data-pos="${pos}"]`).boundingBox()
const a = await box(0), b = await box(6)
console.log('block', a)
const cdp = await page.context().newCDPSession(page)
const frames = []
cdp.on('Page.screencastFrame', async (f) => { frames.push({ t: f.metadata.timestamp * 1000, data: f.data }); try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }) } catch {} })
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: 1440, maxHeight: 900 })
await page.waitForTimeout(300)
const T = {}
const t0 = Date.now()
await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
await page.mouse.down(); T.down = Date.now() - t0
await page.mouse.move(a.x + a.width / 2 + 8, a.y + a.height / 2 + 4, { steps: 2 }); T.lift = Date.now() - t0
await page.waitForTimeout(250)
const steps = 24
for (let i = 1; i <= steps; i++) {
  await page.mouse.move(a.x + a.width / 2 + ((b.x - a.x) * i) / steps, a.y + a.height / 2 + ((b.y - a.y) * i) / steps)
  await page.waitForTimeout(20)
}
T.over = Date.now() - t0
await page.waitForTimeout(500)
await page.mouse.up(); T.up = Date.now() - t0
await page.waitForTimeout(900)
await cdp.send('Page.stopScreencast')
const start = t0
for (const f of frames) writeFileSync(`${OUT}drag-${String(Math.round(f.t - start)).padStart(5, '0')}.jpg`, Buffer.from(f.data, 'base64'))
console.log(T, 'frames', frames.length)
await browser.close()
