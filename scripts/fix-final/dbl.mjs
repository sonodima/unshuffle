import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome' })
for (const vp of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: vp.width < 600, hasTouch: vp.width < 600 })
  const p = await ctx.newPage()
  await p.goto(`http://localhost:5405/lab/${process.argv[2] ?? 'fix-final'}.html?me=p-host&celebrate=0`, { waitUntil: 'load' })
  await p.waitForTimeout(3000)
  const n = await p.getByRole('button', { name: 'Rigioca' }).count()
  await p.getByRole('button', { name: 'Rigioca' }).click()
  const html = await p.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.textContent.includes('Rigioca')).map((b) => `${b.disabled}|${b.getAttribute('aria-busy')}`))
  if (process.argv[3] !== 'single') await p.getByRole('button', { name: 'Rigioca' }).click({ force: true }).catch((e) => console.log('2nd click err', e.message.slice(0, 80)))
  await p.waitForTimeout(300)
  console.log(vp.width, 'buttons', n, html, await p.evaluate(() => window.__labLog.join(',')))
  await ctx.close()
}
await browser.close()
