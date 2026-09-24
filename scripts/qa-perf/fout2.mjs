// FOUT on Slow 4G (phone, 1x CPU): CDP screenshots (Playwright's page.screenshot waits for fonts, so
// the old fout.mjs shots were always post-swap), resource start/end timing for fonts vs lazy chunks, CLS.
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
const OUT = new URL('./shots/', import.meta.url).pathname
const CPU = Number(process.env.CPU ?? 1)
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
await ctx.addInitScript(() => {
  try { localStorage.setItem('unshuffle:onboarded', '1') } catch {}
  window.__ls = []
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__ls.push({ t: Math.round(e.startTime), v: +e.value.toFixed(4), src: e.sources?.map((s) => s.node?.nodeName + '.' + String(s.node?.className ?? '').slice(0, 30)).join(',') }) }).observe({ type: 'layout-shift', buffered: true })
})
const page = await ctx.newPage()
const cdp = await ctx.newCDPSession(page)
await cdp.send('Network.enable')
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 562.5, downloadThroughput: 1.44e6 / 8, uploadThroughput: 675e3 / 8 })
if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
const t0 = Date.now()
await page.goto('http://127.0.0.1:5318/', { waitUntil: 'commit' })
await page.locator('[data-screen-frame][data-screen="home"]').waitFor({ timeout: 60000 })
const log = []
let shot = 0
for (let i = 0; i < 14; i++) {
  const st = await page.evaluate(() => ({ t: Math.round(performance.now()), fonts: [...document.fonts].filter((f) => f.status !== 'unloaded').map((f) => `${f.family.split(' ')[0]}:${f.status}`).join(' ') }))
  if (i === 0 || i === 3) {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' })
    const p = `${OUT}fout2-phone-t${st.t}.png`
    writeFileSync(p, Buffer.from(data, 'base64'))
    st.shot = p
  }
  log.push(st)
  if (!st.fonts.includes('loading') && i > 3) break
  await page.waitForTimeout(250)
}
const res = await page.evaluate(() => performance.getEntriesByType('resource').map((r) => `${r.name.split('/').pop().split('?')[0].replace(/-[A-Za-z0-9_-]{8}\./, '.')} start ${Math.round(r.startTime)} end ${Math.round(r.responseEnd)} ${Math.round(r.transferSize / 1024)}K`))
const fcp = await page.evaluate(() => Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0))
const ls = await page.evaluate(() => window.__ls)
console.log('FCP', fcp, 'CPU', CPU)
for (const l of log) console.log(JSON.stringify(l))
console.log(res.join('\n'))
console.log('layout shifts', JSON.stringify(ls), 'CLS', ls.reduce((a, x) => a + x.v, 0).toFixed(4))
await browser.close()
