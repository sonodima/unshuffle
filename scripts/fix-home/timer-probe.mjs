// Demo timer digits vs bar over a cycle (lab, desktop). node scripts/fix-home/timer-probe.mjs
import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(() => { try { localStorage.setItem('unshuffle:onboarded', '1') } catch {} })
const page = await ctx.newPage()
await page.goto(`http://127.0.0.1:${process.env.PORT ?? 5404}/lab/fix-home.html?state=idle`)
const t0 = Date.now()
let last = ''
while (Date.now() - t0 < 13000) {
  const s = await page.evaluate(() => {
    const fill = document.querySelector('.hm-timer-fill')
    const track = fill?.parentElement
    const m = new DOMMatrix(getComputedStyle(fill).transform)
    const frac = 1 + m.m41 / track.getBoundingClientRect().width
    const digits = fill.closest('[aria-hidden]')?.querySelector('.num')?.textContent
    return `${digits} bar=${(frac * 20).toFixed(1)}s ${getComputedStyle(fill).animationPlayState}`
  })
  const key = s.split(' bar')[0] + s.split(' ').pop()
  if (key !== last) console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(5), s)
  last = key
  await page.waitForTimeout(100)
}
await browser.close()
