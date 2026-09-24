// Frame pacing during a 16-block touch drag with 4x CPU throttling (mid-range phone proxy).
import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
await page.goto('http://localhost:5202/lab/board.html?n=16&audio=synth&ui=0')
await page.waitForFunction(() => window.__lab && window.__lab.ready())
await page.waitForTimeout(500)
const cdp = await ctx.newCDPSession(page)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.argv[2] ?? 4) })
const c = async (pos) => { const b = await page.locator(`.sb-item[data-pos="${pos}"]`).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } }
const a = await c(0), b = await c(15)
await page.evaluate(() => {
  window.__frames = []
  let last = performance.now()
  window.__long = []
  const loop = (t) => { window.__frames.push(t - last); if (t - last > 25) window.__long.push([Math.round(last), Math.round(t - last)]); last = t; if (window.__frames.length < 2000) requestAnimationFrame(loop) }
  requestAnimationFrame(loop)
})
const tStart = await page.evaluate(() => performance.now())
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y, id: 1 }] })
const steps = 90
for (let i = 1; i <= steps; i++) {
  // zig-zag path over many blocks
  const f = i / steps
  const x = a.x + (b.x - a.x) * f + Math.sin(f * Math.PI * 6) * 120
  const y = a.y + (b.y - a.y) * f
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] })
  await page.waitForTimeout(16)
}
const tEnd = await page.evaluate(() => performance.now())
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
await page.waitForTimeout(500)
console.log('start', Math.round(tStart), 'end', Math.round(tEnd), 'long', JSON.stringify(await page.evaluate(() => window.__long)))
const frames = await page.evaluate(() => window.__frames.slice(5))
frames.sort((x, y) => x - y)
const pct = (p) => frames[Math.floor(frames.length * p)].toFixed(1)
console.log(`frames=${frames.length} p50=${pct(0.5)}ms p90=${pct(0.9)}ms p99=${pct(0.99)}ms max=${frames[frames.length - 1].toFixed(1)}ms  >25ms: ${frames.filter((f) => f > 25).length}`)
await browser.close()
