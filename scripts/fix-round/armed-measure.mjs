// Measures the armed CONFERMA label against its button across widths.
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://localhost:5401/lab/fix-round.html'
const OUT = new URL('./shots/', import.meta.url).pathname
const browser = await chromium.launch({ channel: 'chrome' })
for (const [w, h, touch] of [[360, 640, true], [390, 844, true], [640, 800, false], [768, 1024, false], [844, 390, true], [1023, 768, false], [1024, 768, false], [1440, 900, false]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch })
  const page = await ctx.newPage()
  await page.goto(`${BASE}?ui=0&bg=css&engine=mock&s=playing`)
  await page.waitForFunction(() => window.__round)
  await page.waitForTimeout(800)
  const btn = page.locator('footer button[aria-keyshortcuts]')
  if (touch) await btn.tap()
  else await btn.click()
  await page.waitForTimeout(500)
  const m = await btn.evaluate((b) => {
    const label = b.querySelector('.btn-label')
    const spans = [...b.querySelectorAll('.btn-label span span')]
    const br = b.getBoundingClientRect()
    return {
      button: Math.round(br.width),
      label: Math.round(label.getBoundingClientRect().width),
      lines: spans.map((s) => ({ text: s.textContent, right: Math.round(s.getBoundingClientRect().right - br.right) })),
    }
  })
  console.log(w, 'x', h, JSON.stringify(m))
  await page.screenshot({ path: `${OUT}armed-${w}x${h}.png`, clip: await btn.boundingBox().then((b) => ({ x: Math.max(0, b.x - 10), y: b.y - 10, width: Math.min(w - Math.max(0, b.x - 10), b.width + 20), height: b.height + 20 })) })
  await ctx.close()
}
await browser.close()
