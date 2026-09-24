// Screenshot one section (or the top) at phone + desktop. Usage: node scripts/ui/shoot-one.mjs tag sectionId|top [waitMs]
import { chromium } from 'playwright'
const [tag = 'x', target = 'top', wait = '2400'] = process.argv.slice(2)
const OUT = new URL('./shots/', import.meta.url).pathname
const browser = await chromium.launch({ channel: 'chrome' })
const errors = []
for (const [name, viewport, dsf] of [['phone', { width: 390, height: 844 }, 2], ['desk', { width: 1440, height: 900 }, 1]]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dsf, hasTouch: name === 'phone', isMobile: name === 'phone' })
  const page = await ctx.newPage()
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`[${name}] ${m.text()}`))
  page.on('pageerror', (e) => errors.push(`[${name}] pageerror: ${e.message}`))
  await page.goto('http://localhost:5201/lab/ui.html', { waitUntil: 'networkidle' })
  if (target !== 'top') await page.evaluate((i) => document.getElementById(i)?.scrollIntoView({ block: 'start' }), target)
  await page.waitForTimeout(Number(wait))
  await page.screenshot({ path: `${OUT}${tag}-${name}-${target}.png` })
  await ctx.close()
}
await browser.close()
console.log(errors.length ? errors.join('\n') : 'no console errors')
