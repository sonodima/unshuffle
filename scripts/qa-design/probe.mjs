// Load a lab URL, print page errors/console errors and the body text length (smoke check).
import { chromium } from 'playwright'
const url = process.argv[2]
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.log('pageerror', e.message))
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console.' + m.type(), m.text().slice(0, 200)) })
await page.goto((process.env.BASE ?? 'http://[::1]:5303') + url, { waitUntil: 'load' })
await page.waitForTimeout(Number(process.argv[3] ?? 3000))
console.log('text:', (await page.evaluate(() => document.body.innerText)).slice(0, 300).replace(/\n/g, ' | '))
await browser.close()
