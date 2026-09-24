// Reduced-motion smoke test: logo must render in order immediately, no errors.
import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(e.message))
await page.goto('http://localhost:5201/lab/ui.html', { waitUntil: 'networkidle' })
await page.waitForTimeout(300)
const xs = await page.$$eval('header [role=img] > span > span', (els) => els.map((e) => Math.round(e.getBoundingClientRect().x)))
const sorted = xs.every((x, i) => i === 0 || x > xs[i - 1])
console.log(sorted ? 'PASS logo in order under reduced motion' : 'FAIL logo order ' + xs.join(','))
await page.screenshot({ path: new URL('./shots/reduced-phone.png', import.meta.url).pathname })
console.log(errors.length ? errors.join('\n') : 'no console errors')
await browser.close()
