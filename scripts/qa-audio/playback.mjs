// In-app audio QA: a real solo game on the dev server (127.0.0.1:5304), with the
// app's audio graph tapped by AudioWorklet recorders (scripts/qa-audio/qa-lib.js).
// Measures: shuffled / correct-order play-all (null test vs the original buffer,
// splice discontinuities), tap-to-play, stop fade, volume/mute/SFX toggle, level
// source for the shader, intro + countdown tick alignment, reveal mix (music vs
// SFX levels), and tapping a block during the reveal.
// Usage: node scripts/qa-audio/playback.mjs   (writes playback-report.json, rec-*.wav, shots/pb-*)
import { chromium } from 'playwright'
import * as fs from 'node:fs'
import { fromDump, loudness, momentary, onsets, toLufs, writeWav } from './lufs.mjs'

const BASE = process.env.BASE ?? 'http://127.0.0.1:5304/'
const HERE = new URL('./', import.meta.url).pathname
const OUT = `${HERE}shots/`
fs.mkdirSync(OUT, { recursive: true })
const lib = fs.readFileSync(`${HERE}qa-lib.js`, 'utf8')
const T0 = Date.now()
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1).padStart(6)}s]`, ...a)
const report = {}

const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const bctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await bctx.addInitScript(() => {
  try {
    localStorage.setItem('unshuffle:onboarded', String(Date.now()))
    localStorage.removeItem('unshuffle:volume')
    localStorage.removeItem('unshuffle:sfx')
  } catch {}
})
await bctx.addInitScript({ content: lib })
const page = await bctx.newPage()
page.on('pageerror', (e) => log('pageerror', e.message))
page.on('console', (m) => { if (m.type() === 'error') log('console.error', m.text().slice(0, 200)) })

const frame = (screen) => page.locator(`[data-screen-frame][data-screen="${screen}"]:not([inert])`)
const waitPhase = (k, timeout = 90_000) =>
  page.waitForFunction((k) => document.querySelector(`[data-screen-frame]:not([inert]) [data-phase="${k}"]`) !== null, k, { timeout, polling: 100 })
const recStart = (names) => page.evaluate((names) => names.forEach((n) => window.__qa.recs[n].start()), names)
const recStop = (names) => page.evaluate((names) => Promise.all(names.map((n) => window.__qa.recs[n].stop())), names)
const waitIdle = (timeout = 45_000) => page.waitForFunction(() => !window.__eng.audioEngine.getState().playing, null, { timeout, polling: 50 })
const engState = () => page.evaluate(() => window.__eng.audioEngine.getState())
const dump = async (name) => fromDump(await page.evaluate((n) => window.__qa.recs[n].dump(), name))

/** Null test + splice analysis of the last engine schedule against the decoded buffer (in page). */
const analyzeLast = (label) =>
  page.evaluate((label) => {
    const eng = window.__eng
    const sched = eng.engineDebug.schedule()
    const c = eng.getAudioContext()
    const sr = c.sampleRate
    const st = window.__store.useGame.getState()
    const round = st.room.rounds[st.room.phase.round]
    const buf = eng.audioEngine.get(`track:${round.track.id}`)
    const rec = window.__qa.recs.pre
    const out = { label, items: [], joins: [], sr, bufSr: buf.sampleRate, recorded: [rec.first(), rec.last()] }
    const L = buf.getChannelData(0)
    const R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L
    const fade = Math.round(0.004 * sr)
    for (const it of sched) {
      const got = rec.range(it.whenFrame, it.whenFrame + it.frames)
      const skipA = it.join === 'gapless' ? 0 : fade + 2
      const skipB = it.outro === 'gapless' || it.outro === 'open' ? 0 : fade + 2
      let err = 0, sig = 0, maxErr = 0
      for (let i = skipA; i < it.frames - skipB; i++) {
        const el = got.l[i] - L[it.startSample + i]
        const er = got.r[i] - R[it.startSample + i]
        err += el * el + er * er
        sig += L[it.startSample + i] ** 2 + R[it.startSample + i] ** 2
        maxErr = Math.max(maxErr, Math.abs(el), Math.abs(er))
      }
      out.items.push({ pos: it.position, join: it.join, outro: it.outro, range: [+it.range.start.toFixed(3), +it.range.end.toFixed(3)], sec: +(it.frames / sr).toFixed(3), residualDb: sig > 0 ? +(10 * Math.log10(err / sig + 1e-30)).toFixed(1) : null, maxErr: +maxErr.toExponential(2) })
    }
    // Splices: HF (first-difference) energy in [J-1ms, J+5ms] of the recording vs the same
    // window of the source on either side; plus what a naive hard splice would give.
    const hf = (x) => { let s = 0; for (let i = 1; i < x.length; i++) s += (x[i] - x[i - 1]) ** 2; return s / Math.max(1, x.length - 1) }
    const w0 = Math.round(0.001 * sr), w1 = Math.round(0.005 * sr)
    const srcWin = (center) => Float32Array.from({ length: w0 + w1 + 1 }, (_, i) => (L[center - w0 - 1 + i] + R[center - w0 - 1 + i]) / 2)
    for (let k = 1; k < sched.length; k++) {
      const a = sched[k - 1], b = sched[k]
      const J = b.whenFrame
      const g = rec.range(J - w0 - 1, J + w1)
      const recHf = hf(g.l.map((v, i) => (v + g.r[i]) / 2))
      const ref = Math.max(hf(srcWin(a.endSample)), hf(srcWin(b.startSample)))
      const naive = Float32Array.from({ length: w0 + w1 + 1 }, (_, i) => {
        const j = i - w0 - 1
        return j < 0 ? (L[a.endSample + j] + R[a.endSample + j]) / 2 : (L[b.startSample + j] + R[b.startSample + j]) / 2
      })
      out.joins.push({ at: k, kind: b.join, excessDb: +(10 * Math.log10(recHf / (ref + 1e-20))).toFixed(1), naiveExcessDb: +(10 * Math.log10(hf(naive) / (ref + 1e-20))).toFixed(1) })
    }
    out.count = sched.length
    out.worstJoinExcessDb = out.joins.length ? Math.max(...out.joins.map((j) => j.excessDb)) : null
    out.worstNaiveExcessDb = out.joins.length ? Math.max(...out.joins.map((j) => j.naiveExcessDb)) : null
    return out
  }, label)

const sampleLevels = () =>
  page.evaluate(async () => {
    const e = window.__eng.audioEngine
    const s = []
    const r0 = window.__qa.levelReads
    const t0 = performance.now()
    for (let i = 0; i < 10; i++) { s.push(e.getLevels()); await new Promise((r) => setTimeout(r, 100)) }
    const readsPerSec = Math.round(((window.__qa.levelReads - r0 - 10) * 1000) / (performance.now() - t0))
    const mx = (k) => +Math.max(...s.map((x) => x[k])).toFixed(2)
    return { state: e.getState().tag, shaderReadsPerSec: readsPerSec, max: { bass: mx('bass'), mid: mx('mid'), treble: mx('treble'), energy: mx('energy'), beat: mx('beat') } }
  })

let exit = 0
try {
  await page.goto(BASE, { waitUntil: 'load' })
  await frame('home').waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(800)
  await page.evaluate(async () => {
    window.__eng = await import('/src/audio/engine.ts')
    window.__store = await import('/src/game/store.ts')
    window.__sfx = await import('/src/audio/sfx.ts')
    window.__clock = await import('/src/game/clock.ts')
  })
  report.beforeGesture = await page.evaluate(() => ({ ctx: window.__eng.getAudioContext()?.state ?? null, unlocked: window.__eng.audioEngine.unlocked }))
  await page.getByRole('button', { name: 'Crea stanza', exact: true }).click()
  await frame('lobby').waitFor({ state: 'visible', timeout: 30_000 })
  report.afterCrea = await page.evaluate(() => ({ ctx: window.__eng.getAudioContext()?.state ?? null, unlocked: window.__eng.audioEngine.unlocked }))
  report.graph = await page.evaluate(async () => {
    const eng = window.__eng
    const c = eng.getAudioContext()
    await window.__qa.setup(c)
    const gains = window.__qa.taps.filter((t) => t.kind === 'GainNode' && t.ctx === c)
    window.__qa.makeRec('pre', eng.engineDebug.musicTap())
    window.__qa.makeRec('music', gains[0].node)
    window.__qa.makeRec('sfx', gains[1].node)
    const orig = eng.audioEngine.getLevels
    window.__qa.levelReads = 0
    eng.audioEngine.getLevels = function () { window.__qa.levelReads++; return orig.call(this) }
    const origStop = eng.audioEngine.stop
    window.__qa.stops = []
    eng.audioEngine.stop = function (ms) { window.__qa.stops.push({ ct: c.currentTime, ms }); return origStop.call(this, ms) }
    // Timer labels (intro 3-2-1 + play countdown) with context time.
    window.__qa.timerLog = []
    let last = ''
    new MutationObserver(() => {
      const els = [...document.querySelectorAll('[data-screen-frame]:not([inert]) [role="timer"]')]
      const v = els.map((e) => e.getAttribute('aria-label')).join('|')
      if (v !== last) { last = v; window.__qa.timerLog.push({ v, ct: c.currentTime }) }
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-label'] })
    return { sampleRate: c.sampleRate, state: c.state, taps: window.__qa.taps.map((t) => t.kind), baseLatency: c.baseLatency, outputLatency: c.outputLatency }
  })
  log('graph', report.graph, 'afterCrea', report.afterCrea)

  const search = page.getByRole('searchbox', { name: 'Cerca playlist' })
  await search.click()
  await search.fill(process.env.QUERY ?? 'hits 2000')
  const firstResult = page.locator('section[aria-label="Scegli la playlist"] ul:not([aria-hidden]) li button[aria-pressed]').first()
  await firstResult.waitFor({ state: 'visible', timeout: 20_000 })
  await page.waitForTimeout(600)
  await firstResult.click()
  const setRadio = async (group, name) => page.getByRole('radiogroup', { name: group }).first().getByRole('radio', { name }).first().click()
  await setRadio('Round', '3')
  await setRadio('Spezzoni', /^8/)
  await setRadio('Tempo per round', '90s')
  await setRadio('Timer finale', '10s')
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /Inizia partita/ }).first().click()
  await waitPhase('intro', 90_000)
  await recStart(['sfx'])
  log('intro')
  await waitPhase('playing', 60_000)
  await page.locator('[data-round-view="playing"] .sb-item').first().waitFor({ timeout: 10_000 })
  await page.waitForTimeout(1200)
  await recStop(['sfx'])
  {
    const d = await dump('sfx')
    const sr = report.graph.sampleRate
    const ons = onsets(d.l, d.r, sr).map((i) => +((d.f0 + i) / sr).toFixed(3))
    const tl = await page.evaluate(() => window.__qa.timerLog.slice())
    report.intro = { sfxOnsets: ons, timerChanges: tl.filter((t) => /Si parte|Pronti|secondi/.test(t.v)).map((t) => ({ v: t.v, ct: +t.ct.toFixed(3) })), loud: loudness(d.l, d.r, sr) }
    writeWav(`${HERE}rec-intro-sfx.wav`, d.l, d.r, sr, fs)
    log('intro onsets', ons, 'timer', report.intro.timerChanges.map((t) => `${t.v}@${t.ct}`).join(' '))
  }
  await page.screenshot({ path: `${OUT}pb-01-playing.png` })

  // ---------------------------------------------------------------- 1. shuffled play-all
  await recStart(['pre', 'music'])
  await page.getByRole('button', { name: 'Ascolta tutti gli spezzoni in ordine' }).click()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${OUT}pb-02-playall-shuffled.png` })
  report.levelsPlayAll = await sampleLevels()
  log('levels during play-all', report.levelsPlayAll)
  await waitIdle()
  await page.waitForTimeout(200)
  await recStop(['pre', 'music'])
  report.levelsIdle = await sampleLevels()
  report.shuffled = await analyzeLast('shuffled')
  log('shuffled', report.shuffled.count, 'items; joins excess dB (rec / naive):', report.shuffled.joins.map((j) => `${j.excessDb}/${j.naiveExcessDb}`).join(' '))
  log('shuffled residuals', report.shuffled.items.map((i) => i.residualDb).join(' '))

  // ---------------------------------------------------------------- 2. correct-order play-all
  await page.evaluate(() => {
    const st = window.__store.useGame.getState()
    const round = st.room.rounds[st.room.phase.round]
    st.setArrangement(round.segments.map((_, i) => i))
  })
  await page.waitForTimeout(600)
  report.boardAfterIdentity = await page.$$eval('[data-round-view="playing"] .sb-item', (els) => els.map((e) => [Number(e.getAttribute('data-pos')), Number(e.getAttribute('data-seg'))]).sort((a, b) => a[0] - b[0]).map((x) => x[1]))
  await recStart(['pre', 'music'])
  await page.getByRole('button', { name: 'Ascolta tutti gli spezzoni in ordine' }).click()
  await waitIdle()
  await page.waitForTimeout(200)
  await recStop(['pre', 'music'])
  report.correct = await analyzeLast('correct')
  log('correct joins', report.correct.joins.map((j) => j.kind).join(','), 'residuals', report.correct.items.map((i) => `${i.residualDb}(${i.maxErr})`).join(' '))
  {
    const d = await dump('music')
    report.musicLevelMaster = loudness(d.l, d.r, report.graph.sampleRate)
    log('music level at master (vol 0.9 → gain 0.81)', report.musicLevelMaster)
  }

  // ---------------------------------------------------------------- 3. tap one block (and tap again = stop)
  await recStart(['pre'])
  const box = await page.locator('[data-round-view="playing"] .sb-item[data-pos="2"]').boundingBox()
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(300)
  report.tapState = await engState()
  await page.screenshot({ path: `${OUT}pb-03-tap-block.png` })
  await waitIdle()
  await page.waitForTimeout(200)
  await recStop(['pre'])
  report.tap = await analyzeLast('tap')
  log('tap', report.tapState, report.tap.items)
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(500)
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(200)
  report.tapTwice = await engState()

  // ---------------------------------------------------------------- 4. stop during play-all (fade)
  await recStart(['pre'])
  await page.getByRole('button', { name: 'Ascolta tutti gli spezzoni in ordine' }).click()
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: 'Ferma la riproduzione' }).click()
  await page.waitForTimeout(400)
  await recStop(['pre'])
  report.stopFade = await page.evaluate(() => {
    const rec = window.__qa.recs.pre
    const sr = window.__qa.ctx.sampleRate
    const s = window.__qa.stops[window.__qa.stops.length - 1]
    const f = Math.round(s.ct * sr)
    const { l, r } = rec.range(f - Math.round(0.02 * sr), f + Math.round(0.2 * sr))
    const blk = Math.round(0.005 * sr)
    const env = []
    for (let i = 0; i + blk <= l.length; i += blk) { let e = 0; for (let j = i; j < i + blk; j++) e += l[j] * l[j] + r[j] * r[j]; env.push(Math.round(10 * Math.log10(e / blk + 1e-20))) }
    let silentAt = null
    for (let i = 0; i < l.length; i++) if (Math.abs(l[i]) > 1e-4 || Math.abs(r[i]) > 1e-4) silentAt = i
    return { requestedFadeMs: s.ms ?? 60, lastAudibleMsAfterStop: silentAt === null ? null : +(((silentAt - 0.02 * sr) * 1000) / sr).toFixed(1), env5ms: env.slice(0, 20) }
  })
  log('stop fade', report.stopFade)

  // ---------------------------------------------------------------- 5. volume / mute / sfx toggle (UI)
  {
    const btns = page.locator('button[aria-haspopup="dialog"][aria-label^="Audio"]')
    const cnt = await btns.count()
    for (let i = 0; i < cnt; i++) if (await btns.nth(i).isVisible()) { await btns.nth(i).click(); break }
  }
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}pb-04-sound-panel.png` })
  const slider = page.getByRole('slider', { name: 'Volume' })
  await slider.focus()
  for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowLeft')
  report.volumeAfterSlider = await page.evaluate(() => ({ volume: window.__eng.audioEngine.volume, stored: localStorage.getItem('unshuffle:volume') }))
  await page.waitForTimeout(200)
  await recStart(['pre', 'music'])
  await page.evaluate(() => {
    const st = window.__store.useGame.getState()
    const round = st.room.rounds[st.room.phase.round]
    window.__eng.audioEngine.playSegment(`track:${round.track.id}`, round.segments[3], { tag: 'qa' })
  })
  await waitIdle()
  await recStop(['pre', 'music'])
  report.volumeGain = await page.evaluate(() => {
    const a = window.__qa.recs.pre, b = window.__qa.recs.music
    const f0 = Math.max(a.first(), b.first()), f1 = Math.min(a.last(), b.last())
    const x = a.range(f0, f1), y = b.range(f0, f1)
    let sx = 0, sy = 0
    for (let i = 0; i < x.l.length; i++) { sx += x.l[i] ** 2; sy += y.l[i] ** 2 }
    return { masterVsPreDb: +(10 * Math.log10(sy / sx)).toFixed(2), expectedDb: +(20 * Math.log10(window.__eng.audioEngine.volume ** 2)).toFixed(2) }
  })
  await page.getByRole('button', { name: 'Disattiva audio' }).click()
  report.afterMute = await page.evaluate(() => window.__eng.audioEngine.volume)
  await page.getByRole('button', { name: 'Riattiva audio' }).click()
  report.afterUnmute = await page.evaluate(() => window.__eng.audioEngine.volume)
  await page.getByRole('switch', { name: 'Effetti sonori' }).click()
  report.sfxEnabledAfterToggle = await page.evaluate(() => window.__sfx.sfx.enabled)
  await recStart(['sfx'])
  await page.evaluate(() => { window.__sfx.sfx.play('click'); window.__sfx.sfx.play('go') })
  await page.waitForTimeout(600)
  await recStop(['sfx'])
  report.sfxPeakWhenDisabled = await page.evaluate(() => { const r = window.__qa.recs.sfx; const { l } = r.range(r.first(), r.last()); let m = 0; for (const v of l) m = Math.max(m, Math.abs(v)); return m })
  await page.getByRole('switch', { name: 'Effetti sonori' }).click()
  await slider.focus()
  for (let i = 0; i < 100; i++) await page.keyboard.press('ArrowRight')
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowLeft')
  report.volumeRestored = await page.evaluate(() => window.__eng.audioEngine.volume)
  await page.keyboard.press('Escape')
  log('volume', report.volumeAfterSlider, report.volumeGain, 'mute', report.afterMute, 'unmute', report.afterUnmute, 'sfx off peak', report.sfxPeakWhenDisabled, 'restored', report.volumeRestored)

  // ---------------------------------------------------------------- 6. countdown ticks over music → reveal
  const secsLeft = () => page.evaluate(() => { const ph = window.__store.useGame.getState().room.phase; return ph.kind === 'playing' ? (ph.endsAt - window.__clock.hostNow()) / 1000 : -1 })
  const left = await secsLeft()
  log('seconds left', left.toFixed(1))
  if (left > 14) await page.waitForTimeout((left - 13.2) * 1000)
  await page.evaluate(() => {
    const st = window.__store.useGame.getState()
    const round = st.room.rounds[st.room.phase.round]
    st.setArrangement(round.initialOrder.slice())
  })
  await page.waitForTimeout(300)
  await recStart(['sfx', 'music'])
  await page.getByRole('button', { name: 'Ascolta tutti gli spezzoni in ordine' }).click()
  await waitPhase('reveal', 40_000)
  const revealAtCt = await page.evaluate(() => window.__qa.ctx.currentTime)
  log('reveal')
  await page.waitForTimeout(1500)
  report.revealEarly = { state: await engState(), levels: await sampleLevels(), schedule: await page.evaluate(() => window.__eng.engineDebug.schedule().map((i) => ({ range: i.range, join: i.join, when: i.when }))) }
  log('reveal early', report.revealEarly.state, report.revealEarly.levels)
  await page.screenshot({ path: `${OUT}pb-05-reveal.png` })
  await page.waitForSelector('.rv-root[data-stage="done"]', { timeout: 25_000 }).catch(() => log('reveal: stage done not reached'))
  await page.waitForTimeout(800)
  await recStop(['sfx', 'music'])
  report.revealAtCt = revealAtCt
  report.timerLog = await page.evaluate(() => window.__qa.timerLog.map((t) => ({ v: t.v, ct: +t.ct.toFixed(3) })))

  // ---------------------------------------------------------------- 7. tap a block during the reveal
  const before = await engState()
  const rb = page.locator('[data-screen-frame]:not([inert]) .rv-board .sb-item').first()
  const hasBoard = (await rb.count()) > 0
  if (hasBoard) await rb.click()
  await page.waitForTimeout(400)
  const during = await engState()
  await page.screenshot({ path: `${OUT}pb-06-reveal-tap-block.png` })
  await waitIdle(15_000).catch(() => {})
  await page.waitForTimeout(1200)
  const after = await engState()
  const songBtn = await page.locator('[data-screen-frame]:not([inert]) button[aria-label="Ferma la canzone"], [data-screen-frame]:not([inert]) button[aria-label="Riascolta la canzone"]').first().getAttribute('aria-label').catch(() => null)
  report.revealTap = { hasBoard, before, during, after, songButton: songBtn }
  log('reveal tap', report.revealTap)
  await page.screenshot({ path: `${OUT}pb-07-reveal-after-tap.png` })

  // ---------------------------------------------------------------- analysis of the tick + reveal recording (node)
  {
    const s = await dump('sfx')
    const m = await dump('music')
    const sr = report.graph.sampleRate
    const n = Math.min(s.l.length, m.l.length)
    writeWav(`${HERE}rec-ticks-reveal-sfx.wav`, s.l.subarray(0, n), s.r.subarray(0, n), sr, fs)
    writeWav(`${HERE}rec-ticks-reveal-music.wav`, m.l.subarray(0, n), m.r.subarray(0, n), sr, fs)
    const mixL = new Float32Array(n), mixR = new Float32Array(n)
    for (let i = 0; i < n; i++) { mixL[i] = s.l[i] + m.l[i]; mixR[i] = s.r[i] + m.r[i] }
    writeWav(`${HERE}rec-ticks-reveal-mix.wav`, mixL, mixR, sr, fs)
    const ons = onsets(s.l, s.r, sr, { minDb: -55, jumpDb: 10, refractoryS: 0.06 })
    const mm = momentary(m.l, m.r, sr, 0.05)
    const sm = momentary(s.l, s.r, sr, 0.05)
    const at = (series, t) => series.reduce((b, x) => (Math.abs(x.t - t) < Math.abs(b.t - t) ? x : b), series[0])
    report.sfxEvents = ons.map((i) => {
      const t = i / sr
      let pk = 0
      for (let j = i; j < Math.min(n, i + Math.round(0.15 * sr)); j++) pk = Math.max(pk, Math.abs(s.l[j]), Math.abs(s.r[j]))
      let mpk = 0
      for (let j = Math.max(0, i - Math.round(0.2 * sr)); j < Math.min(n, i + Math.round(0.2 * sr)); j++) mpk = Math.max(mpk, Math.abs(m.l[j]))
      const sfxMom = toLufs(at(sm, t - 0.1).p)
      const musMom = toLufs(at(mm, t - 0.1).p)
      return { ct: +((s.f0 + i) / sr).toFixed(3), sinceRevealS: +((s.f0 + i) / sr - revealAtCt).toFixed(2), sfxPeakDb: +(20 * Math.log10(pk + 1e-9)).toFixed(1), sfxMomLUFS: +sfxMom.toFixed(1), musicMomLUFS: +musMom.toFixed(1), sfxMinusMusicLU: +(sfxMom - musMom).toFixed(1), musicPeakDb: +(20 * Math.log10(mpk + 1e-9)).toFixed(1) }
    })
    report.revealMusicLoud = loudness(m.l.subarray(Math.max(0, Math.round((revealAtCt + 1) * sr) - m.f0)), m.r.subarray(Math.max(0, Math.round((revealAtCt + 1) * sr) - m.f0)), sr)
    report.revealSfxLoud = loudness(s.l.subarray(Math.max(0, Math.round(revealAtCt * sr) - s.f0)), s.r.subarray(Math.max(0, Math.round(revealAtCt * sr) - s.f0)), sr)
    log('sfx events', report.sfxEvents.length)
  }
} catch (e) {
  exit = 1
  log('FATAL', e?.stack ?? e)
  await page.screenshot({ path: `${OUT}pb-failure.png` }).catch(() => {})
} finally {
  fs.writeFileSync(`${HERE}playback-report.json`, JSON.stringify(report, null, 1))
  await browser.close()
}
process.exit(exit)
