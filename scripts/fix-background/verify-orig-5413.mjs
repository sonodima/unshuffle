// Functional + perf checks for ShaderBackground in headless Chrome.
// Usage: node scripts/shader/verify.mjs
import { chromium } from 'playwright'

const BASE = 'http://localhost:5413/lab/shader.html'
const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'] })
const results = []
const ok = (name, pass, detail = '') => {
  results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

async function open(opts = {}, query = 'ui=0') {
  const ctx = await browser.newContext({ viewport: opts.viewport ?? { width: 1440, height: 900 }, deviceScaleFactor: opts.dsf ?? 1, reducedMotion: opts.reducedMotion ?? 'no-preference', isMobile: !!opts.mobile, hasTouch: !!opts.mobile })
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => {
    if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('404')) errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  if (opts.init) await page.addInitScript(opts.init)
  await page.goto(`${BASE}?${query}`, { waitUntil: 'networkidle' })
  return { ctx, page, errors }
}

const stats = (page) => page.evaluate(() => window.__shaderLab?.stats ?? null)
const mode = (page) => page.evaluate(() => document.querySelector('.ushf-bg')?.getAttribute('data-mode'))

/** Samples stats every second for `secs` and averages them. */
async function measure(page, secs) {
  const samples = []
  for (let i = 0; i < secs; i++) {
    await page.waitForTimeout(1000)
    const s = await stats(page)
    if (s) samples.push(s)
  }
  const avg = (k) => (samples.length ? samples.map((s) => s[k] ?? 0).reduce((a, b) => a + b, 0) / samples.length : NaN)
  const last = samples[samples.length - 1]
  return { fps: avg('fps'), frameMs: avg('frameMs'), cpuMs: avg('cpuMs'), gpuMs: avg('gpuMs'), last }
}

// 1. Perf: desktop + phone + 4K, idle and with music.
for (const [label, opts] of [
  ['desktop 1440x900', {}],
  ['phone 390x844@2', { viewport: { width: 390, height: 844 }, dsf: 2, mobile: true }],
  ['4K 2560x1440', { viewport: { width: 2560, height: 1440 } }],
]) {
  for (const music of [false, true]) {
    const { ctx, page, errors } = await open(opts, `ui=0${music ? '&music=1' : ''}`)
    await page.waitForTimeout(2000)
    const m = await measure(page, 5)
    const l = m.last
    // Silent scenes are paced at 30 fps (nothing to react to), music at 60.
    ok(
      `perf ${label} ${music ? 'music' : 'idle'}`,
      (music ? m.fps > 55 : m.fps > 27 && m.fps < 33) && errors.length === 0,
      `${m.fps.toFixed(1)} fps, frame ${m.frameMs.toFixed(2)} ms, cpu ${m.cpuMs.toFixed(3)} ms, gpu ${m.gpuMs.toFixed(3)} ms, ${l?.width}x${l?.height} q${l?.quality} ${l?.octaves}oct ${l?.mode}${errors.length ? ' ERR ' + errors.join(' | ') : ''}`,
    )
    await ctx.close()
  }
}

// 2. StrictMode double mount leaves exactly one canvas. (Music on: frame counts below assume 60 fps.)
{
  const { ctx, page, errors } = await open({}, 'ui=0&music=1')
  await page.waitForTimeout(1500)
  const canvases = await page.evaluate(() => document.querySelectorAll('.ushf-bg canvas').length)
  ok('single canvas after StrictMode remount', canvases === 1, `${canvases} canvas`)

  // 3. Context loss + restore.
  const lossInfo = await page.evaluate(async () => {
    const c = document.querySelector('.ushf-bg canvas')
    const gl = c.getContext('webgl2') ?? c.getContext('webgl')
    const ext = gl.getExtension('WEBGL_lose_context')
    ext.loseContext()
    await new Promise((r) => setTimeout(r, 600))
    ext.restoreContext()
    await new Promise((r) => setTimeout(r, 2500))
    return window.__shaderLab.stats
  })
  ok('context loss → restore resumes rendering', lossInfo?.contextLosses === 1 && lossInfo.fps > 30 && (await mode(page)) === 'webgl', `losses ${lossInfo?.contextLosses}, fps ${lossInfo?.fps}`)

  // 4. Hidden tab pauses the loop.
  const paused = await page.evaluate(async () => {
    const setVis = (v) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v })
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => v === 'hidden' })
      document.dispatchEvent(new Event('visibilitychange'))
    }
    let frames = 0
    const orig = WebGL2RenderingContext.prototype.drawArrays
    WebGL2RenderingContext.prototype.drawArrays = function (...a) {
      frames++
      return orig.apply(this, a)
    }
    setVis('hidden')
    await new Promise((r) => setTimeout(r, 300))
    frames = 0
    await new Promise((r) => setTimeout(r, 1200))
    const hiddenFrames = frames
    setVis('visible')
    frames = 0
    await new Promise((r) => setTimeout(r, 1000))
    const visibleFrames = frames
    WebGL2RenderingContext.prototype.drawArrays = orig
    return { hiddenFrames, visibleFrames }
  })
  ok('pauses while hidden, resumes when visible', paused.hiddenFrames === 0 && paused.visibleFrames > 40, JSON.stringify(paused))

  // 5. Resize updates the internal resolution.
  await page.setViewportSize({ width: 800, height: 600 })
  await page.waitForTimeout(1500)
  const rs = await stats(page)
  ok('resize → internal size follows (0.75 css scale)', rs && Math.abs(rs.width - 600) <= 2 && Math.abs(rs.height - 450) <= 2, `${rs?.width}x${rs?.height}`)

  // 6. Accent changes + pulse do not throw; intensity is clamped.
  await page.evaluate(() => {
    const lab = window.__shaderLab
    lab.preset('sunset')
    lab.pulse(1.2)
    lab.intensity(7)
    lab.preset('noir')
  })
  await page.waitForTimeout(1500)
  ok('accent/intensity/pulse updates without errors', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

// 7. WebGL1 path (WebGL2 unavailable).
{
  const { ctx, page, errors } = await open({
    init: () => {
      const orig = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        if (type === 'webgl2') return null
        return orig.call(this, type, ...rest)
      }
    },
  }, 'ui=0&music=1')
  await page.waitForTimeout(3000)
  const s = await stats(page)
  ok('WebGL1 fallback compiles and renders', s?.mode === 'webgl1' && s.fps > 50 && errors.length === 0, `${s?.mode} ${s?.fps} fps ${errors.join(' | ')}`)
  await page.screenshot({ path: new URL('../shader/shots/verify-webgl1.png', import.meta.url).pathname })
  await ctx.close()
}

