// Functional + perf checks for ShaderBackground after the background fixes (port of scripts/shader/verify.mjs).
// Usage: node scripts/fix-background/verify.mjs   (dev server on :5413)
import { chromium } from 'playwright'

const ORIGIN = process.env.ORIGIN ?? 'http://localhost:5413'
const BASE = `${ORIGIN}/lab/shader.html`
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null
const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'] })
const results = []
const ok = (name, pass, detail = '') => {
  const line = `${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`
  results.push(line)
  console.log(line)
}
const want = (id) => !ONLY || ONLY.has(id)

/** Counts drawArrays calls (every shader frame is one draw). */
const COUNT_DRAWS = () => {
  window.__draws = 0
  for (const P of [window.WebGL2RenderingContext?.prototype, window.WebGLRenderingContext?.prototype]) {
    if (!P) continue
    const orig = P.drawArrays
    P.drawArrays = function (...a) {
      window.__draws++
      return orig.apply(this, a)
    }
  }
}

async function open(opts = {}, query = 'ui=0', url = BASE) {
  const ctx = await browser.newContext({ viewport: opts.viewport ?? { width: 1440, height: 900 }, deviceScaleFactor: opts.dsf ?? 1, reducedMotion: opts.reducedMotion ?? 'no-preference', isMobile: !!opts.mobile, hasTouch: !!opts.mobile })
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => {
    if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('404')) errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  await page.addInitScript(COUNT_DRAWS)
  if (opts.init) await page.addInitScript(opts.init)
  await page.goto(`${url}?${query}`, { waitUntil: 'networkidle' })
  return { ctx, page, errors }
}

const stats = (page) => page.evaluate(() => window.__shaderLab?.stats ?? window.__bg?.stats ?? null)
const mode = (page) => page.evaluate(() => document.querySelector('.ushf-bg')?.getAttribute('data-mode'))
/** Shader frames drawn during `ms`. */
const drawsIn = (page, ms) =>
  page.evaluate(async (ms) => {
    const a = window.__draws
    await new Promise((r) => setTimeout(r, ms))
    return window.__draws - a
  }, ms)

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

// 1. Perf: desktop + phone + 4K, idle (30 fps) and with music (60 fps).
if (want('perf'))
  for (const [label, opts] of [
    ['desktop 1440x900', {}],
    ['phone 390x844@2', { viewport: { width: 390, height: 844 }, dsf: 2, mobile: true }],
    ['4K 2560x1440', { viewport: { width: 2560, height: 1440 } }],
  ]) {
    for (const music of [false, true]) {
      const { ctx, page, errors } = await open(opts, `ui=0${music ? '&music=1' : ''}`)
      await page.waitForTimeout(2500)
      const m = await measure(page, 4)
      const l = m.last
      const pass = music ? m.fps > 55 && l?.targetFps === 60 && !l?.idle : m.fps > 27 && m.fps < 33 && l?.targetFps === 30 && l?.idle
      ok(
        `perf ${label} ${music ? 'music → 60 fps' : 'idle → 30 fps'}`,
        pass && errors.length === 0,
        `${m.fps.toFixed(1)} fps (target ${l?.targetFps}, idle ${l?.idle}), frame ${m.frameMs.toFixed(2)} ms, cpu ${m.cpuMs.toFixed(3)} ms, gpu ${m.gpuMs.toFixed(3)} ms, ${l?.width}x${l?.height} q${l?.quality} ${l?.octaves}oct ${l?.mode} parallel=${l?.parallelCompile}${errors.length ? ' ERR ' + errors.join(' | ') : ''}`,
      )
      await ctx.close()
    }
  }

// 2-6. One page: StrictMode, context loss, hidden tab, resize, store updates.
if (want('basics')) {
  const { ctx, page, errors } = await open({}, 'ui=0&music=1')
  await page.waitForTimeout(1500)
  const canvases = await page.evaluate(() => document.querySelectorAll('.ushf-bg canvas').length)
  ok('single canvas after StrictMode remount', canvases === 1, `${canvases} canvas`)

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

  const paused = await page.evaluate(async () => {
    const setVis = (v) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v })
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => v === 'hidden' })
      document.dispatchEvent(new Event('visibilitychange'))
    }
    setVis('hidden')
    await new Promise((r) => setTimeout(r, 300))
    let a = window.__draws
    await new Promise((r) => setTimeout(r, 1200))
    const hiddenFrames = window.__draws - a
    setVis('visible')
    a = window.__draws
    await new Promise((r) => setTimeout(r, 1000))
    return { hiddenFrames, visibleFrames: window.__draws - a }
  })
  ok('pauses while hidden, resumes when visible', paused.hiddenFrames === 0 && paused.visibleFrames > 40, JSON.stringify(paused))

  await page.setViewportSize({ width: 800, height: 600 })
  await page.waitForTimeout(1500)
  const rs = await stats(page)
  ok('resize → internal size follows (0.75 css scale)', rs && Math.abs(rs.width - 600) <= 2 && Math.abs(rs.height - 450) <= 2, `${rs?.width}x${rs?.height}`)

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

