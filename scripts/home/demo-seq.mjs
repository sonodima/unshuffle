// Frames of the desktop demo loop. Usage: node scripts/home/demo-seq.mjs
import { chromium } from 'playwright'
const OUT = new URL('./shots/', import.meta.url).pathname
const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(() => localStorage.setItem('unshuffle:onboarded', '1'))
const page = await ctx.newPage()
await page.goto('http://127.0.0.1:5210/lab/home.html', { waitUntil: 'load' })
const t0 = Date.now()
for (const at of [1200, 2600, 4400, 6200, 8200, 9400, 10600, 12000]) {
  await page.waitForTimeout(Math.max(0, at - (Date.now() - t0)))
  await page.locator('aside').screenshot({ path: `${OUT}seq-${String(at).padStart(5, '0')}.png` })
}
await browser.close()
