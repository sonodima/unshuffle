// Capture a timed frame sequence of an animated lab page.
// Usage: node scripts/qa-design/frames.mjs <name> <path> <vp> <t1,t2,...ms> [clip x,y,w,h]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5303'
const OUT = new URL('./frames/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const [name, path, vpName, times, clipArg] = process.argv.slice(2)
const VP = {
  d1440: { viewport: { width: 1440, height: 900 } },
  d1280: { viewport: { width: 1280, height: 720 } },
  p390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  z1440: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
}
const clip = clipArg ? (([x, y, width, height]) => ({ x, y, width, height }))(clipArg.split(',').map(Number)) : undefined
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const ctx = await browser.newContext(VP[vpName])
await ctx.addInitScript(() => { try { localStorage.setItem('unshuffle:onboarded', String(Date.now())) } catch {} })
const page = await ctx.newPage()
if (process.env.WARM) { await page.goto(BASE + path, { waitUntil: 'load' }); await page.waitForTimeout(Number(process.env.WARM)) }
const t0 = Date.now()
await page.goto(BASE + path, { waitUntil: 'commit' })
const ts = times.split(',').map(Number)
for (const t of ts) {
  const wait = t - (Date.now() - t0)
  if (wait > 0) await page.waitForTimeout(wait)
  const real = Date.now() - t0
  await page.screenshot({ path: `${OUT}${name}-${String(t).padStart(5, '0')}.png`, clip })
  console.log(name, t, 'actual', real)
}
await browser.close()
