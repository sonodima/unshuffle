import { chromium } from 'playwright'
const dir = new URL('./', import.meta.url).pathname
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await page.goto('file://' + dir + 'boot.html')
const shots = []
for (const t of [700, 950, 1200]) {
  await page.waitForTimeout(t === 700 ? 700 : 250)
  await page.screenshot({ path: `${dir}boot-crop-${t}.png`, clip: { x: 95, y: 322, width: 200, height: 200 } })
}
await browser.close()