// 8. No WebGL at all → CSS gradient fallback.
{
  const { ctx, page, errors } = await open({
    init: () => {
      const orig = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        if (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl') return null
        return orig.call(this, type, ...rest)
      }
    },
  }, 'ui=0&music=1')
  await page.waitForTimeout(2500)
  const m = await mode(page)
  const pulseOpacity = await page.evaluate(() => getComputedStyle(document.querySelector('.ushf-bg-pulse')).opacity)
  ok('no WebGL → CSS fallback (reactive pulse)', m === 'css' && errors.length === 0, `mode ${m}, pulse opacity ${pulseOpacity}`)
  await page.screenshot({ path: new URL('../shader/shots/verify-css.png', import.meta.url).pathname })
  await ctx.close()
}

// 9. prefers-reduced-motion → 30 fps, flagged.
{
  const { ctx, page, errors } = await open({ reducedMotion: 'reduce' }, 'ui=0&music=1')
  await page.waitForTimeout(2500)
  const m = await measure(page, 3)
  ok('reduced motion → ~30 fps', m.last?.reducedMotion === true && m.fps > 25 && m.fps < 35 && errors.length === 0, `${m.fps.toFixed(1)} fps`)
  await ctx.close()
}

// 10. Busy main thread: adaptive quality must not ratchet down forever when lowering quality doesn't help.
// (With music: a silent scene runs at 30 fps, where these frame costs fit the budget.)
{
  const { ctx, page, errors } = await open({}, 'ui=0&music=1')
  await page.evaluate(() => {
    const busy = () => {
      const t = performance.now()
      while (performance.now() - t < 26) {
        // simulate a heavy main thread
      }
      requestAnimationFrame(busy)
    }
    requestAnimationFrame(busy)
  })
  await page.waitForTimeout(9000)
  const s = await stats(page)
  ok('CPU-bound page: adaptive quality reverts (no pointless downgrade)', s && s.quality === 0 && errors.length === 0, `q${s?.quality}, ${s?.fps} fps, ${s?.frameMs} ms`)
  await ctx.close()
}

// 11. GPU-bound page (draw cost ∝ pixels): quality steps down and stays down.
{
  const { ctx, page, errors } = await open({
    init: () => {
      const orig = WebGL2RenderingContext.prototype.drawArrays
      WebGL2RenderingContext.prototype.drawArrays = function (...a) {
        const c = this.canvas
        const ms = ((c.width * c.height) / (1080 * 675)) * 24
        const t = performance.now()
        while (performance.now() - t < ms) {
          // simulated fill-rate cost
        }
        return orig.apply(this, a)
      }
    },
  }, 'ui=0&music=1')
  await page.waitForTimeout(9000)
  const s = await stats(page)
  ok('GPU-bound page: adaptive quality steps down', s && s.quality > 0 && s.fps > 45 && errors.length === 0, `q${s?.quality} ${s?.width}x${s?.height} ${s?.octaves}oct, ${s?.fps} fps`)
  await ctx.close()
}

// 12. Context lost and never restored → CSS fallback after the timeout.
{
  const { ctx, page, errors } = await open({}, 'ui=0')
  await page.waitForTimeout(1500)
  await page.evaluate(() => {
    const c = document.querySelector('.ushf-bg canvas')
    const gl = c.getContext('webgl2') ?? c.getContext('webgl')
    gl.getExtension('WEBGL_lose_context').loseContext()
  })
  await page.waitForTimeout(6500)
  const m = await mode(page)
  const canvases = await page.evaluate(() => document.querySelectorAll('.ushf-bg canvas').length)
  ok('context never restored → CSS fallback', m === 'css' && canvases === 0 && errors.length === 0, `mode ${m}, canvases ${canvases} ${errors.join(' | ')}`)
  await ctx.close()
}

await browser.close()
console.log(results.join('\n'))