// 7. WebGL1 path.
if (want('webgl1')) {
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
  ok('WebGL1 fallback compiles and renders', s?.mode === 'webgl1' && s.fps > 50 && errors.length === 0, `${s?.mode} ${s?.fps} fps parallel=${s?.parallelCompile} ${errors.join(' | ')}`)
  await ctx.close()
}

// 8. No WebGL at all → CSS gradient fallback.
if (want('css')) {
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
  ok('no WebGL → CSS fallback', m === 'css' && errors.length === 0, `mode ${m}`)
  await ctx.close()
}

// 8b. Every shader variant fails to link → CSS fallback (async compile failure path).
if (want('linkfail')) {
  const { ctx, page, errors } = await open({
    init: () => {
      for (const P of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype]) {
        const orig = P.getProgramParameter
        P.getProgramParameter = function (p, pname) {
          if (pname === this.LINK_STATUS) return false
          return orig.call(this, p, pname)
        }
      }
    },
  }, 'ui=0&music=1')
  await page.waitForTimeout(2500)
  const m = await mode(page)
  const canvases = await page.evaluate(() => document.querySelectorAll('.ushf-bg canvas').length)
  const other = errors.filter((e) => !e.includes('[background] program link error'))
  ok('link failure → CSS fallback, canvas removed', m === 'css' && canvases === 0 && other.length === 0, `mode ${m}, canvases ${canvases}, errors ${errors.length} ${other.join(' | ')}`)
  await ctx.close()
}

// 9. prefers-reduced-motion → 30 fps even with music.
if (want('reduced')) {
  const { ctx, page, errors } = await open({ reducedMotion: 'reduce' }, 'ui=0&music=1')
  await page.waitForTimeout(2500)
  const m = await measure(page, 3)
  ok('reduced motion → ~30 fps', m.last?.reducedMotion === true && m.fps > 25 && m.fps < 35 && errors.length === 0, `${m.fps.toFixed(1)} fps`)
  await ctx.close()
}

// 10. Busy main thread: adaptive quality must not ratchet down when lowering quality doesn't help.
if (want('cpubound')) {
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

// 11. GPU-bound page (draw cost ∝ pixels): quality steps down quickly and stays down.
if (want('gpubound')) {
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
  const trace = []
  for (let i = 0; i < 9; i++) {
    await page.waitForTimeout(1000)
    const s = await stats(page)
    trace.push(s ? `q${s.quality}/${Math.round(s.fps)}` : '-')
  }
  const s = await stats(page)
  ok('GPU-bound page: adaptive quality steps down', s && s.quality > 0 && s.fps > 45 && errors.length === 0, `q${s?.quality} ${s?.width}x${s?.height} ${s?.octaves}oct, ${s?.fps} fps; trace ${trace.join(' ')}`)
  await ctx.close()
}

// 11b. Very slow GPU (every frame ~90 ms at q0): lands on the 30 fps level within a few seconds.
if (want('weakgpu')) {
  const { ctx, page, errors } = await open({
    init: () => {
      const orig = WebGL2RenderingContext.prototype.drawArrays
      WebGL2RenderingContext.prototype.drawArrays = function (...a) {
        const c = this.canvas
        const ms = ((c.width * c.height) / (1080 * 675)) * 90
        const t = performance.now()
        while (performance.now() - t < ms) {
          // simulated fill-rate cost
        }
        return orig.apply(this, a)
      }
    },
  }, 'ui=0&music=1')
  const trace = []
  let settled = -1
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(1000)
    const s = await stats(page)
    trace.push(s ? `q${s.quality}${s.throttled ? '@30' : ''}/${Math.round(s.fps)}` : '-')
    if (settled < 0 && s?.throttled) settled = i + 1
  }
  const s = await stats(page)
  ok('weak GPU: settles quickly (30 fps once q3 is still too slow)', s && s.quality === 3 && s.throttled && settled > 0 && settled <= 5 && errors.length === 0, `settled at ~${settled}s; trace ${trace.join(' ')}`)
  await ctx.close()
}

