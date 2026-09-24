// fix-audio lab: measurements behind the audio fixes, driven by scripts/fix-audio/*.mjs.
//  - survey(): loudness of real previews before/after the engine's normalisation trim
//  - sfxTable(): SFX audibility (best 1/3-octave band SNR) against real music windows
//  - limiter(): transparency of the output safety limiter (OfflineAudioContext)
import { audioEngine, engineDebug, getAudioContext, holdSoftUnlock, measureLoudness } from '../../audio/engine'
import { SFX_NAMES, renderSfx } from '../../audio/sfx'
import type { SfxName } from '../../audio/sfx'

const LEN = 4096

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len
    const wr = Math.cos(a)
    const wi = Math.sin(a)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < len / 2; k++) {
        const p = i + k + len / 2
        const xr = re[p] * cr - im[p] * ci
        const xi = re[p] * ci + im[p] * cr
        re[p] = re[i + k] - xr
        im[p] = im[i + k] - xi
        re[i + k] += xr
        im[i + k] += xi
        const t = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = t
      }
    }
  }
}

/** 1/3-octave band energies (dB) of an 85 ms Hann window starting at `start`. */
function bands(x: Float32Array, sr: number, start: number): number[] {
  const re = new Float64Array(LEN)
  const im = new Float64Array(LEN)
  for (let i = 0; i < LEN; i++) re[i] = (x[start + i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / LEN))
  fft(re, im)
  const out: number[] = []
  for (let f = 80; f < 12000; f *= 2 ** (1 / 3)) {
    const k0 = Math.round((f * 2 ** (-1 / 6) * LEN) / sr)
    const k1 = Math.max(k0 + 1, Math.round((f * 2 ** (1 / 6) * LEN) / sr))
    let e = 0
    for (let k = k0; k < k1; k++) e += re[k] * re[k] + im[k] * im[k]
    out.push(10 * Math.log10(e + 1e-20))
  }
  return out
}
const BAND_HZ: number[] = []
for (let f = 80; f < 12000; f *= 2 ** (1 / 3)) BAND_HZ.push(Math.round(f))

