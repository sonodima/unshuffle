// Cold-boot A/B: FCP, WebGL context creation, blocking status waits and long tasks (fresh browser per run).
// node scripts/fix-background/boot.mjs  (new build on :5463, old QA build on :5464)
import { chromium } from 'playwright'
const TARGETS = [['old', process.env.OLD ?? 'http://localhost:5464/'], ['new', process.env.NEW ?? 'http://localhost:5463/']]
const RUNS = Number(process.env.RUNS ?? 4)
for (const dev of ['desktop', 'phone']) {
  for (const [label, url] of TARGETS) {
    const rows = []
    for (let i = 0; i < RUNS; i++) {
      const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
      const ctx = await browser.newContext(dev === 'phone' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } })
      if (process.env.NO_RIC === '1') await ctx.addInitScript(() => { delete window.requestIdleCallback; window.requestIdleCallback = undefined })
      await ctx.addInitScript(() => {
        try { localStorage.setItem('unshuffle:onboarded', '1') } catch {}
        window.__g = { ctx: [], status: 0, first: 0, lt: [] }
        new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__g.lt.push([Math.round(e.startTime), Math.round(e.duration)]) }).observe({ type: 'longtask', buffered: true })
        const gc = HTMLCanvasElement.prototype.getContext
        HTMLCanvasElement.prototype.getContext = function (t, ...a) { const s = performance.now(); const r = gc.call(this, t, ...a); if (/webgl/.test(t)) window.__g.ctx.push([Math.round(s), +(performance.now() - s).toFixed(0)]); return r }
        const P = WebGL2RenderingContext.prototype
        for (const m of ['getShaderParameter', 'getProgramParameter']) { const o = P[m]; P[m] = function (...a) { const s = performance.now(); const r = o.apply(this, a); window.__g.status += performance.now() - s; return r } }
        const d = P.drawArrays
        P.drawArrays = function (...a) { if (!window.__g.first) window.__g.first = Math.round(performance.now()); return d.apply(this, a) }
      })
      const page = await ctx.newPage()
      await page.goto(url, { waitUntil: 'load' })
      await page.locator('[data-screen-frame][data-screen="home"]').waitFor()
      await page.waitForTimeout(2500)
      const r = await page.evaluate(() => ({ fcp: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? -1), ...window.__g, status: Math.round(window.__g.status) }))
      rows.push(r)
      await browser.close()
    }
    const med = (k) => { const v = rows.map(k).sort((a, b) => a - b); return v[Math.floor(v.length / 2)] }
    const maxLt = (r) => Math.max(0, ...r.lt.filter(([s]) => s < 1500).map(([, d]) => d))
    for (const r of rows) console.log(`${dev.padEnd(7)} ${label} fcp=${r.fcp} ctx@${r.ctx[0]?.[0]}+${r.ctx[0]?.[1]} statusWait=${r.status} firstDraw=${r.first} longtasks=${JSON.stringify(r.lt.filter(([s]) => s < 1500))}`)
    console.log(`${dev.padEnd(7)} ${label} MEDIAN fcp=${med((r) => r.fcp)} statusWait=${med((r) => r.status)} maxLongTask<1.5s=${med(maxLt)} fcpBeforeCtx=${rows.filter((r) => r.fcp <= (r.ctx[0]?.[0] ?? 1e9)).length}/${rows.length}\n`)
  }
}
