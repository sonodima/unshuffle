// Output (after the limiter) at volume 1.0: music + a pile of SFX never clips; loudness per track after normalisation.
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { labEval } from './lib.mjs'
const BASE = process.env.BASE ?? 'http://localhost:5410'
const lib = readFileSync(new URL('./qa-lib.js', import.meta.url), 'utf8')
const tracks = JSON.parse(readFileSync(new URL('./tracks.json', import.meta.url), 'utf8'))
const pick = ['Annalisa', 'Bad Bunny', 'Netsky', 'Miles']
const urls = []
for (const n of pick) { const t = tracks.find((x) => x.label.includes(n)); urls.push({ label: t.label, url: (await (await fetch(`https://api.deezer.com/track/${t.id}`)).json()).preview }) }
const b = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const ctx = await b.newContext()
await ctx.addInitScript({ content: lib })
const p = await ctx.newPage()
const res = await labEval(p, `${BASE}/lab/fix-audio.html`, async (urls) => {
  const eng = await import('/src/audio/engine.ts')
  const { sfx } = await import('/src/audio/sfx.ts')
  await eng.audioEngine.unlock()
  const c = eng.getAudioContext()
  await window.__qa.setup(c)
  const outNode = window.__qa.taps.filter((t) => t.ctx === c && t.kind === 'DynamicsCompressorNode').pop()?.node
  const rows = []
  for (let i = 0; i < urls.length; i++) {
    const key = `op:${i}`
    await eng.audioEngine.load(key, urls[i].url)
    eng.audioEngine.setVolume(1)
    const rec = window.__qa.makeRec(`out${i}`, outNode)
    const pre = window.__qa.makeRec(`pre${i}`, eng.engineDebug.musicTap())
    rec.start(); pre.start()
    eng.audioEngine.playFull(key, { tag: 'reveal', from: 5, to: 13 })
    const wait = (ms) => new Promise((r) => setTimeout(r, ms))
    await wait(1500)
    for (let k = 0; k < 4; k++) { sfx.play('tick'); await wait(300); sfx.play('tickUrgent'); await wait(300) }
    sfx.play('alarm'); await wait(200); sfx.play('go'); await wait(400); sfx.play('fanfare'); await wait(1600)
    eng.audioEngine.stop(50)
    await wait(200)
    await rec.stop(); await pre.stop()
    let pk = 0, pkPre = 0, over = 0
    for (let j = 0; j < rec.data.l.length; j++) { const v = Math.max(Math.abs(rec.data.l[j]), Math.abs(rec.data.r[j])); if (v > pk) pk = v; if (v > 1) over++ }
    for (let j = 0; j < pre.data.l.length; j++) pkPre = Math.max(pkPre, Math.abs(pre.data.l[j]), Math.abs(pre.data.r[j]))
    rows.push({ label: urls[i].label, trimDb: eng.engineDebug.loudness(key)?.gainDb, musicTapPeakDb: +(20 * Math.log10(pkPre)).toFixed(2), outputPeakDb: +(20 * Math.log10(pk)).toFixed(2), samplesOver0dBFS: over })
  }
  eng.audioEngine.setVolume(0.9)
  return rows
}, urls)
for (const r of res) console.log(JSON.stringify(r))
await b.close()
