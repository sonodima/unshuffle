// Main-thread stall during gapless play-all: how does the lookahead scheduler recover?
// Also: output peak at volume 1.0 (clipping headroom).
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const lib = readFileSync(new URL('./qa-lib.js', import.meta.url), 'utf8')
const tracks = JSON.parse(readFileSync(new URL('./tracks.json', import.meta.url), 'utf8'))
const pick = tracks.find((t) => t.label.includes('Sweet Child'))
const url = (await (await fetch(`https://api.deezer.com/track/${pick.id}`)).json()).preview
const b = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required', ...(process.env.FAKE_AUDIO ? ['--disable-audio-output'] : [])] })
const ctx = await b.newContext()
await ctx.addInitScript({ content: lib })
const p = await ctx.newPage()
await p.goto('http://127.0.0.1:5304/scripts/qa-audio/preroll.html')
const res = await p.evaluate(async ({ url, stallsMs }) => {
  const eng = await import('/src/audio/engine.ts')
  const { analyzeAndCut } = await import('/src/audio/analysis/index.ts')
  await eng.audioEngine.unlock()
  const buf = await eng.audioEngine.load('qa', url)
  const plan = await analyzeAndCut(buf, 8)
  const c = eng.getAudioContext()
  await window.__qa.setup(c)
  const gains = window.__qa.taps.filter((t) => t.kind === 'GainNode' && t.ctx === c)
  const pre = window.__qa.makeRec('pre', eng.engineDebug.musicTap())
  const out = window.__qa.makeRec('out', gains[0].node)
  const results = []
  for (const stall of stallsMs) {
    eng.audioEngine.setVolume(1)
    pre.start(); out.start()
    eng.audioEngine.playSequence('qa', (pos) => plan.segments[pos] ?? null, { tag: 'board' })
    // stall right before the 2nd boundary
    const b1 = plan.segments[1].end - plan.segments[0].start
    await new Promise((r) => setTimeout(r, b1 * 1000 - 350))
    const t0 = performance.now()
    while (performance.now() - t0 < stall) {}
    await new Promise((r) => setTimeout(r, 1500))
    eng.audioEngine.stop(10)
    await new Promise((r) => setTimeout(r, 200))
    await pre.stop(); await out.stop()
    const sched = eng.engineDebug.schedule()
    const sr = c.sampleRate
    // gap detection: longest run of exact-zero samples inside the recording after the first item started
    const d = pre.data
    const startIdx = sched[0].whenFrame - d.f0
    let run = 0, best = 0, bestAt = 0
    for (let i = startIdx + 10; i < d.l.length; i++) { if (d.l[i] === 0 && d.r[i] === 0) { run++; if (run > best) { best = run; bestAt = i - run } } else run = 0 }
    let pk = 0
    for (let i = 0; i < out.data.l.length; i++) pk = Math.max(pk, Math.abs(out.data.l[i]), Math.abs(out.data.r[i]))
    const gaps = sched.slice(1).map((s, i) => +(((s.whenFrame - (sched[i].whenFrame + sched[i].frames)) * 1000) / sr).toFixed(1))
    results.push({ gapsMs: gaps, dbg: { n: sched.length, preLen: pre.data?.l.length, outLen: out.data?.l.length, b1, st: c.state }, stallMs: stall, joins: sched.map((s) => s.join + '/' + s.outro).join(' '), longestSilenceMs: +((best * 1000) / sr).toFixed(1), silenceAtS: +((bestAt + d.f0) / sr - sched[0].when).toFixed(3), outPeakDbfsAtVol1: +(20 * Math.log10(pk)).toFixed(2) })
  }
  return results
}, { url, stallsMs: [150, 300, 450, 800] })
console.log(JSON.stringify(res, null, 1))
await b.close()
