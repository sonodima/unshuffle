// Shader GPU/frame cost via the shader lab stats (dev server :5308), several devices.
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5308/'
const CONFIGS = [
  ['desktop 1440x900 dpr1', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, 1],
  ['desktop 1440x900 dpr2', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }, 1],
  ['desktop 2560x1440 dpr2', { viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 2 }, 1],
  ['phone 390x844 dpr3', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, 1],
  ['phone 390x844 dpr3 cpu4x', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, 4],
  ['tablet 1024x1366 dpr2 touch', { viewport: { width: 1024, height: 1366 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 1],
  ['desktop 1440x900 cpu4x', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, 4],
]
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
for (const [name, opts, cpu] of CONFIGS) {
  const ctx = await browser.newContext(opts)
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
  await page.goto(BASE + 'lab/shader.html?music=1&ui=0', { waitUntil: 'load' })
  const samples = []
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(1000)
    const s = await page.evaluate(() => window.__shaderLab?.stats)
    if (s) samples.push(s)
  }
  const last = samples.at(-1)
  const gpu = samples.slice(-6).map((s) => s.gpuMs).filter((x) => x != null)
  const cpuMs = samples.slice(-6).map((s) => s.cpuMs)
  const avg = (a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : '-')
  console.log(`${name.padEnd(30)} ${last.width}x${last.height} scale=${last.scale} q=${last.quality} oct=${last.octaves} fps=${last.fps} frameMs=${last.frameMs} cpuMs=${avg(cpuMs)} gpuMs=${avg(gpu)}  q-trace=${samples.map((s) => s.quality).join('')}`)
  await ctx.close()
}
await browser.close()
