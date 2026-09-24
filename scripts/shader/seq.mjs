// Frame sequence after a kick (ring progression). Usage: node scripts/shader/seq.mjs tag [phone|desk] [query]
import { chromium } from 'playwright'
const [tag = 'seq', which = 'desk', q = 'ui=0&music=1'] = process.argv.slice(2)
const OUT = new URL('./shots/', import.meta.url).pathname
const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'] })
const phone = which === 'phone'
const ctx = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone })
const page = await ctx.newPage()
await page.goto(`http://localhost:5209/lab/shader.html?${q}`, { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
for (const ms of [60, 200, 420, 800]) {
  await page.evaluate(async (ms) => {
    const lab = window.__shaderLab
    lab.pause(false)
    lab.synth.alignKick(50)
    await new Promise((r) => setTimeout(r, 50 + ms))
    lab.pause(true)
  }, ms)
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${OUT}${tag}-${which}-${ms}.png` })
}
await browser.close()
