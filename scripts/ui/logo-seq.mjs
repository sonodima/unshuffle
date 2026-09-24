// Captures the hero logo over time to inspect the intro animation.
import { chromium } from 'playwright'
const w = Number(process.argv[2] ?? 1440)
const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
await page.goto('http://localhost:5201/lab/ui.html', { waitUntil: 'domcontentloaded' })
const t0 = Date.now()
for (const t of [300, 700, 1100, 1500, 2000, 3000, 5000]) {
  await page.waitForTimeout(Math.max(0, t - (Date.now() - t0)))
  const box = await page.locator('header [role=img]').first().boundingBox()
  if (box) await page.screenshot({ path: new URL(`./shots/seq-${w}-${t}.png`, import.meta.url).pathname, clip: { x: box.x - 20, y: box.y - 20, width: box.width + 40, height: box.height + 40 } })
}
const info = await page.$$eval('header [role=img] > span > span', (els) => els.map((e) => ({ t: e.style.transform, x: Math.round(e.getBoundingClientRect().x) })))
console.log(JSON.stringify(info))
await browser.close()
