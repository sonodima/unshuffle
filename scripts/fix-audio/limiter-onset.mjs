// Limiter (engine settings) onset behaviour: initial state and after 1 s of silence.
import { chromium } from 'playwright'
const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage()
await p.setContent('<html></html>')
const r = await p.evaluate(async () => {
  const sr = 48000
  const run = async (silenceS, db) => {
    const ctx = new OfflineAudioContext(1, Math.round(sr * (silenceS + 0.6)), sr)
    const osc = ctx.createOscillator(); osc.frequency.value = 440
    const g = ctx.createGain(); g.gain.value = 0; g.gain.setValueAtTime(Math.pow(10, db / 20), silenceS)
    const lim = ctx.createDynamicsCompressor()
    Object.assign(lim, {}); lim.threshold.value = -1; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.15
    osc.connect(g); g.connect(lim); lim.connect(ctx.destination); osc.start()
    const out = (await ctx.startRendering()).getChannelData(0)
    const env = []
    for (let ms = 0; ms < 120; ms += 5) {
      let pk = 0
      const a = Math.round((silenceS + ms / 1000) * sr), z = a + Math.round(0.005 * sr)
      for (let i = a; i < z; i++) pk = Math.max(pk, Math.abs(out[i]))
      env.push(+(20 * Math.log10(pk + 1e-9) - db).toFixed(2))
    }
    return env
  }
  return { initial: await run(0, -6), afterSilence: await run(1, -6), afterSilenceHot: await run(1, 0) }
})
console.log('gain (dB) per 5 ms window after onset, -6 dBFS tone')
console.log(' at start of graph:', r.initial.join(' '))
console.log(' after 1 s silence:', r.afterSilence.join(' '))
console.log(' 0 dBFS after 1 s  :', r.afterSilenceHot.join(' '))
await b.close()