/** Max short-window loudness (K-weighted power, LUFS) — the level a short cue is heard at. */
function maxLoud(l: Float32Array, r: Float32Array, sr: number, win: number): number {
  const kw = (x: Float32Array) => {
    let K = Math.tan((Math.PI * 1681.974450955533) / sr)
    let Q = 0.7071752369554196
    const Vh = Math.pow(10, 3.999843853973347 / 20)
    const Vb = Math.pow(Vh, 0.4996667741545416)
    let a0 = 1 + K / Q + K * K
    const s = [(Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0]
    K = Math.tan((Math.PI * 38.13547087602444) / sr)
    Q = 0.5003270373238773
    a0 = 1 + K / Q + K * K
    const h = [1, -2, 1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0]
    const out = new Float32Array(x.length)
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0, z1 = 0, z2 = 0
    for (let i = 0; i < x.length; i++) {
      const v = x[i]
      const y = s[0] * v + s[1] * x1 + s[2] * x2 - s[3] * y1 - s[4] * y2
      x2 = x1
      x1 = v
      const z = h[0] * y + h[1] * y1 + h[2] * y2 - h[3] * z1 - h[4] * z2
      y2 = y1
      y1 = y
      z2 = z1
      z1 = z
      out[i] = z
    }
    return out
  }
  const a = kw(l)
  const b = kw(r)
  const n = Math.round(win * sr)
  const hop = Math.round(0.005 * sr)
  let best = 0
  for (let i = 0; i + n <= a.length; i += hop) {
    let s = 0
    for (let j = i; j < i + n; j++) s += a[j] * a[j] + b[j] * b[j]
    best = Math.max(best, s / n)
  }
  return -0.691 + 10 * Math.log10(best + 1e-20)
}

interface MusicWin {
  label: string
  gainDb: number
  windows: number[][]
}

const music: MusicWin[] = []

async function survey(urls: { label: string; url: string }[]) {
  await audioEngine.unlock()
  const rows: Record<string, unknown>[] = []
  music.length = 0
  for (let i = 0; i < urls.length; i++) {
    const u = urls[i]
    const key = `fx:${i}`
    try {
      const t0 = performance.now()
      const buf = await audioEngine.load(key, u.url)
      const loadMs = Math.round(performance.now() - t0)
      const l = engineDebug.loudness(key)
      if (!l) throw new Error('no loudness')
      // Independent check: measure the trimmed signal.
      const g = Math.pow(10, l.gainDb / 20)
      const ch = [0, 1].map((c) => {
        const src = buf.getChannelData(Math.min(c, buf.numberOfChannels - 1))
        const out = new Float32Array(src.length)
        for (let k = 0; k < src.length; k++) out[k] = src[k] * g
        return out
      })
      const after = await measureLoudness({ numberOfChannels: 2, sampleRate: buf.sampleRate, length: buf.length, getChannelData: (c) => ch[c] })
      const t1 = performance.now()
      await measureLoudness(buf, 1e9)
      const cpuMs = +(performance.now() - t1).toFixed(1)
      rows.push({ label: u.label, lufs: +l.lufs.toFixed(1), peakDb: +l.peakDb.toFixed(1), gainDb: l.gainDb, afterLufs: +after.lufs.toFixed(1), afterPeakDb: +after.peakDb.toFixed(1), loadMs, measureCpuMs: cpuMs })
      const L = buf.getChannelData(0)
      const R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L
      const mono = new Float32Array(L.length)
      for (let k = 0; k < L.length; k++) mono[k] = (L[k] + R[k]) / 2
      const windows: number[][] = []
      for (let w = 0; w < 24; w++) windows.push(bands(mono, buf.sampleRate, Math.round((2 + w * 1.1) * buf.sampleRate)))
      music.push({ label: u.label, gainDb: l.gainDb, windows })
    } catch (e) {
      rows.push({ label: u.label, error: String(e) })
    }
  }
  const stat = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b)
    return { min: s[0], median: s[s.length >> 1], max: s[s.length - 1], spread: +(s[s.length - 1] - s[0]).toFixed(1) }
  }
  const ok = rows.filter((r) => !('error' in r)) as { lufs: number; afterLufs: number; afterPeakDb: number; peakDb: number }[]
  return {
    sampleRate: getAudioContext()?.sampleRate,
    rows,
    before: stat(ok.map((r) => r.lufs)),
    after: stat(ok.map((r) => r.afterLufs)),
    peaksAfter: stat(ok.map((r) => r.afterPeakDb)),
    over0After: ok.filter((r) => r.afterPeakDb > 0).length,
  }
}

type Flow = [SfxName, { gain?: number; pitch?: number }, number?]

