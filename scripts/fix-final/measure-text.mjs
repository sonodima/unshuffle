import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 400, height: 400 } })
await page.goto('http://localhost:5405/lab/fix-final.html?ui=0&v=final&celebrate=0', { waitUntil: 'load' })
await page.waitForTimeout(800)
const out = await page.evaluate(async () => {
  await document.fonts.ready
  const words = ['MASSIMILIANO', 'PINGUINO', 'CANTUCCI', 'ARAGOSTA', 'WWWWWWWW', 'LORENZO', 'MAGNIFICO', 'FEDERICO']
  const res = {}
  for (const font of ['800 12px Unbounded', '800 10px Unbounded', '800 12px Manrope']) {
    const c = document.createElement('canvas').getContext('2d')
    c.font = font
    res[font] = Object.fromEntries(words.map((w) => [w, Math.round(c.measureText(w).width)]))
  }
  return res
})
console.log(JSON.stringify(out, null, 1))
await browser.close()
