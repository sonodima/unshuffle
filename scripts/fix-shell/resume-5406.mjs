// Real store: a stale client session in sessionStorage → boot resume → overlay → failure modal.
import { chromium } from 'playwright'
const OUT = '/Users/tom/Developer/vibes/oooo/scripts/fix-shell/shots/'
const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await ctx.addInitScript(() => {
  if (!sessionStorage.getItem('__seeded')) {
    sessionStorage.setItem('unshuffle:session', JSON.stringify({ role: 'client', code: 'ZZZZQ' }))
    sessionStorage.setItem('__seeded', '1')
  }
  localStorage.setItem('unshuffle:onboarded', String(Date.now()))
})
const page = await ctx.newPage()
const logs = []
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`${m.type()} ${m.text().slice(0, 300)}`))
page.on('pageerror', (e) => logs.push(`pageerror ${e.message}`))
const t0 = Date.now()
await page.goto('http://localhost:5406/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1200)
const overlay = await page.getByText('Riconnessione').count()
console.log('overlay visible at 1.2s:', overlay > 0)
await page.screenshot({ path: `${OUT}real-resume-phone.png` })
// A room that never existed: after the resume retries, it is reported as gone.
const modal = page.getByRole('dialog', { name: /Stanza non più disponibile|Impossibile rientrare/ })
try {
  await modal.waitFor({ timeout: 30000 })
  console.log('failure modal after', Date.now() - t0, 'ms')
  console.log(await modal.innerText())
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}real-resume-failed-phone.png` })
  await page.getByRole('button', { name: 'Ok' }).click()
  await page.waitForTimeout(500)
  console.log('modal closed:', (await modal.count()) === 0)
} catch (e) {
  console.log('no failure modal:', e.message)
  await page.screenshot({ path: `${OUT}real-resume-failed-phone.png` })
}
await browser.close()
console.log(logs.join('\n') || 'no console errors')
