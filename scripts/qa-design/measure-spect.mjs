// Spectator reveal: does the footer (waiting pill) overlap the "Sei spettatore" note?
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://[::1]:5303'
const browser = await chromium.launch({ channel: 'chrome' })
for (const [w, h] of [[1440, 900], [1280, 800], [1536, 864], [1920, 1080]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  await page.goto(`${BASE}/lab/reveal.html?me=p-5&ui=0&skip=1&audio=0`, { waitUntil: 'load' })
  await page.waitForTimeout(2500)
  const m = await page.evaluate(() => {
    const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right) } }
    const note = r(document.querySelector('.rv-area-board .glass'))
    const pill = r(document.querySelector('.rv-wait'))
    const song = r(document.querySelector('.rv-area-song'))
    const lead = r(document.querySelector('.rv-area-lead'))
    return { note, pill, song, lead, overlapPx: note && pill ? note.bottom - pill.top : null, scroll: document.querySelector('.rv-root').scrollHeight - innerHeight }
  })
  console.log(`${w}x${h}`, JSON.stringify(m))
  await page.close()
}
await browser.close()
