// Songs: tap a cover → the preview loads (fresh URL via Deezer JSONP) and plays; tap again → stops.
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://localhost:5405'
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(`${BASE}/lab/fix-final.html?ui=0&v=final&me=p-host&celebrate=0`, { waitUntil: 'load' })
await page.waitForTimeout(3500)
const imgs = await page.evaluate(() => [...document.querySelectorAll('#fp-songs ~ ul img, section[aria-labelledby="fp-songs"] img')].map((i) => i.getAttribute('src')))
console.log('song covers', imgs.map((s) => s?.match(/\/(\d+x\d+)-/)?.[1]))
const btn = page.getByRole('button', { name: /Ascolta l’anteprima di Blinding Lights/ })
await btn.scrollIntoViewIfNeeded()
await btn.tap()
const t0 = Date.now()
await page.waitForFunction(() => document.querySelector('button[aria-pressed="true"]'), null, { timeout: 20000 }).catch(() => {})
console.log('pressed after', Date.now() - t0, 'ms')
await page.waitForTimeout(1500)
const st = await page.evaluate(() => {
  const b = document.querySelector('button[aria-pressed="true"]')
  const bar = b?.querySelector('span[aria-hidden] > span.origin-left')
  return { label: b?.getAttribute('aria-label'), bar: bar?.style.transform }
})
console.log('playing', st)
await page.screenshot({ path: new URL('./shots/songs-playing.png', import.meta.url).pathname })
await page.getByRole('button', { name: /Ferma l’anteprima di Blinding Lights/ }).tap()
await page.waitForTimeout(600)
console.log('after stop pressed=', await page.evaluate(() => !!document.querySelector('button[aria-pressed="true"]')))
// Switch song while one plays
await btn.tap()
await page.waitForFunction(() => document.querySelector('button[aria-pressed="true"]'), null, { timeout: 20000 }).catch(() => {})
const b2 = page.getByRole('button', { name: /Ascolta l’anteprima di Rolling in the Deep/ })
await b2.tap()
await page.waitForFunction(() => document.querySelector('button[aria-pressed="true"]')?.getAttribute('aria-label')?.includes('Rolling'), null, { timeout: 20000 }).catch(() => {})
console.log('now', await page.evaluate(() => [...document.querySelectorAll('button[aria-pressed="true"]')].map((b) => b.getAttribute('aria-label'))))
console.log(errors.length ? errors.join('\n') : 'no console errors')
await browser.close()
