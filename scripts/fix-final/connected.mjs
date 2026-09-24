import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome' })
const errors = []
for (const me of ['p-host', 'p-3']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const p = await ctx.newPage()
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`) })
  p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  await p.goto(`http://localhost:5405/lab/final.html?connected=1&ui=0&me=${me}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(3200)
  const title = await p.locator('#fp-title').textContent()
  if (me === 'p-host') await p.getByRole('button', { name: 'Rigioca' }).click()
  await p.getByRole('button', { name: 'Esci' }).click()
  await p.waitForTimeout(400)
  if (me === 'p-host') await p.getByRole('button', { name: 'Chiudi stanza' }).click()
  await p.waitForTimeout(200)
  console.log(me, title, await p.evaluate(() => window.__labCalls.join(' | ')))
  if (me === 'p-host') await p.screenshot({ path: new URL('../fix-final/shots/connected-phone.png', import.meta.url).pathname })
  await ctx.close()
}
await browser.close()
console.log(errors.length ? errors.join('\n') : 'no console errors')
