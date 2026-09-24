// node scripts/fix-lobby/crop.mjs in.png out.png x y w h  (uses Chrome to crop via canvas)
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'
const [inp, out, x, y, w, h, scale = '2'] = process.argv.slice(2)
const b64 = readFileSync(inp).toString('base64')
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage()
const data = await page.evaluate(async ({ b64, x, y, w, h, scale }) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
  const c = document.createElement('canvas'); c.width = w * scale; c.height = h * scale
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, x, y, w, h, 0, 0, w * scale, h * scale)
  return c.toDataURL('image/png').split(',')[1]
}, { b64, x: +x, y: +y, w: +w, h: +h, scale: +scale })
writeFileSync(out, Buffer.from(data, 'base64'))
await browser.close()
