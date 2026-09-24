// Reveal cover flip: does the album cover (front face) end up visible? WebKit vs Chromium.
import { BASE, OUT, VIEWPORTS, newContext, sleep, closeBrowsers } from './lib.mjs'
import { installQa, setState, goHome } from './states.mjs'
for (const [engine, vp] of [['webkit', 'iphone14'], ['chromium', VIEWPORTS[1]], ['webkit', VIEWPORTS[6]]]) {
  const { page } = await newContext(engine, vp)
  page.setDefaultTimeout(90_000)
  await page.goto(`${BASE}/lab/shell.html?real=1&panel=0`)
  await installQa(page)
  await goHome(page)
  await sleep(500)
  await setState(page, 'reveal', { n: 8 })
  await sleep(9000)
  await page.evaluate(() => document.querySelector('.rv-root')?.scrollTo({ top: 0, behavior: 'instant' }))
  await sleep(600)
  const info = await page.evaluate(() => {
    const inner = document.querySelector('.rv-flip-inner')
    const img = document.querySelector('img.rv-cover')
    return {
      innerTransform: inner && getComputedStyle(inner).transform,
      innerStyle: inner?.getAttribute('style'),
      img: img ? { complete: img.complete, nw: img.naturalWidth, src: img.currentSrc.slice(0, 80) } : null,
      fallback: !!document.querySelector('.rv-cover-fallback'),
    }
  })
  const box = await page.locator('.rv-flip').first().boundingBox()
  const tag = `${engine}-${vp === 'iphone14' ? vp : vp.id}`
  if (box) await page.screenshot({ path: `${OUT}flip-${tag}.png`, clip: { x: Math.max(0, box.x - 10), y: Math.max(0, box.y - 10), width: box.width + 20, height: box.height + 20 } })
  console.log(tag, JSON.stringify(info))
  await page.context().close()
}
await closeBrowsers()
