// Real app boot: zero console errors on '/', '#/styleguide' and back; screenshots.
import { chromium } from 'playwright'
const OUT = new URL('./shots/', import.meta.url).pathname
const browser = await chromium.launch({ channel: 'chrome' })
const errors = []
for (const [vp, opts] of Object.entries({
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 } },
})) {
  const ctx = await browser.newContext(opts)
  const page = await ctx.newPage()
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`[${vp}] ${m.type()} ${m.text().slice(0, 400)}`))
  page.on('pageerror', (e) => errors.push(`[${vp}] pageerror ${e.message}`))
  await page.goto('http://localhost:5215/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  console.log(vp, 'title:', await page.title(), 'screen:', await page.getAttribute('[data-screen-frame]', 'data-screen'))
  await page.screenshot({ path: `${OUT}boot-home-${vp}.png` })
  await page.evaluate(() => (location.hash = '#/styleguide'))
  await page.waitForTimeout(1800)
  console.log(vp, 'title:', await page.title(), 'screens:', await page.$$eval('[data-screen-frame]', (els) => els.map((e) => e.getAttribute('data-screen'))))
  await page.screenshot({ path: `${OUT}boot-styleguide-${vp}.png` })
  await page.evaluate(() => (location.hash = '#/'))
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${OUT}boot-transition-${vp}.png` })
  await page.waitForTimeout(900)
  const frame = await page.$eval('[data-screen-frame]', (e) => ({ screen: e.getAttribute('data-screen'), filter: getComputedStyle(e).filter, transform: getComputedStyle(e).transform, n: document.querySelectorAll('[data-screen-frame]').length }))
  console.log(vp, 'after back:', JSON.stringify(frame), await page.title())
  await ctx.close()
}
await browser.close()
console.log(errors.length ? errors.join('\n') : 'no console errors/warnings')
