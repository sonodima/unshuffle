// Tiny text (<12px) on the final lab, grouped by size + element class.
import { chromium } from 'playwright'
const variant = process.argv[2] ?? 'final'
const browser = await chromium.launch({ channel: 'chrome' })
for (const [vp, opts] of Object.entries({ d1440: { viewport: { width: 1440, height: 900 } }, p390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } })) {
  const ctx = await browser.newContext(opts)
  const page = await ctx.newPage()
  await page.goto(`http://localhost:5405/lab/fix-final.html?v=${variant}&ui=0&celebrate=0`, { waitUntil: 'load' })
  await page.waitForTimeout(4500)
  const r = await page.evaluate(() => {
    const vis = (e) => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && s.opacity !== '0' && b.bottom > 0 && b.top < innerHeight * 3 }
    const groups = {}
    let count = 0
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    let n
    while ((n = walker.nextNode())) {
      const t = n.textContent.trim(); if (!t) continue
      const el = n.parentElement; if (!el || !vis(el) || el.closest('.sr-only')) continue
      const s = getComputedStyle(el)
      const fs = parseFloat(s.fontSize)
      if (fs < 12) { count++; const k = `${fs}px ${s.textTransform === 'uppercase' ? 'UPPER' : ''} :: ${el.className.toString().slice(0, 60)}`; groups[k] = groups[k] ?? []; if (groups[k].length < 3) groups[k].push(t.slice(0, 20)) }
    }
    return { count, groups }
  })
  console.log(vp, 'tiny', r.count)
  for (const [k, v] of Object.entries(r.groups)) console.log('  ', k, '→', v.join(' | '))
  await ctx.close()
}
await browser.close()
