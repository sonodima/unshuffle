// End-to-end on the production snapshot (vite preview :5450), phone 390x844 touch:
// solo game → PlayView → jittery taps play, long-press plays from position, drag
// reorders, transport label fits. Screenshots in shots/solo-*.png.
import { chromium } from 'playwright'
import { SHOTS, sleep, pt } from './lib.mjs'

const BASE = process.env.PREVIEW ?? 'http://127.0.0.1:5450/'
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
await ctx.addInitScript(() => {
  try {
    localStorage.setItem('unshuffle:onboarded', '1')
  } catch {
    /* ignore */
  }
})
const page = await ctx.newPage()
const cdp = await ctx.newCDPSession(page)
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)))
page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`))
const log = (name, d) => console.log(name.padEnd(26), JSON.stringify(d))
const view = '[data-screen-frame]:not([inert]) [data-round-view="playing"]'
const order = () => page.$$eval(`${view} .sb-item`, (els) => els.map((e) => ({ p: +e.dataset.pos, s: +e.dataset.seg })).sort((a, b) => a.p - b.p).map((e) => e.s))
const center = async (pos) => {
  const b = await page.locator(`${view} .sb-item[data-pos="${pos}"]`).boundingBox()
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}
// The production build has no module URLs to import: read the engine state from the DOM.
const playingState = () =>
  page.evaluate((v) => ({
    block: [...document.querySelectorAll(`${v} .sb-block[data-playing]`)].length,
    playAll: !!document.querySelector(`${v} .tb[data-playing]`) || !!document.querySelector('.tb[data-playing]'),
    label: document.querySelector('.tb-label')?.innerText,
  }), view)
try {
  await page.goto(BASE, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Crea stanza', exact: true }).click()
  await page.locator('[data-screen-frame][data-screen="lobby"]:not([inert])').waitFor({ timeout: 30_000 })
  await page.getByRole('searchbox', { name: 'Cerca playlist' }).fill('pop hits')
  const first = page.locator('section[aria-label="Scegli la playlist"] ul:not([aria-hidden]) li button[aria-pressed]').first()
  await first.waitFor({ timeout: 20_000 })
  await sleep(500)
  await first.click()
  await page
    .getByRole('radiogroup', { name: 'Spezzoni' })
    .getByRole('radio', { name: /^8/ })
    .click({ timeout: 3000 })
    .catch(() => console.log('(snippet-count control not found on this layout: default count)'))
  await sleep(400)
  await page.getByRole('button', { name: /Inizia partita/ }).first().click()
  await page.waitForFunction(() => document.querySelector('[data-screen-frame]:not([inert]) [data-phase="playing"]'), null, { timeout: 90_000 })
  await page.locator(`${view} .sb-item`).first().waitFor({ timeout: 10_000 })
  await sleep(2500)
  await page.screenshot({ path: `${SHOTS}solo-playing.png` })

  for (const j of [0, 6, 9, 13]) {
    const before = await order()
    const c = await center(1)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(c.x, c.y) })
    if (j) {
      await sleep(30)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(c.x + j * 0.6, c.y + j * 0.8) })
    }
    await sleep(70)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await sleep(400)
    const st = await playingState()
    log(`tap jitter ${j}px`, { playsBlock: st.block === 1, orderChanged: before.join() !== (await order()).join() })
    // stop it again
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(c.x, c.y) })
    await sleep(60)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await sleep(400)
  }
  {
    const c = await center(4)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(c.x, c.y) })
    await sleep(700)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await sleep(900)
    const st = await playingState()
    const cur = await page.evaluate(() => [...document.querySelectorAll('.tb-cell')].findIndex((c) => c.hasAttribute('data-current')))
    await page.screenshot({ path: `${SHOTS}solo-longpress.png` })
    log('long-press play from 5', { playAll: st.playAll, currentCell: cur, label: st.label })
    await page.locator('.tb-play').click()
    await sleep(300)
  }
  {
    const before = await order()
    const a = await center(0)
    const b = await center(7)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(a.x, a.y) })
    for (let i = 1; i <= 30; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(a.x + ((b.x - a.x) * i) / 30, a.y + ((b.y - a.y) * i) / 30) })
      await sleep(16)
    }
    await sleep(120)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await sleep(700)
    const after = await order()
    log('drag 0->7', { ok: after.join() === [...before.slice(1), before[0]].join() })
  }
  console.log('errors', JSON.stringify(errors))
} finally {
  await browser.close()
}
