// Real audioEngine path: play the lab loop through the engine, then stop it and time the return to 30 fps.
import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=metal'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()) })
await page.goto('http://localhost:5413/lab/shader.html', { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
const before = await page.evaluate(() => window.__shaderLab.stats)
await page.getByRole('button', { name: 'Engine' }).click()
await page.waitForTimeout(3000)
const playing = await page.evaluate(() => ({ s: window.__shaderLab.stats, lv: window.__shaderLab.levels() }))
await page.evaluate(() => window.__shaderLab.engine(false))
const t0 = Date.now()
let idleAt = -1
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(250)
  const s = await page.evaluate(() => window.__shaderLab.stats)
  if (s?.idle) { idleAt = (Date.now() - t0) / 1000; break }
}
console.log(JSON.stringify({ before: { fps: before?.fps, target: before?.targetFps, idle: before?.idle }, playing: { fps: playing.s?.fps, target: playing.s?.targetFps, idle: playing.s?.idle, levels: playing.lv }, idleAfterStopS: idleAt, errors }))
await browser.close()
