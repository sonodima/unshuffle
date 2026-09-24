import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } })
const p = await ctx.newPage()
await p.goto(`http://localhost:5405/lab/fix-final.html?ui=0&me=p-host&celebrate=0`, { waitUntil: 'load' })
await p.waitForTimeout(3200)
for (const y of [300, 600, 1000, 'max']) {
  await p.evaluate((y) => document.querySelector('main').parentElement.scrollTo(0, y === 'max' ? 1e6 : y), y)
  await p.waitForTimeout(600)
  console.log(y, await p.evaluate(() => {
    const g = [...document.querySelectorAll('[role="group"][aria-label="Azioni"]')].map((e) => { const b = e.getBoundingClientRect(); return [Math.round(b.top), !!e.closest('[aria-hidden="true"]'), !!e.closest('.fixed')] })
    return JSON.stringify(g)
  }))
}
await browser.close()
