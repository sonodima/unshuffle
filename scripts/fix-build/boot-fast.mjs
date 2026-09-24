// Unthrottled load: the boot screen must never become visible (max opacity while shown).
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://localhost:5474/'
const browser = await chromium.launch({ channel: 'chrome' })
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } })
  await ctx.addInitScript(() => {
    window.__boot = { max: 0, frames: 0, hiddenAt: 0 }
    const tick = () => {
      const b = document.getElementById('boot')
      if (b) {
        const cs = getComputedStyle(b)
        if (cs.display === 'none') {
          window.__boot.hiddenAt ||= Math.round(performance.now())
          return
        }
        window.__boot.frames++
        window.__boot.max = Math.max(window.__boot.max, Number(cs.opacity))
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  const page = await ctx.newPage()
  await page.goto(BASE)
  await page.locator('[data-screen-frame][data-screen="home"]').waitFor()
  await page.waitForTimeout(300)
  console.log(`${w}x${h}`, JSON.stringify(await page.evaluate(() => window.__boot)))
  await ctx.close()
}
await browser.close()
