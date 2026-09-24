// Real screens from fixtures (lab ?real=1): where does the floating chrome land?
import { chromium } from 'playwright'
const OUT = new URL('./shots/', import.meta.url).pathname
const browser = await chromium.launch({ channel: 'chrome' })
const names = process.argv.slice(2).length ? process.argv.slice(2) : ['lobby', 'intro', 'playing', 'reveal', 'final']
const errors = []
for (const [vp, opts] of Object.entries({
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 } },
  laptop: { viewport: { width: 1100, height: 760 } },
})) {
  // warm-up context (the first GPU frame of a run is sometimes blank)
  const warm = await browser.newContext(opts)
  await (await warm.newPage()).goto('http://localhost:5215/lab/shell.html?panel=0&real=1', { waitUntil: 'networkidle' })
  await warm.close()
  for (const name of names) {
    const ctx = await browser.newContext(opts)
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`[${vp}/${name}] ${e.message}`))
    page.on('console', (m) => m.type() === 'error' && errors.push(`[${vp}/${name}] ${m.text().slice(0, 200)}`))
    await page.goto('http://localhost:5215/lab/shell.html?panel=0&real=1', { waitUntil: 'networkidle' })
    await page.evaluate((n) => window.__shell.setFixture(n, 'p-2'), name)
    await page.waitForTimeout(1800)
    await page.screenshot({ path: `${OUT}screen-${name}-${vp}.png` })
    await ctx.close()
  }
}
await browser.close()
console.log(errors.join('\n') || 'no errors')
