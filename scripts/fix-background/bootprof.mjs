// CPU profile of the first ~1 s of boot: top self-time functions (fresh browser).
import { chromium } from 'playwright'
const URL_ = process.argv[2] ?? 'http://localhost:5463/'
const phone = process.env.PHONE === '1'
const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(() => { try { localStorage.setItem('unshuffle:onboarded', '1') } catch {} })
const page = await ctx.newPage()
const cdp = await ctx.newCDPSession(page)
await cdp.send('Profiler.enable')
await cdp.send('Profiler.setSamplingInterval', { interval: 200 })
await cdp.send('Profiler.start')
await page.goto(URL_, { waitUntil: 'load' })
await page.waitForTimeout(1200)
const { profile } = await cdp.send('Profiler.stop')
const byId = new Map(profile.nodes.map((n) => [n.id, n]))
const self = new Map()
const dts = profile.timeDeltas
for (let i = 0; i < profile.samples.length; i++) {
  const n = byId.get(profile.samples[i])
  const f = n.callFrame
  const key = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber}`
  self.set(key, (self.get(key) ?? 0) + (dts[i] ?? 0) / 1000)
}
const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)
for (const [k, v] of top) console.log(v.toFixed(1).padStart(7), 'ms ', k)
await browser.close()
