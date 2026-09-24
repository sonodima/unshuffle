// Finding 2: on the reveal (scrollable on phones) a swipe that starts on a locked
// block must scroll the page; a tap on it must still play. Uses lab/reveal.html.
import { newPage, sleep, close, BASE, pt, SHOTS } from './lib.mjs'

for (const [kind, n] of [['phone', 8], ['phone', 16], ['small', 16]]) {
  const { page, cdp, errors } = await newPage(kind)
  await page.goto(`${BASE}/lab/reveal.html?n=${n}&ui=0&auto=0`)
  await page.locator('.sb-item').first().waitFor({ timeout: 20000 })
  await sleep(9000) // reveal stages done
  const root = await page.evaluate(() => {
    const el = [...document.querySelectorAll('*')].find((e) => {
      const cs = getComputedStyle(e)
      return /(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 20 && e.contains(document.querySelector('.sb-item'))
    })
    if (el) el.dataset.fixScroll = '1'
    return el ? { cls: el.className.slice(0, 40), max: el.scrollHeight - el.clientHeight } : null
  })
  if (!root) {
    console.log(kind, n, 'no scroll container', errors)
    await page.context().close()
    continue
  }
  const scrollTop = () => page.evaluate(() => document.querySelector('[data-fix-scroll]').scrollTop)
  const blk = await page.evaluate(() => {
    const sc = document.querySelector('[data-fix-scroll]')
    sc.scrollTo({ top: 0, behavior: 'instant' })
    document.querySelector('.sb-item').scrollIntoView({ block: 'center', behavior: 'instant' })
    const r = [...document.querySelectorAll('.sb-item')].map((e) => e.getBoundingClientRect()).find((r) => r.y + r.height / 2 > 140 && r.y + r.height / 2 < innerHeight - 220)
    return r && { x: r.x + r.width / 2, y: r.y + r.height / 2, top: sc.scrollTop }
  })
  async function swipe(x, y0, y1) {
    const before = await scrollTop()
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(x, y0) })
    for (let i = 1; i <= 12; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x, y0 + ((y1 - y0) * i) / 12) })
      await sleep(16)
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await sleep(700)
    return Math.round((await scrollTop()) - before)
  }
  await sleep(400)
  const scrolled = blk ? await swipe(blk.x, blk.y + 40, blk.y - 120) : null
  const locked = await page.evaluate(() => getComputedStyle(document.querySelector('.sb-item')).touchAction)
  await page.evaluate(() => document.querySelector('[data-fix-scroll]').scrollTo({ top: 0, behavior: 'instant' }))
  await sleep(300)
  // a tap on a block still plays (engine state from the real engine)
  const b2 = await page.evaluate(() => {
    const r = document.querySelector('.sb-item').getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(b2.x, b2.y) })
  await sleep(60)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await sleep(300)
  const tapState = await page.evaluate(async () => {
    const { audioEngine } = await import('/src/audio/engine.ts')
    const s = audioEngine.getState()
    return { playing: s.playing, tag: s.tag }
  })
  await page.screenshot({ path: `${SHOTS}reveal-scroll-${kind}-n${n}.png` })
  console.log(`${kind} n=${n}`, JSON.stringify({ root, touchAction: locked, swipeOnBlockScrolled: scrolled, tapState, errors: errors.filter((e) => !e.includes('404')).slice(0, 3) }))
  await page.context().close()
}
await close()
