import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] })
for (const [name, opts] of [['p390', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['d1440', { viewport: { width: 1440, height: 900 } }]]) {
  const ctx = await browser.newContext(opts)
  await ctx.addInitScript(() => {
    try { localStorage.setItem('unshuffle:onboarded', '1') } catch {}
    window.__draws = 0
    const P = WebGL2RenderingContext.prototype; const d = P.drawArrays
    P.drawArrays = function (...a) { if (this.canvas?.parentElement?.classList.contains('ushf-bg-layer')) window.__draws++; return d.apply(this, a) }
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('http://localhost:5413/', { waitUntil: 'load' })
  await page.waitForTimeout(4000)
  const r = await page.evaluate(async () => {
    const a = window.__draws; await new Promise((r) => setTimeout(r, 2000))
    const c = document.querySelector('.ushf-bg canvas')
    return { mode: document.querySelector('.ushf-bg')?.dataset.mode, canvas: c ? `${c.width}x${c.height}` : null, opacity: c?.style.opacity, grain: !!document.querySelector('.ushf-bg-grain'), drawsPerS: (window.__draws - a) / 2 }
  })
  await page.screenshot({ path: new URL(`./shots/app-dev-${name}.png`, import.meta.url).pathname })
  console.log(name, JSON.stringify(r), errors.length ? 'ERR ' + errors.join(' | ') : 'no console errors')
  await ctx.close()
}
await browser.close()
