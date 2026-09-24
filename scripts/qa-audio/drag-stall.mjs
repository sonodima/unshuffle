// Does dragging blocks during play-all (CPU throttled 4x ~ mid-range phone) stall the main thread past
// the 200 ms lookahead and open gaps ("resync" joins) in the sequence? Solo game, 16 snippets.
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
const BASE = 'http://127.0.0.1:5304/'
const THROTTLE = Number(process.env.THROTTLE ?? 4)
const T0 = Date.now()
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1).padStart(6)}s]`, ...a)
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } })
await ctx.addInitScript(() => { try { localStorage.setItem('unshuffle:onboarded', String(Date.now())) } catch {} })
const page = await ctx.newPage()
page.on('pageerror', (e) => log('pageerror', e.message))
const report = { throttle: THROTTLE }
try {
  await page.goto(BASE)
  await page.locator('[data-screen-frame][data-screen="home"]:not([inert])').waitFor({ timeout: 30000 })
  await page.getByRole('button', { name: 'Crea stanza', exact: true }).click()
  await page.locator('[data-screen-frame][data-screen="lobby"]:not([inert])').waitFor({ timeout: 30000 })
  const search = page.getByRole('searchbox', { name: 'Cerca playlist' })
  await search.click(); await search.fill('hits 2000')
  const first = page.locator('section[aria-label="Scegli la playlist"] ul:not([aria-hidden]) li button[aria-pressed]').first()
  await first.waitFor({ timeout: 20000 }); await page.waitForTimeout(500); await first.click()
  const setRadio = async (group, name) => page.getByRole('radiogroup', { name: group }).first().getByRole('radio', { name }).first().click()
  await setRadio('Round', '3'); await setRadio('Spezzoni', /^16/); await setRadio('Tempo per round', '180s')
  await page.getByRole('button', { name: /Inizia partita/ }).first().click()
  await page.waitForFunction(() => document.querySelector('[data-screen-frame]:not([inert]) [data-phase="playing"]'), null, { timeout: 90000 })
  await page.locator('[data-round-view="playing"] .sb-item').first().waitFor({ timeout: 10000 })
  await page.waitForTimeout(1500)
  await page.evaluate(() => {
    window.__lt = []
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push({ at: e.startTime, d: e.duration }) }).observe({ type: 'longtask', buffered: false })
  })
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE })
  await page.getByRole('button', { name: 'Ascolta tutti gli spezzoni in ordine' }).click()
  await page.waitForTimeout(800)
  const items = page.locator('[data-round-view="playing"] .sb-item')
  for (let k = 0; k < 8; k++) {
    const a = await items.nth((k * 5) % 16).boundingBox(), b = await items.nth((k * 5 + 7) % 16).boundingBox()
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
    await page.mouse.down()
    for (let s = 1; s <= 12; s++) { await page.mouse.move(a.x + a.width / 2 + ((b.x - a.x) * s) / 12, a.y + a.height / 2 + ((b.y - a.y) * s) / 12); await page.waitForTimeout(16) }
    await page.mouse.up()
    await page.waitForTimeout(700)
  }
  await page.waitForTimeout(1500)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  const r = await page.evaluate(async () => {
    const eng = await import('/src/audio/engine.ts')
    const sched = eng.engineDebug.schedule()
    const sr = eng.getAudioContext().sampleRate
    return {
      joins: sched.map((s) => s.join),
      gapsMs: sched.slice(1).map((s, i) => +(((s.whenFrame - (sched[i].whenFrame + sched[i].frames)) * 1000) / sr).toFixed(1)),
      longTasks: window.__lt.map((t) => Math.round(t.d)).sort((a, b) => b - a),
      state: eng.audioEngine.getState(),
    }
  })
  Object.assign(report, r)
  log('joins', r.joins.join(','))
  log('gaps ms', r.gapsMs.join(' '))
  log('long tasks (ms, desc)', r.longTasks.slice(0, 20).join(' '), 'count', r.longTasks.length)
  await page.screenshot({ path: new URL('./shots/drag-stall.png', import.meta.url).pathname })
} catch (e) {
  log('FATAL', e?.stack ?? e)
} finally {
  writeFileSync(new URL('./drag-stall.json', import.meta.url), JSON.stringify(report, null, 1))
  await browser.close()
}
