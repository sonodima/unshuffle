// Throttled phone load of the snapshot (562 ms RTT, 1.44 Mbps, like fonts-ab.mjs):
// CDP screenshots every ~250 ms from navigation to the settled home, to see the
// boot screen → home hand-over. Usage: node scripts/fix-build/boot-throttle.mjs
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
const OUT = new URL('./shots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const BASE = process.env.BASE ?? 'http://localhost:5474/'
const CPU = Number(process.env.CPU ?? 1)
const browser = await chromium.launch({ channel: 'chrome' })
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
await page.goto(BASE, { waitUntil: 'commit' })
const frames = []
for (let i = 0; i < 24; i++) {
  const st = await page
    .evaluate(() => {
      const b = document.getElementById('boot')
      const cs = b ? getComputedStyle(b) : null
      return {
        t: Math.round(performance.now()),
        boot: cs ? (cs.display === 'none' ? 'hidden' : `opacity ${Number(cs.opacity).toFixed(2)}`) : 'absent',
        home: !!document.querySelector('[data-screen-frame][data-screen="home"]'),
        fcp: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0),
      }
    })
    .catch(() => null)
  if (st) {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 60 })
    const file = `${OUT}boot-t${String(st.t).padStart(5, '0')}.jpg`
    writeFileSync(file, Buffer.from(data, 'base64'))
    frames.push({ ...st, file: file.split('/').pop() })
    console.log(JSON.stringify(frames.at(-1)))
    if (st.home && frames.filter((f) => f.home).length > 2) break
  }
  await page.waitForTimeout(200)
}
await browser.close()
