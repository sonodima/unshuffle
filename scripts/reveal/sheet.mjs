// Contact sheet of screenshots: node scripts/reveal/sheet.mjs out.png cols width img1 img2 ...
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const [out, cols = '3', width = '1500', ...files] = process.argv.slice(2)
const imgs = files.map((f) => `<figure><img src="data:image/png;base64,${readFileSync(f).toString('base64')}"><figcaption>${f.split('/').pop()}</figcaption></figure>`).join('')
const html = `<style>body{margin:0;background:#222;font:12px sans-serif;color:#ddd}main{display:grid;grid-template-columns:repeat(${cols},1fr);gap:6px;padding:6px;width:${width}px}img{width:100%;display:block}figure{margin:0}figcaption{padding:2px 0}</style><main>${imgs}</main>`
const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage({ viewport: { width: Number(width) + 12, height: 400 } })
await p.setContent(html)
await p.waitForTimeout(300)
await p.screenshot({ path: out, fullPage: true })
await b.close()
console.log(out)
