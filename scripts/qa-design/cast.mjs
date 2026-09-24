// Record an animated lab page with CDP screencast and keep frames nearest to target times.
// Usage: node scripts/qa-design/cast.mjs <name> <path> <vp> <durationMs> <t1,t2,...>
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5303'
const OUT = new URL('./frames/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const [name, path, vpName, dur, times] = process.argv.slice(2)
const VP = {
  d1440: { viewport: { width: 1440, height: 900 } },
  d1280: { viewport: { width: 1280, height: 720 } },
  p390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
}
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const ctx = await browser.newContext(VP[vpName])
await ctx.addInitScript(() => { try { localStorage.setItem('unshuffle:onboarded', String(Date.now())) } catch {} })
const page = await ctx.newPage()
// warm the module graph
await page.goto(BASE + path, { waitUntil: 'load' })
await page.waitForTimeout(2500)
const cdp = await ctx.newCDPSession(page)
const frames = []
cdp.on('Page.screencastFrame', async (f) => {
  frames.push({ t: f.metadata.timestamp * 1000, data: f.data })
  try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }) } catch {}
})
const vp = VP[vpName].viewport
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, maxWidth: Number(process.env.MAXW ?? 960), maxHeight: 2000, everyNthFrame: 1 })
await page.waitForTimeout(300)
const tNav = Date.now()
await page.evaluate(() => location.reload())
await page.waitForTimeout(Number(dur))
await cdp.send('Page.stopScreencast')
// Frames carry wall-clock timestamps (s): relative to the reload request.
const rel = frames.map((f) => ({ ...f, r: f.t - tNav }))
console.log('frames', rel.length, 'first', Math.round(rel[0]?.r), 'last', Math.round(rel.at(-1)?.r))
// Find the first frame where the page has content (body painted) — approximate app mount at first frame after reload.
for (const target of times.split(',').map(Number)) {
  let best = null
  for (const f of rel) if (!best || Math.abs(f.r - target) < Math.abs(best.r - target)) best = f
  if (!best) continue
  const file = `${OUT}${name}-${String(target).padStart(5, '0')}.jpg`
  writeFileSync(file, Buffer.from(best.data, 'base64'))
  console.log(target, '->', Math.round(best.r), file)
}
if (process.env.ALL) rel.forEach((f, i) => writeFileSync(`${OUT}${name}-all-${String(Math.round(f.r)).padStart(5, '0')}.jpg`, Buffer.from(f.data, 'base64')))
await browser.close()
// (ALL=1 dumps every frame; see above)
