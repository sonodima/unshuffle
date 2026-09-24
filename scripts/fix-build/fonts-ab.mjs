// A/B/C of font preloading on a throttled phone load (same profile as qa-perf/fout2.mjs:
// 562.5 ms RTT, 1.44 Mbps down). For each variant: FCP, home frame visible, when each
// web font finished, whether the first paint already had the brand font, CDP shots.
// Usage: node scripts/fix-build/fonts-ab.mjs  (preview servers on 5465/5466/5467)
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = new URL('./shots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const VARIANTS = (process.env.VARIANTS ?? 'a:5465,b:5466,c:5467').split(',').map((s) => s.split(':'))
const RUNS = Number(process.env.RUNS ?? 3)
const CPU = Number(process.env.CPU ?? 1)

const browser = await chromium.launch({ channel: 'chrome' })
const results = {}
for (let run = 0; run < RUNS; run++) {
  for (const [name, port] of VARIANTS) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem('unshuffle:onboarded', '1')
      } catch {}
    })
    const page = await ctx.newPage()
    const cdp = await ctx.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 562.5, downloadThroughput: 1.44e6 / 8, uploadThroughput: 675e3 / 8 })
    if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'commit' })
    await page.locator('[data-screen-frame][data-screen="home"]').waitFor({ timeout: 60000 })
    const homeAt = await page.evaluate(() => Math.round(performance.now()))
    if (run === 0) {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(`${OUT}fonts-${name}-home.png`, Buffer.from(data, 'base64'))
    }
    await page.waitForFunction(() => document.fonts.status === 'loaded' && [...document.fonts].some((f) => f.status === 'loaded'), null, { timeout: 60000 })
    await page.waitForTimeout(300)
    const m = await page.evaluate(() => {
      const res = performance.getEntriesByType('resource')
      const pick = (re) => {
        const r = res.find((x) => re.test(x.name))
        return r ? { start: Math.round(r.startTime), end: Math.round(r.responseEnd), kb: Math.round(r.transferSize / 1024) } : null
      }
      return {
        fcp: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0),
        indexJs: pick(/\/index-[\w-]+\.js$/),
        css: pick(/\/index-[\w-]+\.css$/),
        unbounded: pick(/unbounded-latin/),
        manrope: pick(/manrope-latin/),
        lcp: 0,
      }
    })
    m.home = homeAt
    m.unboundedAtFcp = m.unbounded ? m.unbounded.end <= m.fcp : null
    m.settled = Math.max(m.fcp, m.unbounded?.end ?? 0, m.manrope?.end ?? 0)
    ;(results[name] ??= []).push(m)
    console.log(name, run, JSON.stringify(m))
    await ctx.close()
  }
}
const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
console.log('\nmedians (ms)')
for (const [name] of VARIANTS) {
  const r = results[name]
  console.log(
    name,
    `FCP ${med(r.map((x) => x.fcp))}`,
    `index.js end ${med(r.map((x) => x.indexJs?.end ?? 0))}`,
    `Unbounded end ${med(r.map((x) => x.unbounded?.end ?? 0))}`,
    `Manrope end ${med(r.map((x) => x.manrope?.end ?? 0))}`,
    `settled ${med(r.map((x) => x.settled))}`,
    `brand font at FCP ${r.filter((x) => x.unboundedAtFcp).length}/${r.length}`,
  )
}
await browser.close()