/** Audibility of each SFX over the surveyed music (normalised, or raw), optionally with the music ducked by `duckDb`. */
async function sfxTable(flows: Flow[] | null, opts: { normalized?: boolean } = {}) {
  const sr = getAudioContext()?.sampleRate ?? 48000
  const list: Flow[] = flows ?? SFX_NAMES.map((n) => [n, {}] as Flow)
  const norm = opts.normalized !== false
  const out: Record<string, unknown> = {}
  for (const [name, o, duckDb = 0] of list) {
    const b = await renderSfx(name, o, sr)
    const l = b.getChannelData(0)
    const r = b.getChannelData(1)
    let pk = 0
    let on = 0
    for (let i = 0; i < l.length; i++) {
      const v = Math.max(Math.abs(l[i]), Math.abs(r[i]))
      if (v > pk) pk = v
      if (!on && v > 1e-3) on = i
    }
    const mono = l.map((v, i) => (v + r[i]) / 2)
    const sb = bands(mono, sr, on)
    const snrs: number[] = []
    const bestBands: number[] = []
    for (const m of music) {
      const shift = (norm ? m.gainDb : 0) - duckDb
      for (const w of m.windows) {
        let best = -Infinity
        let at = 0
        sb.forEach((v, i) => {
          const d = v - (w[i] + shift)
          if (d > best) {
            best = d
            at = i
          }
        })
        snrs.push(best)
        bestBands.push(at)
      }
    }
    snrs.sort((a, b2) => a - b2)
    // energy share per region
    let eTot = 0
    let e25 = 0
    let eLo = 0
    sb.forEach((v, i) => {
      const e = Math.pow(10, v / 10)
      eTot += e
      if (BAND_HZ[i] >= 2000 && BAND_HZ[i] <= 5000) e25 += e
      if (BAND_HZ[i] < 1500) eLo += e
    })
    const hist = new Map<number, number>()
    for (const i of bestBands) hist.set(BAND_HZ[i], (hist.get(BAND_HZ[i]) ?? 0) + 1)
    const topBand = [...hist.entries()].sort((a, b2) => b2[1] - a[1])[0]?.[0]
    const key = `${name}${o.gain ? '@g' + o.gain : ''}${o.pitch ? '@p' + o.pitch : ''}${duckDb ? '+duck' + duckDb : ''}`
    out[key] = {
      peakDb: +(20 * Math.log10(pk)).toFixed(1),
      loud100ms: +maxLoud(l, r, sr, 0.1).toFixed(1),
      loud400ms: +maxLoud(l, r, sr, 0.4).toFixed(1),
      snrMedian: +snrs[snrs.length >> 1].toFixed(1),
      snrP10: +snrs[Math.floor(snrs.length * 0.1)].toFixed(1),
      shareAudible: +(snrs.filter((v) => v > -3).length / snrs.length).toFixed(2),
      share2to5k: +(e25 / eTot).toFixed(2),
      shareBelow1k5: +(eLo / eTot).toFixed(2),
      topBandHz: topBand,
    }
  }
  return out
}

/** The engine's limiter settings, applied offline to sines at several levels: gain below threshold, ceiling above. */
async function limiter() {
  const sr = 48000
  const res: Record<string, unknown>[] = []
  for (const db of [-20, -6, -2, -1, 0, 1.5, 3, 6]) {
    const ctx = new OfflineAudioContext(1, sr * 2, sr)
    const osc = ctx.createOscillator()
    osc.frequency.value = 440
    const g = ctx.createGain()
    g.gain.value = Math.pow(10, db / 20)
    const lim = ctx.createDynamicsCompressor()
    lim.threshold.value = -1
    lim.knee.value = 0
    lim.ratio.value = 20
    lim.attack.value = 0.002
    lim.release.value = 0.15
    osc.connect(g)
    g.connect(lim)
    lim.connect(ctx.destination)
    osc.start()
    const out = (await ctx.startRendering()).getChannelData(0)
    let pk = 0
    let pkFirst = 0
    for (let i = sr; i < out.length; i++) pk = Math.max(pk, Math.abs(out[i]))
    for (let i = 0; i < Math.round(0.05 * sr); i++) pkFirst = Math.max(pkFirst, Math.abs(out[i]))
    // THD-ish: residual after removing the best-fit 440 Hz sine over the last second
    let sc = 0
    let ss = 0
    let n = 0
    for (let i = sr; i < out.length; i++) {
      const t = i / sr
      sc += out[i] * Math.cos(2 * Math.PI * 440 * t)
      ss += out[i] * Math.sin(2 * Math.PI * 440 * t)
      n++
    }
    const A = (2 * Math.hypot(sc, ss)) / n
    const ph = Math.atan2(sc, ss)
    let resid = 0
    let tot = 0
    for (let i = sr; i < out.length; i++) {
      const t = i / sr
      const fit = A * Math.sin(2 * Math.PI * 440 * t + ph)
      resid += (out[i] - fit) ** 2
      tot += out[i] ** 2
    }
    res.push({ inDb: db, outPeakDb: +(20 * Math.log10(pk)).toFixed(2), gainDb: +(20 * Math.log10(pk) - db).toFixed(2), firstMsPeakDb: +(20 * Math.log10(pkFirst)).toFixed(2), distortionDb: +(10 * Math.log10(resid / tot + 1e-20)).toFixed(1) })
  }
  return res
}


