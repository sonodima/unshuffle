// Drives the shader through the REAL audio engine (synthesized loop, no network).
import { chromium } from 'playwright'
const OUT = new URL('./shots/', import.meta.url).pathname
const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && !m.text().includes('404') && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(e.message))
await page.goto('http://localhost:5209/lab/shader.html', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /engine/i }).click()
await page.waitForTimeout(2500)
const sample = await page.evaluate(async () => {
  const out = []
  for (let i = 0; i < 120; i++) {
    out.push(window.__shaderLab.levels())
    await new Promise((r) => requestAnimationFrame(r))
  }
  return out
})
const max = (k) => Math.max(...sample.map((s) => s[k]))
const mean = (k) => sample.reduce((a, s) => a + s[k], 0) / sample.length
let beats = 0
for (let i = 1; i < sample.length; i++) if (sample[i].beat > 0.5 && sample[i].beat > sample[i - 1].beat + 0.2) beats++
console.log(`levels over ~2s: bass mean ${mean('bass').toFixed(2)} max ${max('bass').toFixed(2)} | mid ${mean('mid').toFixed(2)} | treble ${mean('treble').toFixed(2)} | energy ${mean('energy').toFixed(2)} | beat onsets ${beats}`)
await page.evaluate(() => window.__shaderLab.ui(false))
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}engine-desk.png` })
console.log(errors.length ? errors.join('\n') : 'no console errors')
await browser.close()
