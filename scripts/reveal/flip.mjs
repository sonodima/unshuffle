// Freeze the cover flip mid-way (motion values paused via a slowed clock is not
// available, so sample quickly with a light page: no audio).
import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:5213/lab/reveal.html?ui=0&audio=0', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)
await page.evaluate(() => window.__revealLab.replay())
for (const t of [60, 140, 220, 320]) {
  await page.waitForTimeout(t === 60 ? 60 : 80)
  await page.screenshot({ path: `scripts/reveal/shots/flip-${t}.png`, clip: { x: 40, y: 90, width: 400, height: 320 } })
}
await browser.close()