/* ------------------------------------------------------------------ live engine checks */

const WORKLET = `
class FixRec extends AudioWorkletProcessor {
  constructor() {
    super(); this.on = false; this.max = sampleRate * 40; this.n = 0; this.f0 = -1; this.l = null; this.r = null;
    this.port.onmessage = (e) => {
      if (e.data === 'start') { this.l = new Float32Array(this.max); this.r = new Float32Array(this.max); this.n = 0; this.f0 = -1; this.on = true }
      else if (e.data === 'stop') {
        this.on = false
        const l = this.l ? this.l.slice(0, this.n) : new Float32Array(0), r = this.r ? this.r.slice(0, this.n) : new Float32Array(0)
        this.port.postMessage({ f0: this.f0, l, r }, [l.buffer, r.buffer]); this.l = this.r = null
      }
    }
  }
  process(inputs) {
    if (this.on && this.n + 128 <= this.max) {
      if (this.f0 < 0) this.f0 = currentFrame
      const i = inputs[0]
      if (i && i[0]) { this.l.set(i[0], this.n); this.r.set(i[1] || i[0], this.n) }
      this.n += 128
    }
    return true
  }
}
registerProcessor('fix-rec', FixRec)`

interface Rec {
  start(): void
  stop(): Promise<{ f0: number; l: Float32Array; r: Float32Array }>
}

let workletReady: Promise<void> | null = null
async function recorder(source: AudioNode): Promise<Rec> {
  const ctx = source.context as AudioContext
  if (!workletReady) workletReady = ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' })))
  await workletReady
  const node = new AudioWorkletNode(ctx, 'fix-rec', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: 'explicit' })
  const sink = ctx.createGain()
  sink.gain.value = 0
  source.connect(node)
  node.connect(sink)
  sink.connect(ctx.destination)
  let resolve: ((d: { f0: number; l: Float32Array; r: Float32Array }) => void) | null = null
  node.port.onmessage = (e) => resolve?.(e.data)
  return {
    start: () => node.port.postMessage('start'),
    stop: () =>
      new Promise((res) => {
        resolve = (d) => {
          source.disconnect(node)
          node.disconnect()
          sink.disconnect()
          res(d)
        }
        node.port.postMessage('stop')
      }),
  }
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const equal = (from: number, to: number, n: number) => Array.from({ length: n }, (_, i) => ({ start: from + ((to - from) * i) / n, end: from + ((to - from) * (i + 1)) / n }))

async function loadOne(url: string, key = 'fx:live') {
  await audioEngine.unlock()
  return audioEngine.load(key, url)
}

function playAll(key: string, segs: { start: number; end: number }[], order: number[], onPos?: (p: number) => void): Promise<void> {
  return new Promise<void>((resolve) => {
    audioEngine.playSequence(key, (p) => (p < order.length ? segs[order[p]] : null), { tag: 'board', onPosition: onPos, onEnded: resolve })
  })
}

