// In-page QA helpers (injected as an init script). Taps the app's audio graph:
//  - every node connected straight to ctx.destination is remembered (master = music
//    after duck+volume, sfxVolume = SFX bus after volume)
//  - AudioWorklet recorders with exact context frame stamps
// Everything lives on window.__qa.
;(() => {
  const qa = (window.__qa = { taps: [], internal: false })
  const origConnect = AudioNode.prototype.connect
  AudioNode.prototype.connect = function (dest, ...rest) {
    const r = origConnect.call(this, dest, ...rest)
    if (!qa.internal && typeof AudioDestinationNode !== 'undefined' && dest instanceof AudioDestinationNode) {
      qa.taps.push({ node: this, kind: this.constructor.name, ctx: this.context })
    }
    return r
  }
  const WORKLET = `
class QaRec extends AudioWorkletProcessor {
  constructor() {
    super(); this.on = false; this.max = 48000 * 75; this.n = 0; this.f0 = 0; this.l = null; this.r = null;
    this.port.onmessage = (e) => {
      if (e.data === 'start') { this.l = new Float32Array(this.max); this.r = new Float32Array(this.max); this.n = 0; this.on = true; this.f0 = -1; }
      else if (e.data === 'stop') {
        this.on = false;
        const l = this.l ? this.l.slice(0, this.n) : new Float32Array(0), r = this.r ? this.r.slice(0, this.n) : new Float32Array(0);
        this.port.postMessage({ f0: this.f0, l, r }, [l.buffer, r.buffer]); this.l = this.r = null;
      }
    };
  }
  process(inputs) {
    if (this.on && this.n + 128 <= this.max) {
      if (this.f0 < 0) this.f0 = currentFrame;
      const i = inputs[0];
      if (i && i[0]) { this.l.set(i[0], this.n); this.r.set(i[1] || i[0], this.n); }
      this.n += 128;
    }
    return true;
  }
}
registerProcessor('qa-rec', QaRec);`
  qa.setup = async (ctx) => {
    if (qa.ctx === ctx) return
    qa.ctx = ctx
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' }))
    await ctx.audioWorklet.addModule(url)
    qa.recs = {}
    const sink = ctx.createGain()
    sink.gain.value = 0
    qa.internal = true
    origConnect.call(sink, ctx.destination)
    qa.internal = false
    qa.makeRec = (name, source) => {
      const node = new AudioWorkletNode(ctx, 'qa-rec', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: 'explicit' })
      const rec = { node, data: null }
      let resolveStop = null
      node.port.onmessage = (e) => { rec.data = e.data; if (resolveStop) resolveStop() }
      origConnect.call(source, node)
      origConnect.call(node, sink)
      rec.start = () => { rec.data = null; node.port.postMessage('start') }
      rec.stop = () => new Promise((res) => { resolveStop = res; node.port.postMessage('stop') })
      /** Samples [f0, f1) in context frames → {l, r} (zeros where not recorded). */
      rec.range = (f0, f1) => {
        const n = Math.max(0, f1 - f0)
        const l = new Float32Array(n)
        const r = new Float32Array(n)
        const d = rec.data
        if (!d) return { l, r }
        const a = Math.max(f0, d.f0), b = Math.min(f1, d.f0 + d.l.length)
        if (b > a) { l.set(d.l.subarray(a - d.f0, b - d.f0), a - f0); r.set(d.r.subarray(a - d.f0, b - d.f0), a - f0) }
        return { l, r }
      }
      rec.first = () => (rec.data ? rec.data.f0 : 0)
      rec.last = () => (rec.data ? rec.data.f0 + rec.data.l.length : 0)
      /** Int16 stereo interleaved, base64 — for analysis in node. */
      rec.dump = () => {
        const d = rec.data
        const n = d.l.length
        const u = new Int16Array(n * 2)
        for (let i = 0; i < n; i++) { u[2 * i] = Math.max(-1, Math.min(1, d.l[i])) * 32767; u[2 * i + 1] = Math.max(-1, Math.min(1, d.r[i])) * 32767 }
        const u8 = new Uint8Array(u.buffer)
        let s = ''
        for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000))
        return { f0: d.f0, b64: btoa(s) }
      }
      qa.recs[name] = rec
      return rec
    }
  }
  // ---- metrics
  qa.kweight = (x, fs) => {
    const biquad = (b0, b1, b2, a0, a1, a2) => (s) => {
      const out = new Float32Array(s.length)
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0
      for (let i = 0; i < s.length; i++) {
        const y = (b0 * s[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0
        x2 = x1; x1 = s[i]; y2 = y1; y1 = y; out[i] = y
      }
      return out
    }
    let G = 3.99984385397, Q = 0.7071752369554193, fc = 1681.9744509555319
    let A = Math.pow(10, G / 40), w0 = (2 * Math.PI * fc) / fs, al = Math.sin(w0) / (2 * Q), c = Math.cos(w0)
    const shelf = biquad(A * ((A + 1) + (A - 1) * c + 2 * Math.sqrt(A) * al), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - 2 * Math.sqrt(A) * al), (A + 1) - (A - 1) * c + 2 * Math.sqrt(A) * al, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - 2 * Math.sqrt(A) * al)
    Q = 0.5003270373253953; fc = 38.13547087613982; w0 = (2 * Math.PI * fc) / fs; al = Math.sin(w0) / (2 * Q); c = Math.cos(w0)
    const hp = biquad((1 + c) / 2, -(1 + c), (1 + c) / 2, 1 + al, -2 * c, 1 - al)
    return hp(shelf(x))
  }
  /** Loudness stats of a stereo signal: integrated (ungated, over non-silent 400 ms blocks), max momentary, max short-term, peak, RMS dBFS. */
  qa.loud = (l, r, fs) => {
    const kl = qa.kweight(l, fs), kr = qa.kweight(r, fs)
    const blk = Math.round(0.4 * fs), hop = Math.round(0.1 * fs)
    const ms = []
    for (let i = 0; i + blk <= kl.length; i += hop) {
      let s = 0
      for (let j = i; j < i + blk; j++) s += kl[j] * kl[j] + kr[j] * kr[j]
      ms.push(s / blk)
    }
    const lufs = (p) => -0.691 + 10 * Math.log10(p + 1e-20)
    const gated = ms.filter((p) => lufs(p) > -70)
    const integ = gated.length ? lufs(gated.reduce((a, b) => a + b, 0) / gated.length) : -Infinity
    // relative gate -10 LU (BS.1770)
    const rel = gated.filter((p) => lufs(p) > integ - 10)
    const integRel = rel.length ? lufs(rel.reduce((a, b) => a + b, 0) / rel.length) : -Infinity
    let peak = 0, sq = 0
    for (let i = 0; i < l.length; i++) { peak = Math.max(peak, Math.abs(l[i]), Math.abs(r[i])); sq += (l[i] * l[i] + r[i] * r[i]) / 2 }
    const st = []
    for (let i = 0; i + 30 <= ms.length; i++) st.push(ms.slice(i, i + 30).reduce((a, b) => a + b, 0) / 30)
    return {
      integratedLUFS: +integRel.toFixed(1),
      maxMomentaryLUFS: ms.length ? +Math.max(...ms.map(lufs)).toFixed(1) : null,
      maxShortTermLUFS: st.length ? +Math.max(...st.map(lufs)).toFixed(1) : null,
      peakDbfs: +(20 * Math.log10(peak + 1e-12)).toFixed(1),
      rmsDbfs: +(10 * Math.log10(sq / Math.max(1, l.length) + 1e-20)).toFixed(1),
    }
  }
  qa.wav = (l, r, fs) => {
    const n = l.length
    const buf = new ArrayBuffer(44 + n * 4)
    const v = new DataView(buf)
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true)
    v.setUint32(24, fs, true); v.setUint32(28, fs * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 4, true)
    for (let i = 0; i < n; i++) {
      v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, l[i])) * 32767, true)
      v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, r[i])) * 32767, true)
    }
    let s = ''
    const u8 = new Uint8Array(buf)
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000))
    return btoa(s)
  }
})()
