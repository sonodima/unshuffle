// Contact sheet of screenshots: node scripts/round/contact.mjs <glob-prefix> <out.png> [cols] [cellWidth]
import { chromium } from 'playwright'
import { readdirSync, writeFileSync, unlinkSync } from 'node:fs'

const DIR = new URL('./shots/', import.meta.url).pathname
const [prefix, out, cols = '5', cell = '300'] = process.argv.slice(2)
const files = readdirSync(DIR).filter((f) => f.startsWith(prefix) && f.endsWith('.png') && f !== out).sort()
const html = `<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(${cols},${cell}px);gap:6px;padding:6px;font:11px monospace;color:#ccc">${files
  .map((f) => `<figure style="margin:0"><img src="${f}" style="width:${cell}px;display:block"><figcaption>${f}</figcaption></figure>`)
  .join('')}</body>`
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: Number(cols) * (Number(cell) + 6) + 6, height: 400 } })
const tmp = `${DIR}.contact.html`
writeFileSync(tmp, html)
await page.goto(`file://${tmp}`)
await page.waitForLoadState('load')
await page.waitForTimeout(300)
await page.screenshot({ path: `${DIR}${out}`, fullPage: true })
await browser.close()
unlinkSync(tmp)
console.log(files.length, 'images →', out)
