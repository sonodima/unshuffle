// QA "code": does Chrome throttle timers of a hidden tab here? (Playwright disables it by default.)
// node scripts/qa-code/throttle-probe.mjs
import { chromium } from 'playwright'
const browser = await chromium.launch({
  channel: 'chrome',
  headless: process.env.HEADED ? false : true,
  ignoreDefaultArgs: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
})
const ctx = await browser.newContext()
const a = await ctx.newPage()
await a.goto('http://127.0.0.1:5305/')
const b = await ctx.newPage()
await b.goto('about:blank')
await b.bringToFront()
await a.waitForTimeout(1500)
const vis = await a.evaluate(() => document.visibilityState)
const lat = await a.evaluate(async () => {
  const out = []
  for (let i = 0; i < 6; i++) {
    const t = performance.now()
    await new Promise((r) => setTimeout(r, 50))
    out.push(Math.round(performance.now() - t))
  }
  return out
})
console.log(JSON.stringify({ visibility: vis, setTimeout50msLatencies: lat }))
await browser.close()
