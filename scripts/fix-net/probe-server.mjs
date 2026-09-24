// Probes the public PeerJS server: are offers to unknown ids always answered
// with peer-unavailable? Does a bare CANDIDATE come back as EXPIRE?
import { chromium } from 'playwright'
const URL = process.env.NET_LAB_URL ?? 'http://localhost:5409/lab/fix-net.html'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('pageerror', e.message))
await page.goto(URL)
await page.waitForFunction(() => !!window.netLab)
console.log('same target, 700ms apart:', await page.evaluate(() => window.netLab.probeUnknown(6, 700, true)))
console.log('fresh targets, 700ms apart:', await page.evaluate(() => window.netLab.probeUnknown(6, 700, false)))
console.log('same target, back to back:', await page.evaluate(() => window.netLab.probeUnknown(4, 0, true)))
console.log('candidate probe:', await page.evaluate(() => window.netLab.probeCandidate(5)))
await browser.close()
