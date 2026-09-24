import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const p = await ctx.newPage()
await p.goto(`http://localhost:5405/lab/fix-final.html?me=p-host&celebrate=0`, { waitUntil: 'load' })
await p.waitForTimeout(3000)
await p.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Rigioca'))
  window.__b = b
})
await p.getByRole('button', { name: 'Rigioca' }).click()
await p.waitForTimeout(50)
const info = await p.evaluate(() => ({
  sameConnected: window.__b.isConnected,
  names: [...document.querySelectorAll('button')].filter((b) => b.textContent.includes('Rigioca')).map((b) => [b === window.__b, b.getAttribute('aria-busy'), b.innerText]),
}))
console.log(JSON.stringify(info))
const loc = p.getByRole('button', { name: 'Rigioca' })
console.log('matches', await loc.count(), await loc.evaluateAll((els) => els.map((e) => [e === window.__b, e.getAttribute('aria-busy')])))
await browser.close()
