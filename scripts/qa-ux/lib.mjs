import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
export const BASE = process.env.BASE ?? 'http://127.0.0.1:5307/'
export const OUT = new URL('./shots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const T0 = Date.now()
export const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1).padStart(6)}s]`, ...a)
export const problems = []
export async function launch() {
  return chromium.launch({ channel: 'chrome', headless: !process.env.HEADFUL, args: ['--autoplay-policy=no-user-gesture-required'] })
}
export const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
export const SMALLPHONE = { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
export const DESKTOP = { viewport: { width: 1440, height: 900 } }
export async function openPlayer(browser, name, opts, { onboarded = false, init } = {}) {
  const ctx = await browser.newContext({ locale: 'it-IT', ...opts })
  if (onboarded) await ctx.addInitScript(() => { try { localStorage.setItem('unshuffle:onboarded', String(Date.now())) } catch {} })
  if (init) await ctx.addInitScript(init)
  const page = await ctx.newPage()
  page.on('dialog', (d) => { log(`[${name}] dialog: ${d.message()}`); void d.accept().catch(() => {}) })
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`[${name}] console.error: ${m.text().slice(0, 300)}`) })
  page.on('pageerror', (e) => problems.push(`[${name}] pageerror: ${e.message}`))
  page._name = name
  return page
}
export async function shot(page, tag) {
  const p = `${OUT}${tag}.png`
  await page.screenshot({ path: p })
  log('shot', tag)
  return p
}
export const frame = (page, screen) => page.locator(`[data-screen-frame][data-screen="${screen}"]:not([inert])`)
export async function waitScreen(page, screen, timeout = 30_000) { await frame(page, screen).waitFor({ state: 'visible', timeout }) }
export async function waitPhase(page, kind, timeout = 90_000) {
  await page.waitForFunction((k) => document.querySelector(`[data-screen-frame]:not([inert]) [data-phase="${k}"]`) !== null, kind, { timeout, polling: 100 })
}
export async function boardOrder(page) {
  return page.$$eval('[data-screen-frame]:not([inert]) [data-round-view="playing"] .sb-item', (els) =>
    els.map((e) => ({ pos: Number(e.getAttribute('data-pos')), seg: Number(e.getAttribute('data-seg')) })).sort((a, b) => a.pos - b.pos).map((e) => e.seg))
}
export async function center(page, pos) {
  const box = await page.locator(`[data-screen-frame]:not([inert]) [data-round-view="playing"] .sb-item[data-pos="${pos}"]`).boundingBox()
  if (!box) throw new Error(`no block at pos ${pos}`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}
export async function mouseDrag(page, from, to, steps = 14, midShot) {
  const a = await center(page, from); const b = await center(page, to)
  await page.mouse.move(a.x, a.y); await page.mouse.down()
  for (let i = 1; i <= steps; i++) { await page.mouse.move(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps); await page.waitForTimeout(16) }
  await page.waitForTimeout(150)
  if (midShot) await shot(page, midShot)
  await page.mouse.up(); await page.waitForTimeout(450)
}
export async function touchDrag(page, from, to, steps = 16, midShot) {
  const cdp = await page.context().newCDPSession(page)
  const a = await center(page, from); const b = await center(page, to)
  const pt = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(a.x, a.y) })
  for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps) }); await page.waitForTimeout(16) }
  await page.waitForTimeout(150)
  if (midShot) await shot(page, midShot)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(450); await cdp.detach()
}
export function arrayMove(arr, from, to) { const a = arr.slice(); const [x] = a.splice(from, 1); a.splice(to, 0, x); return a }
