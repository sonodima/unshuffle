import { chromium } from 'playwright'
const OUT = new URL('./shots/', import.meta.url).pathname
const browser = await chromium.launch({ channel: 'chrome' })
for (const [name, opts] of [['free-phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['free-desktop', { viewport: { width: 1440, height: 900 } }]]) {
  const ctx = await browser.newContext(opts)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
  await page.goto('http://localhost:5202/lab/board.html?n=8&audio=synth&ui=0&free=1')
  await page.waitForFunction(() => window.__lab && window.__lab.ready())
  await page.waitForTimeout(500)
  const info = await page.evaluate(() => { const b = document.querySelector('.sb-board'); const g = document.querySelector('.sb-grid'); return { free: b.dataset.free, board: b.getBoundingClientRect().height, grid: g.getBoundingClientRect().height, cols: getComputedStyle(g).gridTemplateColumns } })
  console.log(name, JSON.stringify(info))
  await page.screenshot({ path: `${OUT}${name}.png` })
  await ctx.close()
}
await browser.close()
