import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage()
await page.goto('about:blank')
const r = await page.evaluate(() => {
  const t0 = performance.now()
  const size = 128
  const c = document.createElement('canvas'); c.width = c.height = size
  const g = c.getContext('2d'); const img = g.createImageData(size, size)
  let s = 0x2545f491; const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296 }
  for (let i = 0; i < size * size; i++) { const n = rnd() + rnd() + rnd() - 1.5; const v = n > 0 ? 255 : 0; img.data[i*4] = img.data[i*4+1] = img.data[i*4+2] = v; img.data[i*4+3] = Math.min(255, Math.round(Math.abs(n) * 1.6 * 255)) }
  g.putImageData(img, 0, 0); const t1 = performance.now(); const url = c.toDataURL('image/png'); const t2 = performance.now()
  return { gen: +(t1 - t0).toFixed(2), encode: +(t2 - t1).toFixed(2), bytes: url.length }
})
console.log(JSON.stringify(r))
await browser.close()
