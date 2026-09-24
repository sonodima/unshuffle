import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome' })
for (const w of [1024, 1100, 1180, 1280, 1440]) {
  const p = await browser.newPage({ viewport: { width: w, height: 800 } })
  await p.goto('http://localhost:5405/lab/fix-final.html?ui=0&v=final&celebrate=0', { waitUntil: 'load' })
  await p.waitForTimeout(1500)
  const r = await p.evaluate(() => [...document.querySelectorAll('section[aria-labelledby="fp-awards"] h3')].map((h) => `${h.textContent}:${h.scrollWidth}/${h.clientWidth}`))
  console.log(w, r.join(' | '))
  await p.close()
}
await browser.close()
