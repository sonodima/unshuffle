// Reduced-motion render check. Usage: node scripts/home/reduced.mjs
import { chromium } from 'playwright'
const OUT = new URL('./shots/', import.meta.url).pathname
const browser = await chromium.launch({ channel: 'chrome' })
const errors = []
for (const [name, opts] of [
  ['phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }],
  ['desk', { viewport: { width: 1440, height: 900 } }],
]) {
  const ctx = await browser.newContext({ ...opts, reducedMotion: 'reduce' })
  await ctx.addInitScript(() => localStorage.setItem('unshuffle:onboarded', '1'))
  const page = await ctx.newPage()
  page.on('console', (m) => m.type() === 'error' && errors.push(`[${name}] ${m.text()}`))
  page.on('pageerror', (e) => errors.push(`[${name}] ${e.message}`))
  await page.goto('http://127.0.0.1:5210/lab/home.html', { waitUntil: 'load' })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${OUT}reduced-${name}.png` })
  await ctx.close()
}
await browser.close()
console.log(errors.length ? errors.join('\n') : 'no console errors')