// 12. Context lost and never restored → CSS fallback after the timeout.
if (want('neverrestored')) {
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

// 13-15. Idle ↔ music transitions and pulse wake-up.
if (want('idle')) {
  const { ctx, page, errors } = await open({}, 'ui=0')
  await page.waitForTimeout(3000)
  const idleDraws = await drawsIn(page, 1000)
  await page.evaluate(() => window.__shaderLab.synth.setPlaying(true))
  await page.waitForTimeout(120)
  const liveDraws = await drawsIn(page, 1000)
  ok('silent → 30 fps; music → back to 60 fps within ~0.1 s', idleDraws >= 26 && idleDraws <= 34 && liveDraws >= 55, `idle ${idleDraws}/s, live ${liveDraws}/s`)

  await page.evaluate(() => window.__shaderLab.synth.setPlaying(false))
  const t0 = Date.now()
  let back = -1
  for (let i = 0; i < 56; i++) {
    await page.waitForTimeout(250)
    const s = await stats(page)
    if (s?.idle && s.targetFps === 30) {
      back = (Date.now() - t0) / 1000
      break
    }
  }
  ok('music stops → idle again once the flow has slowed (< 7.5 s incl. the synth fade-out and 1 s stats)', back > 0 && back < 7.5, `idle after ${back}s`)

  await page.waitForTimeout(1500)
  await page.evaluate(() => window.__shaderLab.pulse(1))
  const pulseDraws = await drawsIn(page, 500)
  ok('pulse() while idle renders its ring at 60 fps', pulseDraws >= 27, `${pulseDraws} frames in 500 ms`)

  await page.waitForTimeout(3000)
  await page.evaluate(() => window.__shaderLab.preset('sunset'))
  const tweenDraws = await drawsIn(page, 800)
  ok('accent tween while idle renders at 60 fps', tweenDraws >= 42, `${tweenDraws} frames in 800 ms`)
  ok('idle transitions without console errors', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

// 16. Mounted paused: one frame shown, then no more frames.
if (want('pausedmount')) {
  const { ctx, page, errors } = await open({}, 'paused=1&music=1', `${ORIGIN}/lab/fix-background.html`)
  await page.waitForTimeout(2000)
  const opacity = await page.evaluate(() => document.querySelector('.ushf-bg canvas')?.style.opacity)
  const draws = await page.evaluate(() => window.__draws)
  const later = await drawsIn(page, 1000)
  await page.evaluate(() => window.__bg.pause(false))
  await page.waitForTimeout(300)
  const resumed = await drawsIn(page, 1000)
  ok('mounted paused → one frame shown, loop stopped, resumes on unpause', opacity === '1' && draws >= 1 && draws <= 2 && later === 0 && resumed >= 55 && errors.length === 0, `opacity ${opacity}, draws ${draws}, +${later} while paused, ${resumed}/s after unpause ${errors.join(' | ')}`)
  await ctx.close()
}

// 17. Boot: the WebGL context is created after the first paint, compiles don't block.
if (want('boot')) {
  for (const [label, opts] of [
    ['desktop', {}],
    ['phone', { viewport: { width: 390, height: 844 }, dsf: 3, mobile: true }],
  ]) {
    const { ctx, page, errors } = await open({
      ...opts,
      init: () => {
        window.__g = { ctx: [], status: 0, completion: 0, first: 0, lt: [] }
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) window.__g.lt.push([Math.round(e.startTime), Math.round(e.duration)])
        }).observe({ type: 'longtask', buffered: true })
        const gc = HTMLCanvasElement.prototype.getContext
        HTMLCanvasElement.prototype.getContext = function (t, ...a) {
          const s = performance.now()
          const r = gc.call(this, t, ...a)
          if (/webgl/.test(t)) window.__g.ctx.push([t, Math.round(s), +(performance.now() - s).toFixed(1)])
          return r
        }
        const P = WebGL2RenderingContext.prototype
        for (const m of ['getShaderParameter', 'getProgramParameter']) {
          const o = P[m]
          P[m] = function (obj, pname) {
            const s = performance.now()
            const r = o.call(this, obj, pname)
            if (pname === 0x91b1) window.__g.completion += performance.now() - s
            else window.__g.status += performance.now() - s
            return r
          }
        }
        const d = P.drawArrays
        P.drawArrays = function (...a) {
          if (!window.__g.first) window.__g.first = Math.round(performance.now())
          return d.apply(this, a)
        }
        try {
          localStorage.setItem('unshuffle:onboarded', '1')
        } catch {}
      },
    }, '', `${ORIGIN}/`)
    await page.waitForTimeout(3000)
    const r = await page.evaluate(() => ({ fcp: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? -1), ...window.__g, status: +window.__g.status.toFixed(1), completion: +window.__g.completion.toFixed(1) }))
    const ctxAt = r.ctx[0]?.[1] ?? -1
    ok(`boot ${label}: context created after first paint`, ctxAt > r.fcp && r.fcp > 0 && errors.length === 0, JSON.stringify(r))
    await ctx.close()
  }
}

// 18. Grain layer: one tile of overscan instead of 96px on every side.
if (want('grain')) {
  for (const [label, opts, tile] of [
    ['desktop dpr1', {}, 128],
    ['phone dpr3', { viewport: { width: 390, height: 844 }, dsf: 3, mobile: true }, 64],
  ]) {
    const { ctx, page } = await open(opts, 'ui=0')
    await page.waitForTimeout(800)
    const g = await page.evaluate(() => {
      const el = document.querySelector('.ushf-bg-grain')
      const cs = getComputedStyle(el)
      return { w: el.offsetWidth, h: el.offsetHeight, top: cs.top, left: cs.left, size: cs.backgroundSize, anim: cs.animationName, vw: innerWidth, vh: document.querySelector('.ushf-bg').offsetHeight }
    })
    ok(`grain layer ${label}: viewport + one ${tile}px tile`, g.w === g.vw + tile && g.h === g.vh + tile && g.size === `${tile}px ${tile}px`, JSON.stringify(g))
    await ctx.close()
  }
}

await browser.close()
const fails = results.filter((l) => l.startsWith('FAIL')).length
console.log(`\n${results.length - fails}/${results.length} passed`)