/** Output of a correct-order play-all at the music tap == trim × original, sample for sample (joins included). */
async function exactWithTrim(url: string) {
  const key = 'fx:live'
  const buf = await loadOne(url, key)
  const ctx = getAudioContext()!
  const trim = engineDebug.trimOf(key)
  const rec = await recorder(engineDebug.musicTap()!)
  const segs = equal(2, 10, 8)
  rec.start()
  await wait(100)
  await playAll(key, segs, [0, 1, 2, 3, 4, 5, 6, 7])
  await wait(200)
  const d = await rec.stop()
  const sch = engineDebug.schedule()
  const L = buf.getChannelData(0)
  const R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L
  const s0 = sch[0]
  const last = sch[sch.length - 1]
  const fade = Math.round(0.004 * ctx.sampleRate) + 2
  // Recorder latency (constant): best match of a 1024-sample template 50 ms in.
  const tStart = s0.whenFrame + Math.round(0.05 * ctx.sampleRate)
  let lag = 0
  let bestErr = Infinity
  for (let k = -4096; k <= 4096; k++) {
    let err = 0
    const at = tStart - d.f0 + k
    if (at < 0 || at + 1024 > d.l.length) continue
    for (let i = 0; i < 1024; i += 4) {
      const x = d.l[at + i] - trim * L[s0.startSample + (tStart - s0.whenFrame) + i]
      err += x * x
      if (err > bestErr) break
    }
    if (err < bestErr) {
      bestErr = err
      lag = k
    }
  }
  let maxErr = 0
  let n = 0
  for (let f = s0.whenFrame + fade; f < last.whenFrame + last.frames - fade; f++) {
    const i = f - d.f0 + lag
    if (i < 0 || i >= d.l.length) continue
    const src = s0.startSample + (f - s0.whenFrame)
    maxErr = Math.max(maxErr, Math.abs(d.l[i] - trim * L[src]), Math.abs(d.r[i] - trim * R[src]))
    n++
  }
  return { trim, trimDb: +(20 * Math.log10(trim)).toFixed(2), recorderLagFrames: lag, compared: n, maxErr, joins: sch.map((x) => `${x.join}/${x.outro}`).join(' ') }
}

/** Main-thread stalls right before a boundary during play-all (gapless and shuffled orders). */
async function stalls(url: string, stallsMs: number[]) {
  const key = 'fx:live'
  await loadOne(url, key)
  const ctx = getAudioContext()!
  const sr = ctx.sampleRate
  const segs = equal(1, 25, 16)
  const out: Record<string, unknown>[] = []
  for (const shuffled of [false, true]) {
    for (const stall of stallsMs) {
      const order = shuffled ? [3, 0, 7, 12, 1, 9, 4, 15, 2, 6, 11, 8, 5, 14, 10, 13] : Array.from({ length: 16 }, (_, i) => i)
      const rec = await recorder(engineDebug.musicTap()!)
      rec.start()
      await wait(50)
      const done = playAll(key, segs, order)
      // stall 150 ms before boundary 2 and again right across boundary 5
      const len = segs[0].end - segs[0].start
      await wait(len * 2 * 1000 - 150)
      let t0 = performance.now()
      while (performance.now() - t0 < stall) {
        /* busy */
      }
      await wait(len * 3 * 1000 - stall - 100)
      t0 = performance.now()
      while (performance.now() - t0 < stall) {
        /* busy */
      }
      await wait(1500)
      const stopFrame = Math.round(ctx.currentTime * sr)
      audioEngine.stop(10)
      void done
      await wait(100)
      const d = await rec.stop()
      const sch = engineDebug.schedule()
      const gaps = sch.slice(1).map((x, i) => +(((x.whenFrame - (sch[i].whenFrame + sch[i].frames)) * 1000) / sr).toFixed(1))
      // longest exact-zero run after playback started (a real gap is digital silence)
      const start = sch[0].whenFrame - d.f0 + 16
      const endAt = Math.min(d.l.length, stopFrame - d.f0 - Math.round(0.03 * sr))
      let run = 0
      let best = 0
      let bestAt = 0
      for (let i = start; i < endAt; i++) {
        if (d.l[i] === 0 && d.r[i] === 0) {
          run++
          if (run > best) {
            best = run
            bestAt = i - run + 1
          }
        } else run = 0
      }
      const zeroAtS = (bestAt + d.f0) / sr - sch[0].when
      out.push({ order: shuffled ? 'shuffled' : 'correct', stallMs: stall, scheduled: sch.length, maxGapMs: Math.max(0, ...gaps), resyncs: sch.filter((x) => x.join === 'resync').length, longestZeroRunMs: +((best * 1000) / sr).toFixed(2), zeroAtS: +zeroAtS.toFixed(3), recLenS: +(d.l.length / sr).toFixed(2), recStartVsPlayS: +((d.f0 - sch[0].whenFrame) / sr).toFixed(3), joins: [...new Set(sch.map((x) => x.join))].join(',') })
    }
  }
  return out
}

