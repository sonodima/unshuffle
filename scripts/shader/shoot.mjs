// Shader lab screenshots at phone + desktop.
// Usage: node scripts/shader/shoot.mjs <tag> [scenario,scenario…] [phone|desk|both]
// Scenarios: idle, beat, home, play, reveal, dim, album, fallback, reduced
import { chromium } from 'playwright'

const [tag = 'x', list = 'idle,beat', which = 'both'] = process.argv.slice(2)
const OUT = new URL('./shots/', import.meta.url).pathname
const BASE = 'http://localhost:5209/lab/shader.html'

const SCENARIOS = {
  idle: { q: 'ui=0' },
  beat: { q: 'ui=0&music=1', beat: true },
  home: { q: 'ui=0&mock=home' },
  play: { q: 'ui=0&mock=play&music=1&intensity=0.55', beat: true },
  reveal: { q: 'ui=0&mock=reveal&music=1&accent=sunset', beat: true },
  dim: { q: 'ui=0&intensity=0.55' },
  album: { q: 'ui=0&accent=ocean&music=1', beat: true },
  grey: { q: 'ui=0&accent=grey&music=1', beat: true },
  gold: { q: 'ui=0&accent=gold' },
  lime: { q: 'ui=0&accent=lime&music=1', beat: true },
  fallback: { q: 'ui=0&fallback=1&mock=home' },
  reduced: { q: 'ui=0&reduced=1&music=1' },
  lab: { q: 'music=1' },
}

const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'] })
const errors = []
const viewports = [
  ['phone', { width: 390, height: 844 }, 2],
  ['desk', { width: 1440, height: 900 }, 1],
].filter(([n]) => which === 'both' || which === n)

for (const [name, viewport, dsf] of viewports) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dsf, hasTouch: name === 'phone', isMobile: name === 'phone' })
  for (const sc of list.split(',')) {
    const s = SCENARIOS[sc]
    if (!s) throw new Error(`unknown scenario ${sc}`)
    const page = await ctx.newPage()
    page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`[${name}/${sc}] ${m.text()}`))
    page.on('pageerror', (e) => errors.push(`[${name}/${sc}] pageerror: ${e.message}`))
    await page.goto(`${BASE}?${s.q}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(3200)
    if (s.beat) {
      await page.evaluate(async () => {
        const lab = window.__shaderLab
        lab.synth.alignKick(120)
        await new Promise((r) => setTimeout(r, 120 + 230))
        lab.pause(true)
      })
      await page.waitForTimeout(250)
    }
    const stats = await page.evaluate(() => window.__shaderLab?.stats)
    await page.screenshot({ path: `${OUT}${tag}-${name}-${sc}.png` })
    console.log(`${name}/${sc}`, stats ? `${stats.mode} ${stats.fps}fps ${stats.frameMs}ms gpu=${stats.gpuMs} q${stats.quality} ${stats.width}x${stats.height} | ${stats.gpu}` : 'no stats')
    await page.close()
  }
  await ctx.close()
}
await browser.close()
console.log(errors.length ? errors.join('\n') : 'no console errors')
