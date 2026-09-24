// Contact sheet: tile several images (with labels) into one PNG so a frame sequence can be read at once.
// Usage: node sheet.mjs <out.png> <cols> <cellW> <img1> <img2> ...   (label = file basename)
// Optional crop per image: path@x,y,w,h (source pixels)
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'
const [out, cols, cellW, ...imgs] = process.argv.slice(2)
const items = imgs.map((s) => {
  const [p, crop] = s.split('@')
  const ext = p.endsWith('.png') ? 'png' : 'jpeg'
  return { label: basename(p), src: `data:image/${ext};base64,${readFileSync(p).toString('base64')}`, crop: crop ? crop.split(',').map(Number) : null }
})
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage()
const b64 = await page.evaluate(async ({ items, cols, cellW }) => {
  const imgs = await Promise.all(items.map(async (it) => { const im = new Image(); im.src = it.src; await im.decode(); return im }))
  const cw = cellW
  const cells = imgs.map((im, i) => { const c = items[i].crop ?? [0, 0, im.width, im.height]; return { im, c, h: Math.round((cw * c[3]) / c[2]) } })
  const rows = Math.ceil(cells.length / cols)
  const rowH = []
  for (let r = 0; r < rows; r++) rowH.push(Math.max(...cells.slice(r * cols, r * cols + cols).map((c) => c.h)) + 22)
  const cv = document.createElement('canvas')
  cv.width = cols * (cw + 6) + 6
  cv.height = rowH.reduce((a, b) => a + b, 0) + 6
  const g = cv.getContext('2d')
  g.fillStyle = '#222'; g.fillRect(0, 0, cv.width, cv.height)
  let y = 6
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      const i = r * cols + k; if (i >= cells.length) break
      const { im, c, h } = cells[i]
      const x = 6 + k * (cw + 6)
      g.drawImage(im, c[0], c[1], c[2], c[3], x, y + 18, cw, h)
      g.fillStyle = '#ff0'; g.font = 'bold 14px sans-serif'; g.fillText(items[i].label, x + 2, y + 14)
    }
    y += rowH[r]
  }
  return cv.toDataURL('image/png').split(',')[1]
}, { items, cols: Number(cols), cellW: Number(cellW) })
writeFileSync(out, Buffer.from(b64, 'base64'))
await browser.close()
console.log('wrote', out)
