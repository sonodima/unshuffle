// Clicks through the dock: host Esci → confirm modal → Chiudi stanza; host Rigioca; guest Esci.
import { chromium } from 'playwright'
const OUT = new URL('../fix-final/shots/', import.meta.url).pathname
const browser = await chromium.launch({ channel: 'chrome' })
const errors = []
const log = []
async function page(me, viewport = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 })
  const p = await ctx.newPage()
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`) })
  p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  await p.goto(`http://localhost:5405/lab/final.html?me=${me}&celebrate=0`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(2600)
  return p
}
const labLog = (p) => p.evaluate(() => window.__labLog.join(','))

let p = await page('p-host')
await p.getByRole('button', { name: 'Esci' }).click()
await p.waitForTimeout(600)
await p.screenshot({ path: `${OUT}i-phone-leave-modal.png` })
log.push('modal visible: ' + (await p.getByRole('dialog').isVisible()))
await p.getByRole('button', { name: 'Annulla' }).click()
await p.waitForTimeout(500)
log.push('after cancel log=' + (await labLog(p)))
await p.getByRole('button', { name: 'Esci' }).click()
await p.waitForTimeout(500)
await p.getByRole('button', { name: 'Chiudi stanza' }).click()
await p.waitForTimeout(300)
log.push('after confirm log=' + (await labLog(p)))
await p.getByRole('button', { name: 'Rigioca' }).click()
await p.getByRole('button', { name: 'Rigioca' }).click({ force: true }).catch(() => {})
await p.waitForTimeout(300)
log.push('after rigioca x2 log=' + (await labLog(p)))
// Winner cheer + keyboard focus on a song link
await p.getByRole('button', { name: /Festeggia/ }).click()
await p.waitForTimeout(300)
await p.context().close()

p = await page('p-3')
log.push('guest has rigioca: ' + (await p.getByRole('button', { name: 'Rigioca' }).count()))
log.push('guest status: ' + (await p.getByText('In attesa dell’host per rigiocare…').count()))
await p.getByRole('button', { name: 'Esci' }).click()
await p.waitForTimeout(300)
log.push('guest leave log=' + (await labLog(p)))
// horizontal scroll of the breakdown table
const sc = await p.evaluate(() => {
  const el = document.querySelector('.fp-scroll')
  el.scrollIntoView({ block: 'center' })
  const before = el.dataset.moreRight
  el.scrollLeft = el.scrollWidth
  return { before, sw: el.scrollWidth, cw: el.clientWidth, docW: document.documentElement.scrollWidth }
})
await p.waitForTimeout(400)
log.push('table: ' + JSON.stringify(sc) + ' after=' + (await p.evaluate(() => document.querySelector('.fp-scroll').dataset.moreRight)))
await p.screenshot({ path: `${OUT}i-phone-table-scrolled.png` })
await p.context().close()

p = await page('p-host', { width: 1440, height: 900 })
await p.keyboard.press('Tab')
await p.keyboard.press('Tab')
await p.waitForTimeout(200)
log.push('focus: ' + (await p.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent)))
await p.getByRole('button', { name: 'Esci' }).click()
await p.waitForTimeout(600)
await p.screenshot({ path: `${OUT}i-desk-leave-modal.png` })
await p.context().close()

await browser.close()
console.log(log.join('\n'))
console.log(errors.length ? errors.join('\n') : 'no console errors')
