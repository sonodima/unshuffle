// Count Paint / Layout trace events per second for a lab view (no shader: bg=css).
// node scripts/fix-ui/paints.mjs "view=perf&which=bar&bg=css"
import { chromium } from 'playwright'
const qs = process.argv[2] ?? 'view=perf&which=bar&bg=css'
const SECS = 3
const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
await page.goto(`http://localhost:5407/lab/fix-ui.html?${qs}`, { waitUntil: 'load' })
await page.waitForTimeout(1500)
await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline'] })
await page.waitForTimeout(SECS * 1000)
const buf = await browser.stopTracing()
const events = JSON.parse(buf.toString()).traceEvents
const count = (n) => events.filter((e) => e.name === n && e.ph !== 'E').length
console.log(qs, Object.fromEntries(['Paint', 'Layout', 'UpdateLayoutTree', 'PrePaint', 'RasterTask'].map((n) => [n, +(count(n) / SECS).toFixed(1)])))
await browser.close()
