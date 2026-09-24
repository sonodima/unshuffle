// Screenshots of the fix-ui lab. Usage: node scripts/fix-ui/shots.mjs <tag> [query...]
//   e.g. node scripts/fix-ui/shots.mjs t1 view=timers view=modal&modal=avatar
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://localhost:5407/lab/fix-ui.html'
const [tag = 'x', ...queries] = process.argv.slice(2)
const VPS = (process.env.VPS ?? 'p390,d1440').split(',')
const DEV = {
  p390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  l844: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  l667: { viewport: { width: 667, height: 375 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  l568: { viewport: { width: 568, height: 320 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  p360: { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  d1440: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  d1280s: { viewport: { width: 1280, height: 480 }, deviceScaleFactor: 1 },
}
const browser = await chromium.launch({ channel: 'chrome' })
for (const vp of VPS) {
  const ctx = await browser.newContext(DEV[vp])
  const page = await ctx.newPage()
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && console.log(`[${vp}] ${m.type()}: ${m.text()}`))
  page.on('pageerror', (e) => console.log(`[${vp}] pageerror: ${e.message}`))
  for (const qs of queries) {
    await page.goto(`${BASE}?${qs}`, { waitUntil: 'load' })
    await page.waitForTimeout(Number(process.env.WAIT ?? 1400))
    if (process.env.PRE) { await page.evaluate(process.env.PRE); await page.waitForTimeout(400) }
    const name = `${tag}-${vp}-${qs.replace(/[=&]/g, '_')}.png`
    await page.screenshot({ path: `scripts/fix-ui/shots/${name}`, fullPage: process.env.FULL === '1' })
    if (process.env.EVAL) console.log(vp, qs, JSON.stringify(await page.evaluate(process.env.EVAL)))
    console.log('shot', name)
  }
  await ctx.close()
}
await browser.close()
