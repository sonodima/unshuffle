// Music gain envelope at the output (projection of output on the music tap, 20 ms windows):
//  A) reveal flips: 8 × 'correct'/'wrong' every 0.2 s → no pumping (was a 5 Hz -3/-1.4 dB tremolo)
//  B) duckMusic(5, 0.9) then a light duckMusic(1.5, 0.05) 100 ms later → stays at -5 dB (deepest wins)
//  C) countdown ticks: tick duck 1.5 dB / tickUrgent 2.5 dB, short
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { labEval } from './lib.mjs'
const BASE = process.env.BASE ?? 'http://localhost:5410'
const lib = readFileSync(new URL('./qa-lib.js', import.meta.url), 'utf8')
const url = (await (await fetch('https://api.deezer.com/track/13791930')).json()).preview
const b = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const ctx = await b.newContext()
await ctx.addInitScript({ content: lib })
const p = await ctx.newPage()
const res = await labEval(p, `${BASE}/lab/fix-audio.html`, async (url) => {
  const eng = await import('/src/audio/engine.ts')
  const { sfx } = await import('/src/audio/sfx.ts')
  await eng.audioEngine.unlock()
  const c = eng.getAudioContext()
  await window.__qa.setup(c)
  const outNode = window.__qa.taps.filter((t) => t.ctx === c && t.kind === 'DynamicsCompressorNode').pop()?.node
  await eng.audioEngine.load('dk', url)
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const scenario = async (name, act) => {
    const out = window.__qa.makeRec(`o-${name}`, outNode)
    const pre = window.__qa.makeRec(`p-${name}`, eng.engineDebug.musicTap())
    out.start(); pre.start()
    eng.audioEngine.playFull('dk', { tag: 'reveal', from: 6, to: 16 })
    await wait(800)
    const t0 = c.currentTime
    await act()
    await wait(1200)
    eng.audioEngine.stop(30)
    await wait(150)
    await out.stop(); await pre.stop()
    const sr = c.sampleRate, win = Math.round(0.02 * sr)
    const O = (k) => out.data.l[k - out.data.f0] ?? 0
    const M = (k) => pre.data.l[k - pre.data.f0] ?? 0
    // limiter lookahead delays the output: find the lag on 100 ms before the action
    const a0 = Math.round((t0 - 0.2) * sr)
    let lag = 0, best = -Infinity
    for (let L = 0; L < 1200; L++) { let xy = 0; for (let k = a0; k < a0 + Math.round(0.1 * sr); k += 2) xy += O(k + L) * M(k); if (xy > best) { best = xy; lag = L } }
    const env = []
    for (let f = Math.round(t0 * sr) - win * 5; f + win < Math.round((t0 + 3) * sr); f += win) {
      let xy = 0, yy = 0
      for (let k = f; k < f + win; k++) { const o = O(k + lag), m = M(k); xy += o * m; yy += m * m }
      env.push(yy > 1e-9 ? 20 * Math.log10(Math.max(1e-6, xy / yy)) : NaN)
    }
    const vol = 20 * Math.log10(0.81) + 0.57 // volume 0.9² + limiter makeup
    const rel = env.map((x) => +(x - vol).toFixed(2))
    const fin = rel.filter(Number.isFinite)
    return { name, lagMs: +((lag / sr) * 1000).toFixed(2), minDb: Math.min(...fin), maxDb: Math.max(...fin), env20ms: rel.slice(0, 120).map((x) => Math.round(x * 10) / 10).join(' ') }
  }
  const rows = []
  rows.push(await scenario('flips', async () => { for (let k = 0; k < 8; k++) { sfx.play(k % 3 ? 'correct' : 'wrong', { gain: 0.9 }); await wait(200) } }))
  rows.push(await scenario('deep-then-light', async () => { eng.duckMusic(5, 0.9); await wait(100); eng.duckMusic(1.5, 0.05) }))
  rows.push(await scenario('ticks', async () => { for (let k = 0; k < 3; k++) { sfx.play('tick'); await wait(1000) } }))
  return rows
}, url)
for (const r of res) console.log(`${r.name.padEnd(16)} lag ${r.lagMs} ms  min ${r.minDb} dB  max ${r.maxDb} dB\n  ${r.env20ms}`)
await b.close()
