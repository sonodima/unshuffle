// Frame bursts: drop animation, skeleton, lab view.
import { chromium } from 'playwright'
const OUT = new URL('./shots/', import.meta.url).pathname
const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
await page.goto('http://localhost:5202/lab/board.html?n=8&audio=synth&ui=0&delay=2500')
await page.waitForTimeout(700)
await page.screenshot({ path: `${OUT}b-skeleton.png`, clip: { x: 140, y: 160, width: 600, height: 280 } })
await page.waitForFunction(() => window.__lab && window.__lab.ready(), null, { timeout: 20000 })
await page.waitForTimeout(400)
const box = async (pos) => page.locator(`.sb-item[data-pos="${pos}"]`).boundingBox()
const a = await box(0), b = await box(5)
await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
await page.mouse.down()
for (let i = 1; i <= 15; i++) {
  await page.mouse.move(a.x + a.width / 2 + ((b.x - a.x) * i) / 15, a.y + a.height / 2 + ((b.y - a.y) * i) / 15 - 30)
  await page.waitForTimeout(16)
}
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}b-drag-desktop.png` })
await page.mouse.up()
for (const t of [40, 100, 170, 260]) {
  await page.waitForTimeout(t === 40 ? 40 : 60)
  await page.screenshot({ path: `${OUT}b-drop-${t}.png`, clip: { x: 100, y: 380, width: 800, height: 330 } })
}
await ctx.close()
for (const [name, opts] of [
  ['b-lab-desktop', { viewport: { width: 1440, height: 900 } }],
  ['b-lab-phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
]) {
  const c = await browser.newContext(opts)
  const p = await c.newPage()
  await p.goto('http://localhost:5202/lab/board.html?n=12')
  await p.waitForFunction(() => window.__lab && window.__lab.ready(), null, { timeout: 20000 })
  await p.waitForTimeout(800)
  await p.screenshot({ path: `${OUT}${name}.png` })
  await c.close()
}
await browser.close()