/** Reorders at different lead times before a boundary: which ones land, and does the audio stay continuous? */
async function reorders(url: string) {
  const key = 'fx:live'
  await loadOne(url, key)
  const ctx = getAudioContext()!
  const sr = ctx.sampleRate
  const segs = equal(1, 17, 8) // 2 s snippets
  const results: Record<string, unknown>[] = []
  for (const leadMs of [900, 400, 150, 90, 30]) {
    const order = [0, 1, 2, 3, 4, 5, 6, 7]
    const rec = await recorder(engineDebug.musicTap()!)
    rec.start()
    await wait(50)
    let swapAtCtx = 0
    const done = playAll(key, segs, order, (p) => {
      if (p !== 1) return
      // position 2 starts 2 s after position 1: swap positions 2 and 5 `leadMs` before that boundary
      setTimeout(() => {
        ;[order[2], order[5]] = [order[5], order[2]]
        swapAtCtx = ctx.currentTime
      }, 2000 - leadMs)
    })
    await done
    await wait(100)
    const d = await rec.stop()
    const sch = engineDebug.schedule()
    const played = sch.map((x) => segs.findIndex((s) => Math.abs(s.start - x.range.start) < 1e-9))
    const b2 = sch.find((x) => x.position === 2)!
    let run = 0
    let best = 0
    for (let i = sch[0].whenFrame - d.f0 + 16; i < sch[sch.length - 1].whenFrame - d.f0; i++) {
      if (d.l[i] === 0 && d.r[i] === 0) {
        run++
        best = Math.max(best, run)
      } else run = 0
    }
    // peak jump across the boundary (click detector): max |x[n]-x[n-1]| within ±2 ms vs the median slope around it
    const at = b2.whenFrame - d.f0
    let jump = 0
    for (let i = at - Math.round(0.002 * sr); i < at + Math.round(0.002 * sr); i++) jump = Math.max(jump, Math.abs(d.l[i] - d.l[i - 1]))
    let ref = 0
    for (let i = at - Math.round(0.05 * sr); i < at - Math.round(0.01 * sr); i++) ref = Math.max(ref, Math.abs(d.l[i] - d.l[i - 1]))
    results.push({
      leadMs,
      swapLeadActualMs: +((b2.when - swapAtCtx) * 1000).toFixed(0),
      landed: played[2] === 5,
      played: played.join(','),
      contiguous: sch.every((x, i) => i === 0 || x.whenFrame === sch[i - 1].whenFrame + sch[i - 1].frames),
      joinAt2: `${sch[1].outro} → ${b2.join}`,
      longestZeroRunMs: +((best * 1000) / sr).toFixed(2),
      boundarySlopeVsBefore: +(jump / (ref || 1)).toFixed(2),
    })
  }
  return results
}

