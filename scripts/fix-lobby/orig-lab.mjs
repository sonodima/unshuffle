import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome' })
for (const [w, h, q] of [[1440, 900, 'role=host&pl=1'], [390, 844, 'role=guest&pl=0'], [1280, 720, 'role=guest&pl=1']]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e)))
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errs.push(m.text()))
  await page.goto(`http://127.0.0.1:5403/lab/lobby.html?${q}`, { waitUntil: 'load' })
  await page.waitForTimeout(1500)
  console.log(w, h, q, errs.length ? errs : 'no errors', await page.locator('h2').allTextContents())
  await page.close()
}
await browser.close()
