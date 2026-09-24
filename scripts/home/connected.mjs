// Real store integration from Home (uses the public PeerJS server). Usage: node scripts/home/connected.mjs
import { chromium } from 'playwright'
const OUT = new URL('./shots/', import.meta.url).pathname
const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
await ctx.addInitScript(() => localStorage.setItem('unshuffle:onboarded', '1'))
const page = await ctx.newPage()
const logs = []
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`))
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`))
await page.goto('http://127.0.0.1:5210/lab/home.html?connected=1', { waitUntil: 'load' })
await page.waitForTimeout(1200)

// Join a room that does not exist → inline error.
const boxes = page.getByRole('group', { name: 'Codice stanza' }).locator('input')
await boxes.first().tap()
await page.keyboard.type('ZZZZZ')
await page.getByRole('button', { name: 'Entra' }).tap()
await page.waitForTimeout(300)
console.log('join pending:', await page.getByText('Mi collego alla stanza…').isVisible())
await page.waitForFunction(() => document.querySelector('[role="alert"]')?.textContent, null, { timeout: 25000 }).catch(() => {})
console.log('join error:', await page.evaluate(() => [...document.querySelectorAll('[role="alert"]')].map((e) => e.textContent).join(' | ')))
await page.screenshot({ path: `${OUT}conn-join-error.png` })

// Create a room → store gets a room code (the shell would switch screen here).
await page.getByRole('button', { name: 'Crea stanza' }).tap()
await page.waitForTimeout(300)
console.log('create pending:', await page.getByText('Apro la stanza…').isVisible())
await page.waitForFunction(() => /#\/r\/[A-Z]{5}/.test(location.hash), null, { timeout: 25000 }).catch(() => {})
console.log('hash after create:', await page.evaluate(() => location.hash))
await browser.close()
console.log(logs.filter((l) => /^(error|warning|pageerror)/.test(l)).join('\n') || 'no console errors')
