// Cold-load metrics on the static preview (vite preview :5318).
// node scripts/qa-perf/load.mjs [baseUrl]
import { chromium } from 'playwright'
const BASE = process.argv[2] ?? 'http://127.0.0.1:5318/'
const OUT = new URL('./shots/', import.meta.url).pathname
const NETS = {
  none: null,
  fast4g: { offline: false, latency: 165, downloadThroughput: (8.1e6) / 8, uploadThroughput: (1.35e6) / 8 },
  'slow4g/fast3g': { offline: false, latency: 562.5, downloadThroughput: (1.44e6) / 8, uploadThroughput: (675e3) / 8 },
}
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const results = []
for (const device of ['desktop', 'phone']) {
  for (const [netName, net] of Object.entries(NETS)) {
    for (const cpu of [1, 4]) {
      if (device === 'desktop' && cpu === 4 && netName !== 'none') continue
      const ctx = await browser.newContext(
        device === 'phone'
          ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
          : { viewport: { width: 1440, height: 900 } },
      )
      await ctx.addInitScript(() => {
        try { localStorage.setItem('unshuffle:onboarded', String(Date.now())) } catch {}
        window.__lt = []
        window.__lcp = 0
        try {
          new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push({ s: e.startTime, d: e.duration }) }).observe({ type: 'longtask', buffered: true })
          new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = { t: e.startTime, el: e.element?.tagName + '.' + (e.element?.className?.toString?.() ?? '').slice(0, 60), size: e.size } }).observe({ type: 'largest-contentful-paint', buffered: true })
        } catch {}
      })
      const page = await ctx.newPage()
      const cdp = await ctx.newCDPSession(page)
      await cdp.send('Network.enable')
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
      if (net) await cdp.send('Network.emulateNetworkConditions', net)
      if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
      await cdp.send('Performance.enable')
      const t0 = Date.now()
      await page.goto(BASE, { waitUntil: 'load', timeout: 120_000 })
      const tLoad = Date.now() - t0
      await page.locator('[data-screen-frame][data-screen="home"]').waitFor({ state: 'visible', timeout: 120_000 })
      const tHome = Date.now() - t0
      // CTA usable?
      await page.getByRole('button', { name: 'Crea stanza', exact: true }).waitFor({ state: 'visible', timeout: 60_000 })
      const tCta = Date.now() - t0
      await page.evaluate(() => document.fonts.ready)
      const tFonts = Date.now() - t0
      await page.waitForTimeout(3000)
      const m = await page.evaluate(() => {
        const paint = Object.fromEntries(performance.getEntriesByType('paint').map((e) => [e.name, Math.round(e.startTime)]))
        const nav = performance.getEntriesByType('navigation')[0]
        const res = performance.getEntriesByType('resource').map((r) => ({ n: r.name.split('/').pop().split('?')[0], t: r.initiatorType, size: r.transferSize || r.encodedBodySize, end: Math.round(r.responseEnd) }))
        const fonts = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.unicodeRange.slice(0, 18)}`)
        const lt = window.__lt
        const tbt = lt.filter((x) => x.s > (paint['first-contentful-paint'] ?? 0)).reduce((a, x) => a + Math.max(0, x.d - 50), 0)
        return { paint, lcp: window.__lcp, dcl: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd), res, fonts, longtasks: lt.map((x) => `${Math.round(x.s)}+${Math.round(x.d)}`), tbt: Math.round(tbt) }
      })
      const pm = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]))
      const bytes = m.res.reduce((a, r) => a + r.size, 0)
      const byType = {}
      for (const r of m.res) {
        const k = /\.woff2$/.test(r.n) ? 'font' : /\.js$/.test(r.n) ? 'js' : /\.css$/.test(r.n) ? 'css' : r.t
        byType[k] = (byType[k] ?? 0) + r.size
      }
      const row = {
        device, net: netName, cpu: `${cpu}x`,
        FCP: m.paint['first-contentful-paint'], LCP: Math.round(m.lcp?.t ?? 0), lcpEl: m.lcp?.el, DCL: m.dcl, load: m.load, homeVisible: tHome, ctaVisible: tCta, fontsReady: tFonts,
        TBT: m.tbt, longtasks: m.longtasks.join(' '),
        ScriptMs: Math.round(pm.ScriptDuration * 1000), TaskMs: Math.round(pm.TaskDuration * 1000), LayoutMs: Math.round(pm.LayoutDuration * 1000), RecalcStyleMs: Math.round(pm.RecalcStyleDuration * 1000),
        KB: Math.round(bytes / 1024), byTypeKB: Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, Math.round(v / 1024)])),
        fonts: m.fonts.join(' | '),
      }
      results.push(row)
      console.log(JSON.stringify(row))
      if (device === 'phone' && cpu === 4 && netName === 'slow4g/fast3g') {
        console.log('resources:', m.res.map((r) => `${r.n}:${Math.round(r.size / 1024)}K@${r.end}`).join(' '))
      }
      await ctx.close()
    }
  }
}
await browser.close()
