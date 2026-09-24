import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await ctx.addInitScript(() => { try { localStorage.setItem('unshuffle:onboarded', '1') } catch {} })
const page = await ctx.newPage()
await page.goto('http://localhost:5407/'); await page.locator('[data-screen-frame][data-screen="home"]').waitFor()
await page.getByRole('button', { name: 'Crea stanza', exact: true }).click()
await page.locator('[data-screen-frame][data-screen="lobby"]').waitFor({ timeout: 30000 }); await page.waitForTimeout(1500)
console.log(await page.evaluate(() => {
  const el = document.elementFromPoint(250, 745)
  const chain = []
  for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || e.className.toString().includes('glass')) chain.push(`${e.tagName} ${String(e.className).slice(0, 90)} | bg=${cs.backgroundColor} bf=${cs.backdropFilter} pos=${cs.position} z=${cs.zIndex}`) }
  return chain.join('\n')
}))
await browser.close()
