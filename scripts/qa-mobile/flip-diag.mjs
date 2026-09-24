// Diagnose the reveal cover flip in WebKit: (1) minimal static flip page, (2) the real SongCard.
import { webkit, chromium, devices } from 'playwright'
import { BASE, OUT, newContext, sleep, closeBrowsers } from './lib.mjs'
import { installQa, setState, goHome } from './states.mjs'

const MINI = `<!doctype html><html><body style="margin:0;background:#222">
<style>
.flip{perspective:900px;width:120px;height:120px;position:absolute;left:20px;top:20px}
.inner{position:relative;width:100%;height:100%;transform-style:preserve-3d}
.face{position:absolute;inset:0;border-radius:16px;-webkit-backface-visibility:hidden;backface-visibility:hidden}
.front{background:#0c0}
.back{background:#c0c;transform:rotateY(180deg);overflow:hidden;display:grid;place-items:center;font:bold 60px sans-serif;color:#fff}
</style>
<div class="flip" id="a"><div class="inner" style="transform:none"><div class="face front"></div><div class="face back">?</div></div></div>
<div class="flip" id="b" style="left:160px"><div class="inner" style="transform:rotateY(0deg) scale(1)"><div class="face front"></div><div class="face back">?</div></div></div>
<div class="flip" id="c" style="left:20px;top:160px"><div class="inner" style="transform:rotateY(180deg)"><div class="face front"></div><div class="face back">?</div></div></div>
<div id="d" style="position:absolute;left:160px;top:160px;opacity:.99"><div class="flip" style="position:relative;left:0;top:0"><div class="inner" style="transform:none"><div class="face front"></div><div class="face back">?</div></div></div></div>
</body></html>`

for (const engine of ['webkit', 'chromium']) {
  const b = engine === 'webkit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' })
  const ctx = await b.newContext(engine === 'webkit' ? { ...devices['iPhone 14'] } : { viewport: { width: 390, height: 844 } })
  const p = await ctx.newPage()
  await p.setContent(MINI)
  await sleep(300)
  await p.screenshot({ path: `${OUT}flipdiag-mini-${engine}.png`, clip: { x: 0, y: 0, width: 300, height: 300 } })
  console.log(engine, 'mini done (green = front visible; A: none, B: rotateY(0), C: rotateY(180) should be magenta, D: none inside opacity wrapper)')
  await b.close()
}

const { page } = await newContext('webkit', 'iphone14')
page.setDefaultTimeout(90_000)
await page.goto(`${BASE}/lab/shell.html?real=1&panel=0`)
await installQa(page)
await goHome(page)
await sleep(500)
await setState(page, 'reveal', { n: 8 })
const samples = []
for (let i = 0; i < 14; i++) {
  await sleep(500)
  samples.push(
    await page.evaluate(() => {
      const inner = document.querySelector('.rv-flip-inner')
      const flip = document.querySelector('.rv-flip')
      const r = inner?.getBoundingClientRect()
      const hit = r ? document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) : null
      return {
        t: Math.round(performance.now()),
        inner: inner && getComputedStyle(inner).transform,
        style: inner?.getAttribute('style'),
        flipOpacity: flip && getComputedStyle(flip).opacity,
        tstyle: inner && getComputedStyle(inner).transformStyle,
        hit: hit?.className?.toString().slice(0, 40),
      }
    }),
  )
}
console.log(JSON.stringify(samples, null, 0))
await page.evaluate(() => document.querySelector('.rv-root')?.scrollTo({ top: 0, behavior: 'instant' }))
await sleep(400)
const box = await page.locator('.rv-flip').first().boundingBox()
await page.screenshot({ path: `${OUT}flipdiag-app-webkit.png`, clip: { x: box.x, y: box.y, width: box.width, height: box.height } })
// Try: remove the opacity wrapper's style (motion leaves opacity:1 inline) / force transform none
await page.evaluate(() => {
  const inner = document.querySelector('.rv-flip-inner')
  inner.style.transform = 'rotateY(0.01deg)'
})
await sleep(300)
await page.screenshot({ path: `${OUT}flipdiag-app-webkit-rot001.png`, clip: { x: box.x, y: box.y, width: box.width, height: box.height } })
await closeBrowsers()
