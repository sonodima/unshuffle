// Reveal: can a phone user scroll the results by swiping? Real CDP touch swipes starting on a
// (read-only) reveal block vs on the score panel; measures .rv-root scrollTop change.
import { BASE, OUT, VIEWPORTS, newContext, sleep, closeBrowsers } from './lib.mjs'
import { installQa, setState, goHome } from './states.mjs'
for (const [vpId, n] of (process.env.CASES ? JSON.parse(process.env.CASES) : [['360x740', 16], ['390x844', 8], ['390x844', 16]])) {
  const vp = VIEWPORTS.find((v) => v.id === vpId)
  const { ctx, page } = await newContext('chromium', vp)
  await page.goto(`${BASE}/lab/shell.html?real=1&panel=0`)
  await installQa(page)
  await page.evaluate(() => window.__qa.loadAudio())
  await goHome(page)
  await sleep(400)
  await setState(page, 'reveal', { n, meId: 'p-2', long: n === 16 })
  await sleep(8500) // reveal stages done
  const cdp = await ctx.newCDPSession(page)
  const pt = (x, y) => [{ x, y, id: 1, radiusX: 6, radiusY: 6, force: 1 }]
  async function swipe(x, y0, y1) {
    const before = await page.evaluate(() => document.querySelector('.rv-root').scrollTop)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(x, y0) })
    for (let i = 1; i <= 12; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x, y0 + ((y1 - y0) * i) / 12) })
      await sleep(16)
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await sleep(700)
    return Math.round((await page.evaluate(() => document.querySelector('.rv-root').scrollTop)) - before)
  }
  const geo = await page.evaluate(() => {
    const g = document.querySelector('.rv-board .sb-grid, .rv-root .sb-grid')?.getBoundingClientRect()
    const items = [...document.querySelectorAll('.rv-root .sb-item')].map((e) => e.getBoundingClientRect())
    const vis = items.filter((r) => r.top >= 0 && r.bottom <= innerHeight)
    const area = vis.reduce((a, r) => a + r.width * r.height, 0)
    return { grid: g && [Math.round(g.top), Math.round(g.bottom)], coverPct: Math.round((area / (innerWidth * innerHeight)) * 100), max: document.querySelector('.rv-root').scrollHeight - innerHeight, first: items[0] && { x: items[0].x + items[0].width / 2, y: items[0].y + items[0].height / 2 } }
  })
  await page.evaluate(() => document.querySelector('.rv-root').scrollTo({ top: 0, behavior: 'instant' }))
  await sleep(300)
  const cover = await page.evaluate(() => { const b = document.querySelector('.rv-root .sb-item'); b?.scrollIntoView({ block: 'center' }); const items = [...document.querySelectorAll('.rv-root .sb-item')].map((e) => e.getBoundingClientRect()); let a = 0; for (const r of items) { const h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)); a += h * r.width } return { coverPctAtBoard: Math.round((a / (innerWidth * innerHeight)) * 100), scrollTop: document.querySelector('.rv-root').scrollTop } })
  const blk = await page.evaluate(() => { const r = [...document.querySelectorAll('.rv-root .sb-item')].map((e) => e.getBoundingClientRect()).find((r) => r.top > 120 && r.bottom < innerHeight - 120); return r && { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
  const onBlock = blk ? await swipe(blk.x, blk.y + 60, blk.y - 140) : null
  // score panel / text area below the board
  const txt = await page.evaluate(() => { const e = document.querySelector('.rv-score') ?? document.querySelector('.rv-root h2'); const r = e?.getBoundingClientRect(); return r && { x: r.x + 30, y: Math.min(innerHeight - 160, r.y + 40) } })
  const onText = txt ? await swipe(txt.x, txt.y + 60, txt.y - 140) : null
  await page.screenshot({ path: `${OUT}reveal-scroll-${vpId}-n${n}.png` })
  console.log(vpId, 'n=' + n, JSON.stringify({ ...cover, max: geo.max, swipeUpOnBlock_scrolled: onBlock, swipeUpOnText_scrolled: onText }))
  await ctx.close()
}
await closeBrowsers()
