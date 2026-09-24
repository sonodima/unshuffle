// Zoomed capture of a region: node scripts/fix-ui/zoom.mjs <out> <query> <x> <y> <w> <h> [vw vh dpr]
import { chromium } from 'playwright'
const [out, qs, x, y, w, h, vw = 390, vh = 844, dpr = 4] = process.argv.slice(2)
const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: +vw, height: +vh }, deviceScaleFactor: +dpr, isMobile: +vw < 800, hasTouch: +vw < 800 })
const page = await ctx.newPage()
await page.goto(`${process.env.BASE ?? 'http://localhost:5407/lab/fix-ui.html'}?${qs}`, { waitUntil: 'load' })
await page.waitForTimeout(Number(process.env.WAIT ?? 1400))
await page.screenshot({ path: `scripts/fix-ui/shots/${out}.png`, clip: { x: +x, y: +y, width: +w, height: +h } })
await browser.close()
