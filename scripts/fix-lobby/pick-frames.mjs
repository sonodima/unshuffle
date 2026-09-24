// Frames of the sheet's record when the host picks a playlist (phone).
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5403'
const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
await page.goto(`${BASE}/lab/fix-lobby.html?role=host&pl=0&tab=playlist&latency=50`, { waitUntil: 'load' })
await page.waitForTimeout(1500)
await page.getByRole('button', { name: /Top Italy/ }).first().tap()
for (const t of [60, 200, 400, 800]) {
  await page.waitForTimeout(t === 60 ? 60 : t - [60, 200, 400, 800][[60, 200, 400, 800].indexOf(t) - 1])
  await page.screenshot({ path: `scripts/fix-lobby/shots/pick-${t}.png`, clip: { x: 0, y: 700, width: 390, height: 144 } })
}
await browser.close()
