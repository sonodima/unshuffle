// Lobby (host, desktop): what is above the fold / under the start dock?
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5303'
const browser = await chromium.launch({ channel: 'chrome' })
for (const [w, h, pl] of [[1440, 900, 0], [1440, 900, 1], [1280, 720, 1], [1366, 768, 1], [1536, 864, 0]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  await page.goto(`${BASE}/lab/lobby.html?role=host&pl=${pl}&n=5`, { waitUntil: 'load' })
  await page.waitForTimeout(1800)
  const m = await page.evaluate(() => {
    const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)] }
    const byLabel = (l) => document.querySelector(`[role="radiogroup"][aria-label="${l}"]`)
    const dock = [...document.querySelectorAll('button')].find((b) => /Inizia partita/i.test(b.textContent))?.closest('.sticky, [class*="sticky"]')
    const hero = [...document.querySelectorAll('section, div')].find((e) => /Nessuna playlist/i.test(e.textContent) && e.className.includes('glass'))
    const pickerTitle = [...document.querySelectorAll('h2')].find((e) => /Scegli la playlist/i.test(e.textContent))
    return { dock: r(dock), round: r(byLabel('Round')), snippets: r(byLabel('Spezzoni')), time: r(byLabel('Tempo per round')), final: r(byLabel('Timer finale')), emptyHero: r(hero), pickerTitle: r(pickerTitle), pickerTitleLines: pickerTitle ? Math.round(pickerTitle.getBoundingClientRect().height / parseFloat(getComputedStyle(pickerTitle).lineHeight || '28')) : null, playerRows: [...document.querySelectorAll('li')].filter((li) => li.querySelector('img, [class*="avatar" i]')).map((li) => Math.round(li.getBoundingClientRect().top)).slice(0, 6) }
  })
  console.log(`${w}x${h} pl=${pl}`, JSON.stringify(m))
  await page.close()
}
await browser.close()
