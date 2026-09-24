// Scrolled-to-bottom real app Home screenshot. node scripts/fix-home/scroll-shot.mjs <tag> <w> <h>
import { chromium } from 'playwright'
const [tag = 'scroll', w = '844', h = '390', base = 'http://127.0.0.1:5404/'] = process.argv.slice(2)
const OUT = new URL('./shots/', import.meta.url).pathname
const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
await ctx.addInitScript(() => { try { localStorage.setItem('unshuffle:onboarded', '1') } catch {} })
const page = await ctx.newPage()
await page.goto(base, { waitUntil: 'load' })
await page.locator('[data-screen-frame][data-screen="home"]').waitFor()
await page.waitForTimeout(2500)
await page.evaluate(() => { const sc = document.querySelector('.hm-root'); sc.scrollTop = sc.scrollHeight })
await page.waitForTimeout(800)
await page.screenshot({ path: `${OUT}${tag}.png` })
await browser.close()
