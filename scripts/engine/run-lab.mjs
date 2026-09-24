// Drives lab/engine.html headless in Chrome and prints the in-page test report.
// usage: node scripts/engine/run-lab.mjs [--long] [--tune] [--shots]
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const args = new Set(process.argv.slice(2))
const URL = 'http://localhost:5204/lab/engine.html'
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[page ${m.type()}]`, m.text()) })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto(URL)
await page.waitForFunction(() => window.__engineLab?.ready)
let exit = 0
if (args.has('--tune')) {
  const out = await page.evaluate(() => window.__engineLab.tuneLevels(10))
  console.log(JSON.stringify(out, null, 1))
} else if (args.has('--sfx')) {
  const { mkdirSync } = await import('node:fs')
  mkdirSync('scripts/engine/sfx', { recursive: true })
  const wavs = await page.evaluate(() => window.__engineLab.sfxSheet())
  for (const [name, b64] of Object.entries(wavs)) writeFileSync(`scripts/engine/sfx/${name}.wav`, Buffer.from(b64, 'base64'))
  await page.locator('#sheet').screenshot({ path: 'scripts/engine/shots/sfx-sheet.png' })
  console.log('wrote', Object.keys(wavs).length, 'wavs + sheet')
} else if (!args.has('--shots')) {
  const report = await page.evaluate((long) => window.__engineLab.runTests({ long }), args.has('--long'))
  writeFileSync('scripts/engine/last-report.json', JSON.stringify(report, null, 2))
  for (const r of report.results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : '\n      ' + r.failures.join('\n      ')}`)
  }
  console.log(`\n${report.passed} passed, ${report.failed} failed`)
  exit = report.failed ? 1 : 0
}
if (args.has('--shots')) {
  for (const [name, vp] of [['desktop', { width: 1440, height: 900, deviceScaleFactor: 1 }], ['phone', { width: 390, height: 844, deviceScaleFactor: 2 }]]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor })
    const p = await ctx.newPage()
    await p.goto(URL)
    await p.waitForFunction(() => window.__engineLab?.ready)
    await p.evaluate(() => window.__engineLab.loadDefault())
    await p.click('#playAll')
    await p.waitForTimeout(5200)
    await p.screenshot({ path: `scripts/engine/shots/lab-${name}.png`, fullPage: name === 'phone' })
    await ctx.close()
  }
}
await browser.close()
process.exit(exit)
