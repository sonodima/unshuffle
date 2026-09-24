// Resumed audit: solo desktop game with instrumentation.
// - timer value vs roundTime at the first playing frame
// - cut plan vs detected tempo (are cuts on bars?)
// - waveform peak statistics per block (are blocks visually distinct?)
// - tap-to-play / play-all engine state + levels (shader input)
// - reveal: is the original preview actually playing? SongCard progress text
import { BASE, DESKTOP, launch, openPlayer, shot, waitScreen, waitPhase, boardOrder, mouseDrag, log, problems } from './lib.mjs'
const RUN = 'x'
const browser = await launch()
const p = await openPlayer(browser, 'solo', DESKTOP, { onboarded: true })
const eng = (fn) => p.evaluate(async (src) => { const m = await import('/src/audio/engine.ts'); const e = m.audioEngine; return (0, eval)(src)(e, m) }, fn.toString())
const store = () => p.evaluate(async () => { const m = await import('/src/game/store.ts'); const s = m.useGame.getState(); return JSON.parse(JSON.stringify({ phase: s.room?.phase, settings: s.room?.settings, rounds: s.room?.rounds })) })
try {
  await p.goto(BASE); await waitScreen(p, 'home')
  await p.getByRole('button', { name: 'Crea stanza', exact: true }).click()
  await waitScreen(p, 'lobby')
  const firstResult = p.locator('section[aria-label="Scegli la playlist"] ul:not([aria-hidden]) li button[aria-pressed]').first()
  await firstResult.waitFor({ state: 'visible', timeout: 20000 })
  await firstResult.click()
  log('picked', await firstResult.getAttribute('title'))
  const setRadio = async (group, name) => p.getByRole('radiogroup', { name: group }).first().getByRole('radio', { name }).first().click()
  await setRadio('Round', '3'); await setRadio('Spezzoni', /^8/); await setRadio('Tempo per round', '60s')
  await p.getByRole('button', { name: /Inizia partita/ }).first().click()
  const t0 = Date.now()
  await waitPhase(p, 'intro', 90000)
  log('start→intro ms', Date.now() - t0)
  const t1 = Date.now()
  await waitPhase(p, 'playing', 30000)
  log('intro→playing ms', Date.now() - t1)
  const timerAtGo = await p.evaluate(() => document.querySelector('[data-screen-frame]:not([inert]) [role="timer"]')?.textContent)
  const st = await store()
  const ph = st.phase
  log('timer text at first playing frame:', timerAtGo, '| endsAt-startedAt s:', ((ph.endsAt - ph.startedAt) / 1000).toFixed(2), '| endsAt-now s:', ((ph.endsAt - Date.now()) / 1000).toFixed(2))
  const rd = st.rounds[0]
  const beat = rd.bpm ? 60 / rd.bpm : 0
  const segs = rd.segments.map((s) => ({ i: s.index, start: +s.start.toFixed(3), len: +(s.end - s.start).toFixed(3), beats: s.beats, inBeats: beat ? +((s.end - s.start) / beat).toFixed(2) : null }))
  log('track', rd.track.title, '—', rd.track.artist, 'rank', rd.track.rank, 'bpm', rd.bpm)
  log('segments', JSON.stringify(segs))
  // waveform stats per block (same computePeaks the board uses)
  const wf = await p.evaluate(async ({ key, segs }) => {
    const { audioEngine } = await import('/src/audio/engine.ts'); const { computePeaks } = await import('/src/audio/peaks.ts')
    const buf = audioEngine.get(key)
    if (!buf) return 'no buffer'
    return segs.map((s) => {
      const pk = computePeaks(buf, s.start, s.start + s.len, 40)
      const v = [...pk.max].map((x) => Math.pow(x, 0.8))
      const mean = v.reduce((a, b) => a + b, 0) / v.length
      const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length)
      const min = Math.min(...v)
      return { i: s.i, mean: +mean.toFixed(2), sd: +sd.toFixed(2), min: +min.toFixed(2) }
    })
  }, { key: `track:${rd.track.id}`, segs })
  log('waveform (pow .8 of peak) per block', JSON.stringify(wf))
  await shot(p, `${RUN}-01-playing`)
  // tap-to-play
  const b0 = p.locator('[data-screen-frame]:not([inert]) [data-round-view="playing"] .sb-item[data-pos="0"]')
  await b0.click()
  await p.waitForTimeout(300)
  const s1 = await eng((e, m) => ({ st: e.getState(), pos: e.getPosition(), ctx: m.getAudioContext()?.state ?? null }))
  await p.waitForTimeout(700)
  const s2 = await eng((e) => ({ st: e.getState(), pos: e.getPosition() }))
  log('tap block0 state', JSON.stringify(s1), '→ after 0.7s', JSON.stringify(s2.pos))
  await shot(p, `${RUN}-02-tap-play`)
  // play all
  await p.getByRole('button', { name: 'Ascolta tutti gli spezzoni in ordine' }).click()
  const lv = []
  for (let i = 0; i < 10; i++) { lv.push(await eng((e) => { const l = e.getLevels(); return [l.bass, l.energy, l.beat].map((x) => +x.toFixed(2)).join('/') })); await p.waitForTimeout(150) }
  log('levels during play-all', lv.join(' '))
  const pa = await eng((e) => ({ st: e.getState(), pos: e.getPosition() }))
  log('play-all state', JSON.stringify(pa))
  await shot(p, `${RUN}-03-playall`)
  const transport = await p.evaluate(() => document.querySelector('[data-screen-frame]:not([inert]) [data-round-view="playing"]')?.innerText.replace(/\n+/g, ' | ').slice(-200))
  log('transport text', transport)
  // put 3 blocks in place, confirm
  for (let target = 0; target < 3; target++) { const ord = await boardOrder(p); const from = ord.indexOf(target); if (from !== target) await mouseDrag(p, from, target) }
  log('order before confirm', (await boardOrder(p)).join(','))
  await p.getByRole('button', { name: /^Conferma/ }).first().click()
  await waitPhase(p, 'reveal', 20000)
  for (const ms of [1000, 3000, 6000]) {
    await p.waitForTimeout(ms === 1000 ? 1000 : ms === 3000 ? 2000 : 3000)
    const r = await eng((e, m) => ({ st: e.getState(), pos: e.getPosition(), ctx: m.getAudioContext()?.state, t: m.engineDebug.audibleTime() }))
    const card = await p.evaluate(() => { const t = document.querySelector('[data-screen-frame]:not([inert])')?.innerText ?? ''; const m = t.match(/\d:\d\d\s*\/\s*\d:\d\d/); return m?.[0] })
    log(`reveal +${ms}ms engine`, JSON.stringify(r), 'songcard', card)
  }
  await shot(p, `${RUN}-04-reveal-6s`)
  const rtxt = await p.evaluate(() => document.querySelector('[data-screen-frame]:not([inert])')?.innerText.replace(/\n+/g, ' | '))
  log('reveal text', rtxt.slice(0, 900))
  // re-listen a snippet in reveal
  const rb = p.locator('[data-screen-frame]:not([inert]) .rv-root .sb-item, [data-screen-frame]:not([inert]) .rv-root [data-snippet-block]').first()
  if (await rb.count()) { await rb.click().catch((e) => log('reveal block click fail', e.message)); await p.waitForTimeout(600); log('reveal snippet click →', JSON.stringify(await eng((e) => e.getState()))) } else log('no reveal block found')
  await shot(p, `${RUN}-05-reveal-snippet`)
} catch (e) {
  problems.push('FATAL ' + e.stack)
  await shot(p, `${RUN}-99`).catch(() => {})
} finally {
  await browser.close()
  console.log('problems:\n' + (problems.join('\n') || '(none)'))
}
