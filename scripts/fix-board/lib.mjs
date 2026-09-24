// Shared helpers for the fix-board checks (board lab on the fix-board dev server).
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

export const BASE = process.env.BASE ?? 'http://localhost:5400'
export const SHOTS = new URL('./shots/', import.meta.url).pathname
mkdirSync(SHOTS, { recursive: true })
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let browser = null
export async function launch() {
  browser ??= await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
  return browser
}
export async function close() {
  await browser?.close()
  browser = null
}

/** phone = 390x844 @2x touch; desktop = 1440x900 mouse. */
export async function newPage(kind = 'phone', extra = {}) {
  const b = await launch()
  const opts =
    kind === 'phone'
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }
      : kind === 'small'
        ? { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }
        : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }
  const ctx = await b.newContext({ ...opts, ...extra })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`)
  })
  const cdp = await ctx.newCDPSession(page)
  return { ctx, page, cdp, errors }
}

export const pt = (x, y) => [{ x, y, id: 1, radiusX: 6, radiusY: 6, force: 1 }]

export async function touchPath(cdp, path, stepMs = 16) {
  const [a] = path
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(a.x, a.y) })
  for (let i = 1; i < path.length; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(path[i].x, path[i].y) })
    await sleep(stepMs)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

export const line = (a, b, steps) =>
  Array.from({ length: steps + 1 }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / steps, y: a.y + ((b.y - a.y) * i) / steps }))

export async function center(page, pos) {
  const b = await page.locator(`.sb-item[data-pos="${pos}"]`).boundingBox()
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height }
}

export const order = (page) => page.evaluate(() => window.__lab.order())
export const engineState = (page) =>
  page.evaluate(() => {
    const s = window.__lab.engine.getState()
    return { playing: s.playing, tag: s.tag ?? null, mode: s.mode ?? null, index: s.index }
  })
export const stopAudio = (page) => page.evaluate(() => window.__lab.engine.stop())

export async function openLab(page, query = 'audio=synth&engine=mock&n=8') {
  await page.goto(`${BASE}/lab/board.html?${query}`)
  await page.locator('.sb-item').first().waitFor({ timeout: 20_000 })
  await page.waitForFunction(() => window.__lab?.ready?.(), null, { timeout: 30_000 })
  await sleep(500)
}
