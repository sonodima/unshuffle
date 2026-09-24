// The reveal mounts an inline sound control in its header: the shell's floating one must hide.
import { chromium } from 'playwright'
const base = process.env.BASE ?? 'http://localhost:5402/lab/fix-reveal.html'
const browser = await chromium.launch({ channel: 'chrome' })
let ok = true
for (const vp of [{ width: 360, height: 740 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
  const page = await browser.newPage({ viewport: vp })
  await page.goto(`${base}?me=p-host&audio=0`)
  await page.waitForSelector('.rv-root header')
  await page.waitForTimeout(800)
  const r = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button[aria-haspopup="dialog"]')].filter((b) => /Audio/.test(b.getAttribute('aria-label') ?? ''))
    return { total: btns.length, inHeader: btns.filter((b) => b.closest('.rv-root header')).length }
  })
  // Scroll to the bottom: nothing fixed may sit over the top-right block any more.
  const over = await page.evaluate(() => {
    const root = document.querySelector('.rv-root')
    root.scrollTop = 200
    const blocks = [...document.querySelectorAll('.rv-board .sb-item')]
    const hits = []
    for (const b of blocks) {
      const r = b.getBoundingClientRect()
      const el = document.elementFromPoint(r.right - 8, r.top + 8)
      if (el && !b.contains(el) && !el.closest('.rv-board')) hits.push(el.className?.toString().slice(0, 40))
    }
    return hits
  })
  const pass = r.total === 1 && r.inHeader === 1
  if (!pass) ok = false
  console.log(`${vp.width}x${vp.height}`, JSON.stringify(r), 'covered corners:', JSON.stringify(over), pass ? 'ok' : 'FAIL')
  await page.close()
}
await browser.close()
console.log(ok ? 'PASS' : 'FAILED')
