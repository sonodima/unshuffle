// Measure the reveal board header vs. the first-row mark badges (overlap check) at several viewports.
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5303'
const OUT = new URL('./shots/', import.meta.url).pathname
const browser = await chromium.launch({ channel: 'chrome' })
for (const [w, h, n] of [[1440, 900, 6], [1440, 900, 8], [1280, 720, 6], [1280, 800, 6], [1920, 1080, 6], [1024, 768, 6]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })
  await page.goto(`${BASE}/lab/reveal.html?me=p-3&n=${n}&ui=0&skip=1&audio=0`, { waitUntil: 'load' })
  await page.waitForTimeout(2500)
  const m = await page.evaluate(() => {
    const sec = document.querySelector('section[aria-label="La tua sequenza"]')
    const sub = sec?.querySelector('p')
    const marks = [...document.querySelectorAll('.rv-board .sb-mark')].map((e) => e.getBoundingClientRect())
    const rings = [...document.querySelectorAll('.rv-board .sb-ring')].map((e) => e.getBoundingClientRect())
    const blocks = [...document.querySelectorAll('.rv-board .sb-block')].map((e) => e.getBoundingClientRect())
    const s = sub?.getBoundingClientRect()
    const r = (x) => x && { x: Math.round(x.x), y: Math.round(x.y), w: Math.round(x.width), h: Math.round(x.height), b: Math.round(x.bottom), r: Math.round(x.right) }
    const topMark = marks.reduce((a, b) => (a && a.top < b.top ? a : b), null)
    const topRing = rings.reduce((a, b) => (a && a.top < b.top ? a : b), null)
    const lead = document.querySelector('section[aria-label="Classifica"]')?.getBoundingClientRect()
    const list = document.querySelector('.rv-lead-list')
    const lastRow = [...document.querySelectorAll('.rv-lead-list > li')].at(-1)?.getBoundingClientRect()
    const score = document.querySelector('section[aria-label="I tuoi punti"]')?.getBoundingClientRect()
    const song = document.querySelector('section[aria-label="La canzone"]')?.getBoundingClientRect()
    const footer = document.querySelector('.rv-footer-wrap')?.getBoundingClientRect()
    return { subtitle: r(s), topMark: r(topMark), topRing: r(topRing), block0: r(blocks[0]), blockCount: blocks.length, lead: r(lead), lastRow: r(lastRow), score: r(score), song: r(song), footer: r(footer), gapSubToMark: s && topMark ? Math.round(topMark.top - s.bottom) : null, leadEmptyPx: lead && lastRow ? Math.round(lead.bottom - lastRow.bottom) : null }
  })
  console.log(`${w}x${h} n=${n}`, JSON.stringify(m))
  await page.screenshot({ path: `${OUT}reveal-hdr-${w}x${h}-n${n}.png`, clip: { x: m.block0.x - 30, y: m.subtitle.y - 40, width: 560, height: 200 } })
  await page.close()
}
await browser.close()
