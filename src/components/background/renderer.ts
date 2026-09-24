// Thin WebGL layer: context creation (WebGL2 → WebGL1), per-octave program cache,
// one full-screen triangle, uniform upload. No React, no timing logic.

import { VERTEX_ES1, VERTEX_ES3, fragmentSource } from './shaders'

type GL = WebGL2RenderingContext | WebGLRenderingContext

export interface FrameUniforms {
  /** CSS px per internal px. */
  px: number
  time: number
  clock: number
  bass: number
  mid: number
  treble: number
  energy: number
  flash: number
  presence: number
  intensity: number
  motion: number
  ringAge: Float32Array
  ringAmp: Float32Array
  colA: readonly number[]
  colB: readonly number[]
  colC: readonly number[]
  /** Shadow tones of A and B (split toning). */
  shadeA: readonly number[]
  shadeB: readonly number[]
}

/** Program availability: `ready` = something to draw with, `pending` = first compile in flight, `failed` = no variant links. */
export type RendererStatus = 'ready' | 'pending' | 'failed'

export interface GlRenderer {
  readonly gl: GL
  readonly webgl2: boolean
  /** Compiles run in the background (KHR_parallel_shader_compile) instead of blocking the main thread. */
  readonly parallel: boolean
  /** Octave count of the program in use (0 before the first one linked). */
  readonly octaves: number
  /** A variant is still compiling (the one in use, if any, keeps drawing meanwhile). */
  readonly compiling: boolean
  isLost(): boolean
  /**
   * (Re)creates GPU resources, e.g. after `webglcontextrestored`, and starts compiling
   * the preferred variant. Returns false on immediate failure; `poll()` reports the rest.
   */
  init(octaves: number): boolean
  /** Switches variant once it has compiled; a variant that fails keeps the current one. */
  setOctaves(octaves: number): void
  /** Advances pending compiles (non-blocking with KHR_parallel_shader_compile). Call once per frame. */
  poll(): RendererStatus
  setSize(width: number, height: number): void
  draw(u: FrameUniforms): void
  dispose(): void
}

const UNIFORMS = ['uRes', 'uPx', 'uTime', 'uClock', 'uAudio', 'uPulse', 'uRingAge', 'uRingAmp', 'uColA', 'uColB', 'uColC', 'uShadeA', 'uShadeB'] as const
type UniformName = (typeof UNIFORMS)[number]

interface Program {
  program: WebGLProgram
  loc: Record<UniformName, WebGLUniformLocation | null>
}

/** A link in flight: its shaders stay alive until the result is read (for the error log). */
interface Build {
  octaves: number
  program: WebGLProgram
  vs: WebGLShader
  fs: WebGLShader
}

interface ParallelCompileExt {
  readonly COMPLETION_STATUS_KHR: number
}

const CONTEXT_ATTRS: WebGLContextAttributes = {
  alpha: false,
  antialias: false,
  depth: false,
  stencil: false,
  premultipliedAlpha: false,
  preserveDrawingBuffer: false,
  powerPreference: 'low-power',
  failIfMajorPerformanceCaveat: false,
}

/** Variants tried, in order, when the preferred one does not compile on this driver. */
const FALLBACK_OCTAVES = [4, 3]

