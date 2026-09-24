// DOM audit per scene: button metrics (consistency), tiny text (<12px), small touch targets (<44px on phone).
// Usage: BASE=http://[::1]:5303 node scripts/qa-design/audit-dom.mjs [filter]  → prints JSON lines, writes audit-dom.json
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
const BASE = process.env.BASE ?? 'http://[::1]:5303'
const filter = process.argv[2] ?? ''
const SCENES = [
  ['home', '/lab/home.html?state=idle', 1500],
  ['lobby-host', '/lab/lobby.html?role=host&pl=1&n=5', 1800],
  ['lobby-guest', '/lab/lobby.html?role=guest&pl=1&n=5', 1800],
  ['round-playing', '/lab/round.html?s=playing&ui=0&bg=css&engine=mock', 2500],
  ['round-intro', '/lab/round.html?s=intro-card&ui=0&bg=css&live=0&engine=mock', 1500],
  ['reveal-host', '/lab/reveal.html?me=p-host&ui=0&skip=1&audio=0', 2500],
  ['final', '/lab/final.html?v=final&ui=0&celebrate=0', 4500],
]
const VPS = {
  d1440: { viewport: { width: 1440, height: 900 } },
  p390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
}
const out = []
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
for (const [name, path, wait] of SCENES) {
  if (filter && !name.includes(filter)) continue
  for (const [vp, opts] of Object.entries(VPS)) {
    const ctx = await browser.newContext(opts)
    await ctx.addInitScript(() => { try { localStorage.setItem('unshuffle:onboarded', String(Date.now())) } catch {} })
    const page = await ctx.newPage()
    await page.goto(BASE + path, { waitUntil: 'load' })
    await page.waitForTimeout(wait)
    const r = await page.evaluate((phone) => {
      const vis = (e) => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && s.opacity !== '0' && b.bottom > 0 && b.top < innerHeight * 3 }
      const txt = (e) => (e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 28)
      const buttons = [...document.querySelectorAll('button, a[href], [role="button"], [role="radio"], [role="tab"]')].filter(vis).map((e) => {
        const b = e.getBoundingClientRect(); const s = getComputedStyle(e)
        return { t: txt(e), w: Math.round(b.width), h: Math.round(b.height), r: s.borderTopLeftRadius, fs: s.fontSize, ff: s.fontFamily.split(',')[0].replace(/'/g, ''), fw: s.fontWeight }
      })
      // tiny text: text nodes' parent font-size < 12 (visible)
      const tiny = []
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      let n
      while ((n = walker.nextNode())) {
        const t = n.textContent.trim(); if (!t) continue
        const el = n.parentElement; if (!el || !vis(el)) continue
        const fs = parseFloat(getComputedStyle(el).fontSize)
        if (fs < 12) tiny.push(`${fs}px:${t.slice(0, 24)}`)
      }
      const small = phone ? buttons.filter((b) => (b.w < 44 || b.h < 44) && b.t !== '').map((b) => `${b.t}(${b.w}x${b.h})`) : []
      return { buttons, tinyCount: tiny.length, tiny: [...new Set(tiny)].slice(0, 30), small: [...new Set(small)].slice(0, 30) }
    }, vp === 'p390')
    out.push({ name, vp, ...r })
    console.log(name, vp, 'buttons', r.buttons.length, 'tiny', r.tinyCount, 'small', r.small.length)
    await ctx.close()
  }
}
await browser.close()
writeFileSync(new URL('./audit-dom.json', import.meta.url), JSON.stringify(out, null, 1))
