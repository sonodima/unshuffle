// Weak-GPU simulation: software GL (SwiftShader) to see whether adaptive quality kicks in and where it settles.
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5308/'
const CONFIGS = [
  ['desktop 1440x900 dpr1 swiftshader', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }],
  ['phone 390x844 dpr3 swiftshader', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }],
]
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
for (const [name, opts] of CONFIGS) {
  const ctx = await browser.newContext(opts)
  const page = await ctx.newPage()
  await page.goto(BASE + 'lab/shader.html?music=1&ui=0', { waitUntil: 'load' })
  const samples = []
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(1000)
    const s = await page.evaluate(() => window.__shaderLab?.stats)
    if (s) samples.push(s)
  }
  const last = samples.at(-1)
  console.log(`${name.padEnd(36)} gpu=${last?.gpu} ${last?.width}x${last?.height} scale=${last?.scale} q=${last?.quality} oct=${last?.octaves} fps=${last?.fps} frameMs=${last?.frameMs} gpuMs=${last?.gpuMs}\n   q-trace=${samples.map((s) => s.quality).join('')} fps-trace=${samples.map((s) => Math.round(s.fps)).join(',')}`)
  await ctx.close()
}
await browser.close()
