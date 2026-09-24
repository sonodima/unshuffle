// Inline ↔ floating dock swap: exactly one "Rigioca" in the a11y tree at the top, at the bottom and back.
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://localhost:5405'
const browser = await chromium.launch({ channel: 'chrome' })
const out = []
for (const vp of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 844, height: 390 }, { width: 390, height: 844 }]) {
  const ctx = await browser.newContext({ viewport: vp })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/lab/fix-final.html?ui=0&me=p-host&celebrate=0`, { waitUntil: 'load' })
  await p.waitForTimeout(3200)
  const count = () => p.getByRole('button', { name: 'Rigioca' }).count()
  const scroll = (y) => p.evaluate((y) => document.querySelector('main').parentElement.scrollTo(0, y === 'max' ? 1e6 : y), y)
  const top = await count()
  await scroll('max'); await p.waitForTimeout(700)
  const bottom = await count()
  const floatBox = await p.getByRole('button', { name: 'Rigioca' }).boundingBox()
  await scroll(0); await p.waitForTimeout(700)
  const back = await count()
  const inlineBox = await p.getByRole('button', { name: 'Rigioca' }).boundingBox()
  await p.getByRole('button', { name: 'Rigioca' }).click()
  const log1 = await p.evaluate(() => window.__labLog.join(','))
  out.push(`${vp.width}x${vp.height} top=${top} bottom=${bottom} (float y=${Math.round(floatBox?.y ?? -1)}) back=${back} (inline y=${Math.round(inlineBox?.y ?? -1)}) clicks=${log1}`)
  await ctx.close()
}
await browser.close()
console.log(out.join('\n'))
