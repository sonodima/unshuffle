// 360px phone + long names.
import { chromium } from 'playwright'
const OUT = new URL('./shots/', import.meta.url).pathname
const browser = await chromium.launch({ channel: 'chrome' })
const errors = []
for (const [tag, v, me, w] of [['n360', 'final', 'p-3', 360], ['long', 'long', 'p-host', 390], ['long360', 'long', 'p-3', 360]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const p = await ctx.newPage()
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`) })
  await p.goto(`http://localhost:5214/lab/final.html?ui=0&v=${v}&me=${me}&celebrate=0`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(3500)
  const overflow = await p.evaluate(() => [document.documentElement.scrollWidth, document.querySelector('main').parentElement.scrollWidth, window.innerWidth])
  console.log(tag, 'widths', overflow)
  await p.screenshot({ path: `${OUT}${tag}-top.png` })
  await ctx.close()
}
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const p = await ctx.newPage()
await p.goto(`http://localhost:5214/lab/final.html?ui=0&v=long&me=p-3&celebrate=0`, { waitUntil: 'networkidle' })
await p.waitForTimeout(3500)
await p.screenshot({ path: `${OUT}long-desk-top.png` })
await browser.close()
console.log(errors.length ? errors.join('\n') : 'no console errors')
