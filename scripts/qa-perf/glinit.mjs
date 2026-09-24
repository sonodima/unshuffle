// Time the WebGL background init on boot: getContext + compile/link status waits (fresh browser each run).
import { chromium } from 'playwright'
for (const [dev, cpu] of [['desktop', 1], ['phone', 1], ['phone', 4]]) {
  const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
  const ctx = await browser.newContext(dev === 'phone' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } })
  await ctx.addInitScript(() => {
    try { localStorage.setItem('unshuffle:onboarded', '1') } catch {}
    window.__g = { ctx: [], status: 0, draws: [], lt: [] }
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__g.lt.push([Math.round(e.startTime), Math.round(e.duration)]) }).observe({ type: 'longtask', buffered: true })
    const gc = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (t, ...a) { const s = performance.now(); const r = gc.call(this, t, ...a); if (/webgl/.test(t)) window.__g.ctx.push([t, Math.round(s), +(performance.now() - s).toFixed(1)]); return r }
    for (const P of [WebGL2RenderingContext.prototype]) {
      for (const m of ['getShaderParameter', 'getProgramParameter']) { const o = P[m]; P[m] = function (...a) { const s = performance.now(); const r = o.apply(this, a); window.__g.status += performance.now() - s; return r } }
      const d = P.drawArrays; let first = true
      P.drawArrays = function (...a) { if (first) { first = false; const s = performance.now(); const r = d.apply(this, a); window.__g.draws.push(['firstDraw', Math.round(s), +(performance.now() - s).toFixed(1)]); return r } return d.apply(this, a) }
    }
  })
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
  await page.goto('http://127.0.0.1:5318/', { waitUntil: 'load' })
  await page.locator('[data-screen-frame][data-screen="home"]').waitFor()
  await page.waitForTimeout(3000)
  const r = await page.evaluate(() => ({ fcp: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime), ...window.__g, status: +window.__g.status.toFixed(1) }))
  console.log(dev, `cpu${cpu}x`, JSON.stringify(r))
  await browser.close()
}
