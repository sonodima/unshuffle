// Real-time frames of the lab's live flow (intro 3-2-1 → VIA → board, first confirm banner).
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://localhost:5401/lab/fix-round.html'
const OUT = new URL('./shots/', import.meta.url).pathname
const device = process.argv[2] === 'phone' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } }
const tag = process.argv[2] ?? 'desktop'
const at = (process.argv[3] ?? '5000,5350,5700,6350,7350,8150,8600,13400,14000').split(',').map(Number)
const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext(device)
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await page.goto(`${BASE}?ui=0&bg=css&engine=mock&s=flow`)
await page.waitForFunction(() => window.__round)
const t0 = Date.now()
for (const t of at) {
  const wait = t - (Date.now() - t0)
  if (wait > 0) await page.waitForTimeout(wait)
  await page.screenshot({ path: `${OUT}flow-${tag}-${String(t).padStart(5, '0')}.png`, scale: 'css' })
  console.log('frame', t, 'phase', await page.evaluate(() => window.__round.phase()))
}
console.log('errors', errors)
await browser.close()
