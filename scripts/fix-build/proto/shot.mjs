import { chromium } from 'playwright'
const dir = new URL('./', import.meta.url).pathname
const browser = await chromium.launch({ channel: 'chrome' })
for (const [w, h, s, tag] of [[390, 844, 2, 'phone'], [1440, 900, 1, 'desktop']]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: s })
  await page.goto('file://' + dir + 'boot.html')
  await page.waitForTimeout(Number(process.env.T ?? 900))
  await page.screenshot({ path: `${dir}boot-${tag}.png` })
  const vis = await page.evaluate(() => getComputedStyle(document.getElementById('boot')).display)
  await page.goto('file://' + dir + 'boot-mounted.html')
  const mounted = await page.evaluate(() => getComputedStyle(document.getElementById('boot')).display)
  console.log(tag, 'boot display', vis, 'with app mounted', mounted)
  await page.close()
}
const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
await p.goto('file://' + dir + 'boot.html')
await p.waitForTimeout(900)
await p.screenshot({ path: `${dir}boot-nojs.png` })
await browser.close()
