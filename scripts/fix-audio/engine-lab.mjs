// Runs the original engine lab suite (src/dev/engine/main.ts) against this dev server.
// NORM=0 disables loudness normalisation first (the suite's sample-exact test compares against the raw buffer).
import { chromium } from 'playwright'
import { labEval } from './lib.mjs'
const BASE = process.env.BASE ?? 'http://localhost:5410'
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[page ${m.type()}]`, m.text()) })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
const report = await labEval(page, `${BASE}/lab/engine.html`, async ({ long, norm }) => {
  if (!norm) (await import('/src/audio/engine.ts')).engineDebug.setNormalization(false)
  return window.__engineLab.runTests({ long })
}, { long: !!process.env.LONG, norm: process.env.NORM !== '0' }, { ready: () => window.__engineLab?.ready })
for (const r of report.results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : '\n      ' + r.failures.join('\n      ')}`)
const extra = await page.evaluate(async () => {
  const e = await import('/src/audio/engine.ts')
  return { loud: e.engineDebug.loudness('track:3135556'), trim: e.engineDebug.trimOf('track:3135556'), delay: e.engineDebug.levelsDelay() }
})
console.log('Daft Punk loudness', JSON.stringify(extra))
console.log(`\n${report.passed} passed, ${report.failed} failed`)
await browser.close()
