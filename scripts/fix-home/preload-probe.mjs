// When does the PeerJS chunk load? Long tasks in the first 2.5 s. node scripts/fix-home/preload-probe.mjs [base] [mode=idle|hover|focus|touch]
import { chromium } from 'playwright'
const BASE = process.argv[2] ?? 'http://127.0.0.1:5454/'
const mode = process.argv[3] ?? 'idle'
const browser = await chromium.launch({ channel: 'chrome' })
const touch = mode === 'touch'
const ctx = await browser.newContext(touch ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(() => {
  try { localStorage.setItem('unshuffle:onboarded', '1') } catch {}
  window.__lt = []
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]) }).observe({ type: 'longtask', buffered: true })
})
const page = await ctx.newPage()
const t0 = Date.now()
let peerAt = null
page.on('request', (r) => { if (/bundler-[\w-]+\.js$/.test(r.url()) && peerAt === null) peerAt = Date.now() - t0 })
await page.goto(BASE, { waitUntil: 'load' })
await page.locator('[data-screen-frame][data-screen="home"]').waitFor()
if (mode === 'hover') { await page.waitForTimeout(800); await page.getByRole('button', { name: 'Crea stanza', exact: true }).hover(); console.log('hovered at', Date.now() - t0) }
if (mode === 'focus') { await page.waitForTimeout(800); await page.locator('input[aria-label*="odice"], input[inputmode="text"]').first().focus().catch(() => {}); console.log('focused at', Date.now() - t0) }
if (mode === 'touch') { await page.waitForTimeout(800); await page.getByRole('button', { name: 'Entra', exact: true }).tap(); console.log('tapped Entra at', Date.now() - t0) }
await page.waitForTimeout(6000)
const lt = await page.evaluate(() => window.__lt)
console.log(`mode=${mode} peerjs chunk requested at ${peerAt} ms; long tasks [start,dur]: ${JSON.stringify(lt)}`)
await browser.close()
