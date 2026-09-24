// Fine-grained adaptive-quality trace on SwiftShader (software GL = weak GPU).
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://localhost:5413/'
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
await page.addInitScript(() => {
  window.__frames = []
  const P = WebGL2RenderingContext.prototype
  const d = P.drawArrays
  P.drawArrays = function (...a) { window.__frames.push([Math.round(performance.now()), this.canvas.width]); return d.apply(this, a) }
})
await page.goto(BASE + 'lab/shader.html?music=1&ui=0', { waitUntil: 'load' })
const lines = []
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(250)
  const s = await page.evaluate(() => window.__shaderLab?.stats)
  if (s) lines.push(`${((i + 1) * 0.25).toFixed(2)}s q${s.quality}${s.throttled ? '@30' : ''} oct${s.octaves} ${s.width}w fps${s.fps} typ${s.frameMs} tgt${s.targetFps}`)
}
const frames = await page.evaluate(() => window.__frames)
console.log(lines.filter((l, i, a) => l !== a[i - 1]).join('\n'))
// frame intervals around changes of width
let last = 0, lastW = 0
const out = []
for (const [t, w] of frames) { if (w !== lastW) out.push(`@${t} width ${lastW}->${w}`); lastW = w }
console.log(out.join('\n'))
const iv = frames.slice(1).map((f, i) => f[0] - frames[i][0])
console.log('intervals', iv.slice(0, 200).join(','))
await browser.close()
