// Sample text contrast from screenshots: bg = median pixel of the rect, fg = the pixel with the highest contrast vs bg.
// Usage: node contrast.mjs <png> x,y,w,h[,label] ...   (CSS px of a DPR-1 screenshot; add @2 for DPR 2)
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const [png, ...rects] = process.argv.slice(2)
const b64 = readFileSync(png).toString('base64')
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage()
const out = await page.evaluate(async ({ b64, rects }) => {
  const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode()
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
  const g = c.getContext('2d'); g.drawImage(img, 0, 0)
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  const L = (r, gg, b) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b)
  return rects.map((spec) => {
    const [x, y, w, h, label] = spec.split(',')
    const d = g.getImageData(+x, +y, +w, +h).data
    const px = []
    for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2], L(d[i], d[i + 1], d[i + 2])])
    const sorted = [...px].sort((a, b) => a[3] - b[3])
    const bg = sorted[Math.floor(sorted.length * 0.3)]
    let best = 1, fg = bg
    for (const p of px) { const hi = Math.max(p[3], bg[3]), lo = Math.min(p[3], bg[3]); const r = (hi + 0.05) / (lo + 0.05); if (r > best) { best = r; fg = p } }
    const hex = (p) => '#' + p.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('')
    return `${label ?? spec}: fg ${hex(fg)} bg ${hex(bg)} contrast ${best.toFixed(2)}`
  })
}, { b64, rects })
console.log(out.join('\n'))
await browser.close()