export function createRenderer(canvas: HTMLCanvasElement): GlRenderer | null {
  let gl: GL | null = null
  let webgl2 = false
  try {
    gl = canvas.getContext('webgl2', CONTEXT_ATTRS)
    if (gl) webgl2 = true
    else gl = (canvas.getContext('webgl', CONTEXT_ATTRS) ?? canvas.getContext('experimental-webgl', CONTEXT_ATTRS)) as WebGLRenderingContext | null
  } catch {
    gl = null
  }
  if (!gl) return null
  const ctx: GL = gl

  let parallelExt: ParallelCompileExt | null = null
  const acquireParallel = () => {
    try {
      parallelExt = ctx.getExtension('KHR_parallel_shader_compile') as ParallelCompileExt | null
    } catch {
      parallelExt = null
    }
  }
  acquireParallel()

  /** Linked variants by octave count; null = failed on this driver. */
  const programs = new Map<number, Program | null>()
  let vbo: WebGLBuffer | null = null
  let current: Program | null = null
  let build: Build | null = null
  /** Variant asked for (the one in use until it has linked). */
  let wanted = 0
  /** First-program fallbacks still to try (when nothing is in use yet). */
  let chain: number[] = []
  let octaves = 0
  let width = 1
  let height = 1

  /** Queues compile + link without reading any status back (no main-thread stall). */
  function start(oct: number): Build | null {
    const vs = ctx.createShader(ctx.VERTEX_SHADER)
    const fs = ctx.createShader(ctx.FRAGMENT_SHADER)
    const program = ctx.createProgram()
    if (!vs || !fs || !program) {
      if (vs) ctx.deleteShader(vs)
      if (fs) ctx.deleteShader(fs)
      if (program) ctx.deleteProgram(program)
      return null
    }
    ctx.shaderSource(vs, webgl2 ? VERTEX_ES3 : VERTEX_ES1)
    ctx.shaderSource(fs, fragmentSource(webgl2, oct))
    ctx.compileShader(vs)
    ctx.compileShader(fs)
    ctx.attachShader(program, vs)
    ctx.attachShader(program, fs)
    ctx.bindAttribLocation(program, 0, 'aPos')
    ctx.linkProgram(program)
    return { octaves: oct, program, vs, fs }
  }

  /** True when reading the link status will not block (always true without the extension). */
  function settled(b: Build): boolean {
    if (!parallelExt) return true
    return ctx.getProgramParameter(b.program, parallelExt.COMPLETION_STATUS_KHR) === true
  }

  /** Reads the link result: one status query instead of one per shader. */
  function finish(b: Build): Program | null {
    const linked = ctx.getProgramParameter(b.program, ctx.LINK_STATUS) === true
    if (!linked) {
      if (!ctx.isContextLost()) {
        let logged = false
        for (const sh of [b.vs, b.fs]) {
          if (ctx.getShaderParameter(sh, ctx.COMPILE_STATUS)) continue
          console.error('[background] shader compile error:', ctx.getShaderInfoLog(sh))
          logged = true
        }
        if (!logged) console.error('[background] program link error:', ctx.getProgramInfoLog(b.program))
      }
      ctx.deleteShader(b.vs)
      ctx.deleteShader(b.fs)
      ctx.deleteProgram(b.program)
      return null
    }
    // Attached shaders are only flagged for deletion; they go with the program.
    ctx.deleteShader(b.vs)
    ctx.deleteShader(b.fs)
    const loc = {} as Record<UniformName, WebGLUniformLocation | null>
    for (const name of UNIFORMS) loc[name] = ctx.getUniformLocation(b.program, name)
    return { program: b.program, loc }
  }

  function adopt(p: Program, oct: number): void {
    current = p
    octaves = oct
    ctx.useProgram(p.program)
  }

  function status(): RendererStatus {
    return current ? 'ready' : 'pending'
  }

  function releaseAll(): void {
    for (const p of programs.values()) if (p) ctx.deleteProgram(p.program)
    programs.clear()
    if (build) {
      ctx.deleteShader(build.vs)
      ctx.deleteShader(build.fs)
      ctx.deleteProgram(build.program)
    }
    build = null
    if (vbo) ctx.deleteBuffer(vbo)
    vbo = null
    current = null
  }

  const renderer: GlRenderer = {
    gl: ctx,
    webgl2,
    get parallel() {
      return !!parallelExt
    },
    get octaves() {
      return octaves
    },
    get compiling() {
      return !!build || (!!current && wanted !== octaves)
    },
    isLost: () => ctx.isContextLost(),
    init(preferred) {
      if (ctx.isContextLost()) return false
      // Old objects died with the context (restore) or never existed (first init).
      programs.clear()
      build = null
      current = null
      octaves = 0
      acquireParallel()
      vbo = ctx.createBuffer()
      if (!vbo) return false
      ctx.bindBuffer(ctx.ARRAY_BUFFER, vbo)
      ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), ctx.STATIC_DRAW)
      ctx.enableVertexAttribArray(0)
      ctx.vertexAttribPointer(0, 2, ctx.FLOAT, false, 0, 0)
      ctx.disable(ctx.DEPTH_TEST)
      ctx.disable(ctx.BLEND)
      wanted = preferred
      chain = FALLBACK_OCTAVES.filter((o) => o !== preferred)
      build = start(preferred)
      if (!build) programs.set(preferred, null)
      return true
    },
    setOctaves(oct) {
      wanted = oct
    },
    poll() {
      // Statuses read on a lost context are meaningless (and would look like failures).
      if (ctx.isContextLost()) return status()
      for (;;) {
        if (build) {
          if (!settled(build)) return status()
          const b = build
          build = null
          programs.set(b.octaves, finish(b))
        }
        const p = programs.get(wanted)
        if (p) {
          if (p !== current) adopt(p, wanted)
          return 'ready'
        }
        if (p === null) {
          // That variant does not work here: keep the one in use, or try the next fallback.
          if (current) {
            wanted = octaves
            return 'ready'
          }
          const next = chain.shift()
          if (next === undefined) return 'failed'
          wanted = next
          continue
        }
        build = start(wanted)
        if (!build) programs.set(wanted, null)
      }
    },
    setSize(w, h) {
      width = Math.max(1, Math.round(w))
      height = Math.max(1, Math.round(h))
      if (canvas.width !== width) canvas.width = width
      if (canvas.height !== height) canvas.height = height
    },
    draw(u) {
      const p = current
      if (!p || ctx.isContextLost()) return
      const l = p.loc
      ctx.viewport(0, 0, width, height)
      ctx.uniform2f(l.uRes, width, height)
      ctx.uniform1f(l.uPx, u.px)
      ctx.uniform1f(l.uTime, u.time)
      ctx.uniform1f(l.uClock, u.clock)
      ctx.uniform4f(l.uAudio, u.bass, u.mid, u.treble, u.energy)
      ctx.uniform4f(l.uPulse, u.flash, u.presence, u.intensity, u.motion)
      ctx.uniform4fv(l.uRingAge, u.ringAge)
      ctx.uniform4fv(l.uRingAmp, u.ringAmp)
      ctx.uniform3f(l.uColA, u.colA[0], u.colA[1], u.colA[2])
      ctx.uniform3f(l.uColB, u.colB[0], u.colB[1], u.colB[2])
      ctx.uniform3f(l.uColC, u.colC[0], u.colC[1], u.colC[2])
      ctx.uniform3f(l.uShadeA, u.shadeA[0], u.shadeA[1], u.shadeA[2])
      ctx.uniform3f(l.uShadeB, u.shadeB[0], u.shadeB[1], u.shadeB[2])
      ctx.drawArrays(ctx.TRIANGLES, 0, 3)
    },
    dispose() {
      if (!ctx.isContextLost()) releaseAll()
      else {
        programs.clear()
        build = null
        current = null
      }
      // Free the context right away instead of waiting for GC (browsers cap live contexts).
      try {
        ctx.getExtension('WEBGL_lose_context')?.loseContext()
      } catch {
        // already gone
      }
    },
  }
  return renderer
}