/** Simulated Bluetooth latency: levels must lag the live analysis by ~the output latency. */
async function latency(url: string, latencyS = 0.2) {
  const key = 'fx:live'
  await loadOne(url, key)
  const ctx = getAudioContext()! as AudioContext & { getOutputTimestamp: () => AudioTimestamp }
  const real = ctx.getOutputTimestamp.bind(ctx)
  Object.defineProperty(ctx, 'outputLatency', { configurable: true, get: () => latencyS })
  ctx.getOutputTimestamp = () => {
    const ts = real()
    return { contextTime: (ts.contextTime ?? ctx.currentTime) - latencyS, performanceTime: ts.performanceTime }
  }
  await wait(600)
  const samples: { t: number; raw: number; out: number }[] = []
  let on = true
  const loop = () => {
    if (!on) return
    const lvl = audioEngine.getLevels()
    samples.push({ t: performance.now(), raw: engineDebug.levelsRaw().rmsDb, out: lvl.energy })
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
  await wait(300)
  const t0 = performance.now()
  audioEngine.playFull(key, { tag: 'reveal', from: 8, to: 10 })
  await wait(2600)
  on = false
  delete (ctx as unknown as Record<string, unknown>).getOutputTimestamp
  delete (ctx as unknown as Record<string, unknown>).outputLatency
  const rawRise = samples.find((s) => s.t > t0 && s.raw > -40)
  const outRise = samples.find((s) => s.t > t0 && s.out > 0.05)
  const rawFall = [...samples].reverse().find((s) => s.raw > -40)
  const outFall = [...samples].reverse().find((s) => s.out > 0.05)
  return {
    simulatedLatencyS: latencyS,
    measuredDelayS: +engineDebug.levelsDelay().toFixed(3),
    rawRiseMs: rawRise ? Math.round(rawRise.t - t0) : null,
    outRiseMs: outRise ? Math.round(outRise.t - t0) : null,
    riseLagMs: rawRise && outRise ? Math.round(outRise.t - rawRise.t) : null,
    fallLagMs: rawFall && outFall ? Math.round(outFall.t - rawFall.t) : null,
  }
}

/** Visual levels per track with normalisation on vs off: mean/p90 energy & bass, beats per second. */
async function levelsAB(tracks: { label: string; url: string }[], seconds = 6) {
  await audioEngine.unlock()
  const rows: Record<string, unknown>[] = []
  for (let i = 0; i < tracks.length; i++) {
    const key = `fx:lv${i}`
    await audioEngine.load(key, tracks[i].url)
    const row: Record<string, unknown> = { label: tracks[i].label, trimDb: engineDebug.loudness(key)?.gainDb }
    for (const norm of [false, true]) {
      engineDebug.setNormalization(norm)
      const lv: { e: number; b: number; beat: number }[] = []
      let on = true
      const loop = () => {
        if (!on) return
        const l = audioEngine.getLevels()
        lv.push({ e: l.energy, b: l.bass, beat: l.beat })
        requestAnimationFrame(loop)
      }
      audioEngine.playFull(key, { tag: 'reveal', from: 8, to: 8 + seconds })
      await wait(300)
      requestAnimationFrame(loop)
      await wait(seconds * 1000 - 400)
      on = false
      audioEngine.stop(30)
      await wait(600)
      const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length * p)] ?? 0
      let beats = 0
      for (let k = 1; k < lv.length; k++) if (lv[k].beat > 0.9 && lv[k - 1].beat <= 0.9) beats++
      const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
      row[norm ? 'norm' : 'raw'] = { energyMean: +mean(lv.map((x) => x.e)).toFixed(2), energyP90: +q(lv.map((x) => x.e), 0.9).toFixed(2), bassMean: +mean(lv.map((x) => x.b)).toFixed(2), bassP90: +q(lv.map((x) => x.b), 0.9).toFixed(2), beatsPerS: +(beats / (seconds - 0.4)).toFixed(2) }
    }
    engineDebug.setNormalization(true)
    rows.push(row)
  }
  return rows
}

;(window as unknown as { __fixAudio: unknown }).__fixAudio = { survey, sfxTable, limiter, exactWithTrim, stalls, reorders, latency, levelsAB, ready: true, engineDebug, audioEngine }

/* ------------------------------------------------------------------ unlock playground (?soft=1 holds the Home soft-unlock) */

if (new URLSearchParams(location.search).has('soft')) holdSoftUnlock()
{
  const ui = document.createElement('div')
  ui.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;margin:16px 0'
  ui.innerHTML = `<input id="nick" placeholder="Nickname" style="font-size:16px;padding:10px">
    <button id="avatar" style="font-size:16px;padding:10px 16px">Avatar</button>
    <button id="cta" style="font-size:16px;padding:10px 16px">Crea stanza</button>`
  document.body.appendChild(ui)
  document.getElementById('cta')!.addEventListener('click', () => void audioEngine.unlock())
  ;(window as unknown as { __unlockState: () => unknown }).__unlockState = () => ({
    ctx: getAudioContext()?.state ?? null,
    unlocked: audioEngine.unlocked,
    audioSession: (navigator as Navigator & { audioSession?: { type: string } }).audioSession?.type ?? 'n/a',
    soft: engineDebug.softUnlockHeld(),
    legacy: engineDebug.legacySession(),
  })
}
