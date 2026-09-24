// FOUT/CLS on Slow 4G (phone): screenshots before/after webfonts, layout-shift entries.
import { chromium } from 'playwright'
const OUT = new URL('./shots/', import.meta.url).pathname
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
for (const device of ['phone', 'desktop']) {
  const ctx = await browser.newContext(device === 'phone' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } })
  await ctx.addInitScript(() => {
    try { localStorage.setItem('unshuffle:onboarded', '1') } catch {}
    window.__ls = []
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__ls.push({ t: Math.round(e.startTime), v: +e.value.toFixed(4), input: e.hadRecentInput, src: e.sources?.map((s) => s.node?.nodeName + '.' + String(s.node?.className ?? '').slice(0, 40)).join(',') }) }).observe({ type: 'layout-shift', buffered: true })
  })
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 562.5, downloadThroughput: 1.44e6 / 8, uploadThroughput: 675e3 / 8 })
  await page.goto('http://127.0.0.1:5318/', { waitUntil: 'commit' })
  await page.locator('[data-screen-frame][data-screen="home"]').waitFor({ timeout: 60000 })
  await page.waitForTimeout(250)
  const f1 = await page.evaluate(() => [...document.fonts].map((f) => `${f.family.split(' ')[0]}:${f.status}`).filter((x) => !x.endsWith('unloaded')).join(' '))
  await page.screenshot({ path: `${OUT}fout-${device}-before-fonts.png` })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${OUT}fout-${device}-after-fonts.png` })
  const ls = await page.evaluate(() => window.__ls)
  const cls = ls.filter((x) => !x.input).reduce((a, x) => a + x.v, 0)
  console.log(device, 'fonts at first shot:', f1, '| CLS', cls.toFixed(3), JSON.stringify(ls))
  await ctx.close()
}
await browser.close()
