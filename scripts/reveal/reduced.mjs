// Reduced motion: end state at once, no confetti; also keyboard focus order.
import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => (m.type() === 'error') && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(e.message))
await page.goto('http://localhost:5213/lab/reveal.html?ui=0&me=p-2&audio=0', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1200)
console.log('stage', await page.evaluate(() => document.querySelector('.rv-root')?.getAttribute('data-stage')))
console.log('confetti canvases', await page.evaluate(() => document.querySelectorAll('canvas[aria-hidden]').length))
await page.screenshot({ path: 'scripts/reveal/shots/reduced-phone.png' })
// Keyboard: tab through focusables
const seen = []
for (let i = 0; i < 16; i++) {
  await page.keyboard.press('Tab')
  seen.push(await page.evaluate(() => {
    const el = document.activeElement
    return el ? `${el.tagName.toLowerCase()}:${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40)}` : 'none'
  }))
}
console.log(seen.join('\n'))
await page.screenshot({ path: 'scripts/reveal/shots/focus-phone.png' })
console.log(errors.length ? 'ERRORS ' + errors.join('\n') : 'no console errors')
await browser.close()
