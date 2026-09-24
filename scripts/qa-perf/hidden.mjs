// Simulated tab hide (visibilityState override + visibilitychange): does the shader loop stop / resume?
import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(() => {
  try { localStorage.setItem('unshuffle:onboarded', '1') } catch {}
  window.__draws = 0
  const d = WebGL2RenderingContext.prototype.drawArrays
  WebGL2RenderingContext.prototype.drawArrays = function (...a) { window.__draws++; return d.apply(this, a) }
  let vis = 'visible'
  Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get: () => vis })
  Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => vis === 'hidden' })
  window.__setVis = (v) => { vis = v; document.dispatchEvent(new Event('visibilitychange')) }
})
const page = await ctx.newPage()
await page.goto('http://127.0.0.1:5318/'); await page.locator('[data-screen-frame][data-screen="home"]').waitFor()
await page.waitForTimeout(2000)
const rate = async () => { const a = await page.evaluate(() => window.__draws); await page.waitForTimeout(2000); const b = await page.evaluate(() => window.__draws); return (b - a) / 2 }
console.log('visible draws/s', await rate())
await page.evaluate(() => window.__setVis('hidden'))
console.log('hidden draws/s', await rate())
await page.evaluate(() => window.__setVis('visible'))
console.log('visible again draws/s', await rate())
await browser.close()
