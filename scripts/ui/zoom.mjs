// Element screenshot at high DPR. Usage: node scripts/ui/zoom.mjs out.png "css selector" [width] [dpr] [waitMs] [scrollToId]
import { chromium } from 'playwright'
const [out, sel, w = '1440', dpr = '2', wait = '3000', scrollId] = process.argv.slice(2)
const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: Number(w), height: 900 }, deviceScaleFactor: Number(dpr) })
const page = await ctx.newPage()
await page.goto('http://localhost:5201/lab/ui.html', { waitUntil: 'networkidle' })
if (scrollId) await page.evaluate((i) => document.getElementById(i)?.scrollIntoView({ block: 'start' }), scrollId)
await page.waitForTimeout(Number(wait))
await page.locator(sel).first().screenshot({ path: new URL('./shots/' + out, import.meta.url).pathname })
await browser.close()
