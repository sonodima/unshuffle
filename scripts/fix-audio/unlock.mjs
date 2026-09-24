// Unlock paths: WebKit (iPhone 14 descriptor) with/without the Home soft hold and with/without the Audio Session API,
// plus Chrome: idle pre-warm and first-tap handler cost.
import { chromium, webkit, devices } from 'playwright'
const BASE = process.env.BASE ?? 'http://localhost:5410'
const out = []
const wk = await webkit.launch()
for (const c of process.env.ONLY === 'chrome' ? [] : [
  { name: 'ios17 no-hold: nickname tap', soft: false, legacy: false, taps: ['#nick'] },
  { name: 'ios17 hold: nickname + avatar taps', soft: true, legacy: false, taps: ['#nick', '#avatar'] },
  { name: 'ios17 hold: nickname then CTA', soft: true, legacy: false, taps: ['#nick', '#cta'] },
  { name: 'ios16 no-hold: nickname tap', soft: false, legacy: true, taps: ['#nick'] },
  { name: 'ios16 hold: nickname then CTA', soft: true, legacy: true, taps: ['#nick', '#cta'] },
]) {
  const ctx = await wk.newContext({ ...devices['iPhone 14'] })
  if (c.legacy) await ctx.addInitScript(() => { try { delete Navigator.prototype.audioSession; Object.defineProperty(navigator, 'audioSession', { value: undefined, configurable: true }) } catch {} })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message))
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()) })
  await p.goto(`${BASE}/lab/fix-audio.html${c.soft ? '?soft=1' : ''}`)
  await p.waitForFunction(() => window.__unlockState)
  await p.waitForTimeout(1500)
  const steps = [{ step: 'boot', ...(await p.evaluate(() => window.__unlockState())) }]
  for (const sel of c.taps) {
    await p.tap(sel)
    await p.waitForTimeout(700)
    steps.push({ step: `tap ${sel}`, ...(await p.evaluate(() => window.__unlockState())) })
  }
  if (c.legacy) {
    // background → keep-alive paused, foreground → playing again
    await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')) })
    await p.waitForTimeout(200)
    steps.push({ step: 'hidden', ...(await p.evaluate(() => window.__unlockState())) })
    await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')) })
    await p.waitForTimeout(400)
    steps.push({ step: 'visible', ...(await p.evaluate(() => window.__unlockState())) })
  }
  console.log(`\n${c.name}${errs.length ? '  ERRORS: ' + errs.join(' | ') : ''}`)
  for (const s of steps) console.log(`  ${s.step.padEnd(12)} ctx=${s.ctx} unlocked=${s.unlocked} session=${s.audioSession} soft=${s.soft} legacy=${JSON.stringify(s.legacy)}`)
  out.push({ ...c, steps, errs })
  await ctx.close()
}
await wk.close()

// Chrome desktop + Android-like phone: pre-warm at idle, first tap cost
const cr = await chromium.launch({ channel: 'chrome' })
for (const [name, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['android', { ...devices['Pixel 7'] }]]) {
  for (const cpu of [1, 4]) {
    const ctx = await cr.newContext(opts)
    await ctx.addInitScript(() => {
      window.__tap = []
      let t0 = 0
      window.addEventListener('pointerdown', () => { t0 = performance.now() }, { capture: true })
      document.addEventListener('pointerdown', () => window.__tap.push(performance.now() - t0), { capture: false })
    })
    const p = await ctx.newPage()
    const msgs = []
    p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/Failed to load resource/.test(m.text())) msgs.push(`${m.type()}: ${m.text()}`) })
    const cdp = await ctx.newCDPSession(p)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
    await p.goto(`${BASE}/lab/fix-audio.html`)
    await p.waitForFunction(() => window.__unlockState)
    const early = await p.evaluate(() => window.__unlockState())
    await p.waitForTimeout(600)
    const at600 = await p.evaluate(() => window.__unlockState())
    await p.waitForTimeout(2900)
    const warmed = await p.evaluate(() => window.__unlockState())
    if (name === 'android') await p.tap('#nick')
    else await p.click('#nick')
    await p.waitForTimeout(500)
    const after = await p.evaluate(() => ({ ...window.__unlockState(), tapHandlerMs: window.__tap.map((x) => +x.toFixed(1)) }))
    console.log(`\nchrome ${name} cpu x${cpu}: at load ctx=${early.ctx} → +0.6 s ctx=${at600.ctx} → after idle ctx=${warmed.ctx} → after first tap ctx=${after.ctx} unlocked=${after.unlocked}; first pointerdown capture→bubble ${after.tapHandlerMs} ms; console: ${msgs.length ? msgs.join(' | ') : 'clean'}`)
    out.push({ name: `chrome ${name} x${cpu}`, early, warmed, after, msgs })
    await ctx.close()
  }
}
await cr.close()
import('node:fs').then((fs) => fs.writeFileSync(new URL('./unlock-out.json', import.meta.url), JSON.stringify(out, null, 1)))
