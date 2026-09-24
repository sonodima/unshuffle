// Try candidate CSS fixes for the WebKit reveal flip (injected at runtime; app source untouched).
import { BASE, OUT, newContext, sleep, closeBrowsers } from './lib.mjs'
import { installQa, setState, goHome } from './states.mjs'
const CANDIDATES = {
  none: '',
  frontZ: '.rv-face-front{transform:translateZ(1px)}',
  frontRot0: '.rv-face-front{transform:rotateY(0deg)}',
  backNoOverflow: '.rv-face-back{overflow:visible}',
  innerWillChange: '.rv-flip-inner{will-change:transform}',
}
const { page } = await newContext('webkit', 'iphone14')
page.setDefaultTimeout(90_000)
await page.goto(`${BASE}/lab/shell.html?real=1&panel=0`)
await installQa(page)
for (const [name, css] of Object.entries(CANDIDATES)) {
  await goHome(page)
  await sleep(500)
  await page.evaluate((css) => {
    document.getElementById('qa-fix')?.remove()
    const s = document.createElement('style')
    s.id = 'qa-fix'
    s.textContent = css
    document.head.appendChild(s)
  }, css)
  await setState(page, 'reveal', { n: 8 })
  await sleep(7000)
  await page.evaluate(() => document.querySelector('.rv-root')?.scrollTo({ top: 0, behavior: 'instant' }))
  await sleep(500)
  const box = await page.locator('.rv-flip').first().boundingBox()
  await page.screenshot({ path: `${OUT}flipfix-${name}.png`, clip: { x: box.x, y: box.y, width: box.width, height: box.height } })
  console.log('shot', name)
}
await closeBrowsers()
