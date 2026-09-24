// Zoomed crop: node scripts/round/zoom.mjs "<qs>" <name> <x> <y> <w> <h> [device]
import { chromium } from 'playwright'
const [qs, name, x, y, w, h, device = 'phone'] = process.argv.slice(2)
const devices = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
}
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage(devices[device])
await page.goto(`http://localhost:5212/lab/round.html?ui=0&bg=shader&${qs}`)
await page.waitForTimeout(1600)
await page.screenshot({ path: new URL(`./shots/z-${name}.png`, import.meta.url).pathname, clip: { x: +x, y: +y, width: +w, height: +h } })
await browser.close()
