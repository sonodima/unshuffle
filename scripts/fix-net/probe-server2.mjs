import { chromium } from 'playwright'
const URL = process.env.NET_LAB_URL ?? 'http://localhost:5409/lab/fix-net.html'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('pageerror', e.message))
await page.goto(URL)
await page.waitForFunction(() => !!window.netLab)
console.log('A/B alternating, 300ms:', await page.evaluate(() => window.netLab.probeSources(3, 300)))
console.log('raw OFFER probe:', await page.evaluate(() => window.netLab.probeRawOffer(5)))
await browser.close()
