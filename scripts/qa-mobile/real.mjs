// A REAL 3-player game over the public PeerJS cloud (dev server app, not the lab):
//   host    : Chrome desktop 1280x720
//   ios     : WebKit, devices['iPhone 14'] (390x664 in-browser viewport)
//   android : Chrome mobile emulation 360x740 @3x touch (CDP touch drags) — also cycled
//             through every viewport in each phase for real-state screenshots.
// Usage: node scripts/qa-mobile/real.mjs   (dev server on :5302)
import { writeFileSync } from 'node:fs'
import { BASE, OUT, VIEWPORTS, newContext, metricsFn, sleep, closeBrowsers } from './lib.mjs'

const SNIPPETS = Number(process.env.SNIPPETS ?? 16)
const T0 = Date.now()
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1).padStart(6)}s]`, ...a)
const report = { checks: [], metrics: [], errors: {} }
const check = (ok, msg, extra) => {
  report.checks.push({ ok: !!ok, msg, extra })
  log(ok ? 'OK ' : 'BAD', msg, extra ? JSON.stringify(extra) : '')
}

const host = await newContext('chromium', VIEWPORTS.find((v) => v.id === '1280x720'))
// Playwright WebKit cannot open RTCDataChannels (see webrtc-probe.mjs) -> IOS_ENGINE=chromium uses a 390x844 Chrome phone.
const ios = process.env.IOS_ENGINE === 'chromium' ? await newContext('chromium', VIEWPORTS.find((v) => v.id === '390x844')) : await newContext('webkit', 'iphone14')
const android = await newContext('chromium', VIEWPORTS.find((v) => v.id === '360x740'))
const P = { host: host.page, ios: ios.page, android: android.page }
const workers = { host: [], ios: [], android: [] }
for (const p of Object.values(P)) p.setDefaultTimeout(120_000)
for (const [k, p] of Object.entries(P)) p.on('worker', (w) => workers[k].push(w.url()))

const frame = (p, s) => p.locator(`[data-screen-frame][data-screen="${s}"]:not([inert])`)
const waitScreen = (p, s, t = 30_000) => frame(p, s).waitFor({ state: 'visible', timeout: t })
const waitPhase = (p, k, t = 90_000) =>
  p.waitForFunction((k) => document.querySelector(`[data-screen-frame]:not([inert]) [data-phase="${k}"]`) !== null, k, { timeout: t, polling: 100 })
async function shotAll(step) {
  for (const [k, p] of Object.entries(P)) await p.screenshot({ path: `${OUT}real-${step}-${k}.png` }).catch(() => {})
  log('shot', step)
}
async function m(page, who, step) {
  const r = await page.evaluate(metricsFn).catch((e) => ({ err: e.message }))
  report.metrics.push({ who, step, ...r })
  return r
}
/** Android guest: cycle all viewports, screenshot + metrics, back to 360x740. */
async function cycle(step, { bottom = false } = {}) {
  const p = P.android
  for (const vp of VIEWPORTS) {
    await p.setViewportSize({ width: vp.width, height: vp.height })
    await sleep(450)
    const r = await m(p, `android@${vp.id}`, step)
    await p.screenshot({ path: `${OUT}real-${step}-android@${vp.id}.png` })
    if (bottom) {
      const did = await scrollBottom(p)
      if (did) {
        await sleep(400)
        await m(p, `android@${vp.id}`, `${step}-bottom`)
        await p.screenshot({ path: `${OUT}real-${step}-android@${vp.id}-bottom.png` })
        await scrollTop(p)
      }
    }
    const flags = [r.docOverflowX > 0 && `docX${r.docOverflowX}`, r.offscreen?.length && `off${r.offscreen.length}`, r.soundOverlap?.length && `snd${r.soundOverlap.length}`].filter(Boolean)
    if (flags.length) log('  flags', vp.id, flags.join(' '))
  }
  await p.setViewportSize({ width: 360, height: 740 })
  await sleep(300)
}
const scrollEls = (p, f) =>
  p.evaluate((f) => {
    const fr = document.querySelector('[data-screen-frame]:not([inert])')
    if (!fr) return false
    const els = [fr, ...fr.querySelectorAll('*')].filter((e) => {
      const cs = getComputedStyle(e)
      return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 4 && e.clientHeight > innerHeight * 0.4
    })
    els.forEach((e) => e.scrollTo({ top: f * (e.scrollHeight - e.clientHeight), behavior: 'instant' }))
    return els.length > 0
  }, f)
const scrollBottom = (p) => scrollEls(p, 1)
const scrollTop = (p) => scrollEls(p, 0)

const audioCtxState = (p) =>
  p.evaluate(async () => {
    const e = await import('/src/audio/engine.ts')
    return { state: e.getAudioContext()?.state ?? 'none', unlocked: e.audioEngine.unlocked }
  })
const storeAudio = (p) =>
  p.evaluate(async () => {
    const { useGame } = await import('/src/game/store.ts')
    return useGame.getState().audio
  })
const shaderMode = (p) => p.evaluate(() => document.querySelector('.ushf-bg')?.getAttribute('data-mode') ?? 'none')

const order = (p) =>
  p.$$eval('[data-screen-frame]:not([inert]) [data-round-view="playing"] .sb-item', (els) =>
    els.map((e) => ({ pos: +e.dataset.pos, seg: +e.dataset.seg })).sort((a, b) => a.pos - b.pos).map((e) => e.seg),
  )
const center = async (p, pos) => {
  const b = await p.locator(`[data-screen-frame]:not([inert]) [data-round-view="playing"] .sb-item[data-pos="${pos}"]`).boundingBox()
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}
const arrayMove = (a, f, t) => {
  const c = a.slice()
  const [x] = c.splice(f, 1)
  c.splice(t, 0, x)
  return c
}
async function cdpDrag(p, from, to, steps = 24) {
  const cdp = await p.context().newCDPSession(p)
  const a = await center(p, from)
  const b = await center(p, to)
  const pt = (x, y) => [{ x, y, id: 1, radiusX: 6, radiusY: 6, force: 1 }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(a.x, a.y) })
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps) })
    await sleep(16)
  }
  await sleep(120)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await sleep(450)
  await cdp.detach()
}
async function synthDrag(p, from, to, steps = 24) {
  const a = await center(p, from)
  const b = await center(p, to)
  const ev = (type, x, y) =>
    p.evaluate(
      ([type, x, y]) => {
        const init = { bubbles: true, cancelable: true, composed: true, pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1 }
        ;(document.elementFromPoint(x, y) ?? document).dispatchEvent(new PointerEvent(type, init))
      },
      [type, x, y],
    )
  await ev('pointerdown', a.x, a.y)
  for (let i = 1; i <= steps; i++) {
    await ev('pointermove', a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps)
    await sleep(16)
  }
  await sleep(120)
  await ev('pointerup', b.x, b.y)
  await sleep(450)
}

let fatal = null
try {
  await Promise.all(Object.values(P).map((p) => p.goto(BASE + '/', { waitUntil: 'load' })))
  await Promise.all(Object.values(P).map((p) => waitScreen(p, 'home')))
  await sleep(1500)
  check((await shaderMode(P.ios)) === 'webgl', 'iOS WebKit: shader background runs in WebGL mode', { mode: await shaderMode(P.ios) })
  check((await audioCtxState(P.ios)).state !== 'running', 'iOS WebKit: audio locked before any gesture', await audioCtxState(P.ios))
  await shotAll('01-home')

  await P.host.getByRole('button', { name: 'Crea stanza', exact: true }).click()
  await waitScreen(P.host, 'lobby')
  const code = await P.host.evaluate(() => /#\/r\/([A-Z]{5})/.exec(location.hash)?.[1] ?? null)
  log('room', code)

  // iOS joins by typing (tap = first gesture → audio unlock)
  await P.ios.getByRole('textbox', { name: 'Codice stanza: lettera 1 di 5' }).tap()
  await sleep(300)
  check(true, 'iOS: code input focused', await P.ios.evaluate(() => ({ active: document.activeElement?.getAttribute('aria-label'), inputmode: document.activeElement?.getAttribute('inputmode'), autocap: document.activeElement?.getAttribute('autocapitalize'), type: document.activeElement?.getAttribute('type') })))
  await P.ios.keyboard.type(code.toLowerCase(), { delay: 50 })
  await sleep(300)
  await P.ios.screenshot({ path: `${OUT}real-02-ios-code-typed.png` })
  await P.ios.getByRole('button', { name: /^Entra/ }).tap()
  // android joins through the invite link (#/r/CODE)
  await P.android.goto(`${BASE}/#/r/${code}`)
  await waitScreen(P.android, 'home')
  await sleep(900)
  const prefill = await P.android.evaluate(() => [...document.querySelectorAll('input[aria-label^="Codice stanza"]')].map((i) => i.value).join(''))
  check(prefill === code, 'android: invite link pre-fills the code', { prefill, focused: await P.android.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 20) ?? document.activeElement?.tagName) })
  await P.android.screenshot({ path: `${OUT}real-02-android-invite-home.png` })
  await P.android.getByRole('button', { name: /^Entra/ }).tap()
  await Promise.all([waitScreen(P.ios, 'lobby'), waitScreen(P.android, 'lobby')])
  await sleep(1200)
  check((await audioCtxState(P.ios)).state === 'running', 'iOS WebKit: AudioContext running after the first taps', await audioCtxState(P.ios))
  check((await audioCtxState(P.android)).state === 'running', 'android: AudioContext running after taps', await audioCtxState(P.android))
  await shotAll('03-lobby')
  await cycle('03-lobby', { bottom: true })

  // host config
  const search = P.host.getByRole('searchbox', { name: 'Cerca playlist' })
  await search.fill(process.env.QUERY ?? 'hits 2000')
  const first = P.host.locator('section[aria-label="Scegli la playlist"] ul:not([aria-hidden]) li button[aria-pressed]').first()
  await first.waitFor({ timeout: 20_000 })
  await sleep(500)
  await first.click()
  const radio = async (g, name) => P.host.getByRole('radiogroup', { name: g }).first().getByRole('radio', { name }).first().click()
  await radio('Round', '3')
  await radio('Spezzoni', new RegExp(`^${SNIPPETS}`))
  await radio('Tempo per round', '60s')
  await radio('Timer finale', '10s')
  await sleep(1000)
  await shotAll('04-lobby-configured')
  // guest: playlist + rules tabs (read-only)
  for (const t of ['Playlist', 'Regole']) {
    await P.android.getByRole('tab', { name: new RegExp(`^${t}`) }).tap()
    await sleep(500)
    await P.android.screenshot({ path: `${OUT}real-04-android-tab-${t}.png` })
    await P.ios.getByRole('tab', { name: new RegExp(`^${t}`) }).tap()
    await sleep(500)
    await P.ios.screenshot({ path: `${OUT}real-04-ios-tab-${t}.png` })
  }
  await P.host.getByRole('button', { name: /Inizia partita/ }).first().click()
  await Promise.all(Object.values(P).map((p) => waitScreen(p, 'round')))
  await sleep(800)
  await shotAll('05-preparing')

  for (let r = 0; r < 3; r++) {
    const R = `r${r + 1}`
    await Promise.all(Object.values(P).map((p) => waitPhase(p, 'intro', 90_000))).catch(() => log('intro missed'))
    await sleep(800)
    await shotAll(`${R}-06-intro`)
    await Promise.all(Object.values(P).map((p) => waitPhase(p, 'playing', 60_000)))
    await Promise.all(Object.values(P).map((p) => p.locator('[data-round-view="playing"] .sb-item').first().waitFor({ timeout: 15_000 })))
    await sleep(1800)
    const audios = { ios: await storeAudio(P.ios), android: await storeAudio(P.android) }
    const wf = await P.ios.evaluate(() => {
      const items = [...document.querySelectorAll('[data-round-view="playing"] .sb-item')]
      return items.filter((it) => {
        const c = it.querySelector('canvas')
        if (!c?.width) return false
        const d = c.getContext('2d')?.getImageData(0, 0, c.width, c.height).data
        let lit = 0
        for (let i = 3; i < (d?.length ?? 0); i += 16) if (d[i] > 40) lit++
        return lit > 50
      }).length + '/' + items.length
    })
    check(Object.values(audios.ios).includes('ready'), `${R}: iOS decoded the round MP3 (decodeAudioData)`, { audio: audios.ios, waveforms: wf })
    await shotAll(`${R}-07-playing`)
    if (r === 0) await cycle(`${R}-07-playing`)

    // drags
    const before = await order(P.android)
    await cdpDrag(P.android, 0, 5)
    const after = await order(P.android)
    check(JSON.stringify(after) === JSON.stringify(arrayMove(before, 0, 5)), `${R}: android touch drag 0→5`)
    const ib = await order(P.ios)
    await synthDrag(P.ios, 1, ib.length - 1)
    const ia = await order(P.ios)
    check(JSON.stringify(ia) === JSON.stringify(arrayMove(ib, 1, ib.length - 1)), `${R}: iOS pointer drag 1→last`, { ib: ib.join(','), ia: ia.join(',') })
    // iOS tap-to-play
    const c = await center(P.ios, 2)
    await P.ios.touchscreen.tap(c.x, c.y)
    await sleep(500)
    const iosPlay = await P.ios.evaluate(async () => {
      const e = await import('/src/audio/engine.ts')
      const s = e.audioEngine.getState()
      return { playing: s.playing, tag: s.tag, ctx: e.getAudioContext()?.state }
    })
    check(iosPlay.playing, `${R}: iOS tap plays a snippet`, iosPlay)
    await P.ios.screenshot({ path: `${OUT}real-${R}-08-ios-tap-playing.png` })

    // iOS confirms first
    await P.ios.getByRole('button', { name: /^Conferma/ }).first().tap()
    await sleep(700)
    await shotAll(`${R}-09-ios-confirmed`)
    if (r === 0) await cycle(`${R}-09-final-timer`)
    if (r === 1) {
      await P.android.getByRole('button', { name: /^Conferma/ }).first().tap()
      await sleep(600)
      await shotAll(`${R}-09b-android-waiting`)
      await P.host.getByRole('button', { name: /^Conferma/ }).first().click()
    }
    if (r === 2) {
      await P.android.getByRole('button', { name: /^Conferma/ }).first().tap()
      await P.host.getByRole('button', { name: /^Conferma/ }).first().click()
    }
    await Promise.all(Object.values(P).map((p) => waitPhase(p, 'reveal', 40_000)))
    await sleep(1500)
    await shotAll(`${R}-10-reveal-mid`)
    await Promise.all(Object.values(P).map((p) => p.waitForSelector('.rv-root[data-stage="done"]', { timeout: 20_000 }).catch(() => {})))
    await sleep(500)
    await shotAll(`${R}-11-reveal-done`)
    const songIos = await P.ios.evaluate(async () => {
      const e = await import('/src/audio/engine.ts')
      const s = e.audioEngine.getState()
      return { playing: s.playing, tag: s.tag, mode: s.mode }
    })
    check(songIos.playing, `${R}: iOS plays the original song on reveal`, songIos)
    for (const k of ['ios', 'android']) {
      await scrollEls(P[k], 0.35)
      await sleep(400)
      await m(P[k], k, `${R}-reveal-scrolled35`)
      await P[k].screenshot({ path: `${OUT}real-${R}-12-reveal-scrolled-${k}.png` })
      await scrollBottom(P[k])
      await sleep(400)
      await m(P[k], k, `${R}-reveal-bottom`)
      await P[k].screenshot({ path: `${OUT}real-${R}-13-reveal-bottom-${k}.png` })
      await scrollTop(P[k])
    }
    if (r === 0) await cycle(`${R}-11-reveal`, { bottom: true })
    // The viewport cycle can outlast the 25 s reveal auto-advance: then the round already moved
    // on, and a blind click would land on the NEXT reveal and desync the loop from the rounds.
    const next = P.host.getByRole('button', { name: /Prossimo round|Classifica finale/ }).first()
    const label = await next.textContent({ timeout: 3000 }).catch(() => null)
    const phaseNow = await P.host.evaluate(() => document.querySelector('[data-screen-frame]:not([inert]) [data-phase]')?.getAttribute('data-phase') ?? null)
    if (label && phaseNow === 'reveal') await next.click({ timeout: 3000 }).catch(() => log(`${R}: next click missed (auto-advanced)`))
    else log(`${R}: reveal auto-advanced before the host click`)
    if (r === 2 || (label ?? '').includes('Classifica')) break
  }
  await Promise.all(Object.values(P).map((p) => waitScreen(p, 'final', 20_000)))
  await sleep(3500)
  await shotAll('20-final')
  await cycle('20-final', { bottom: true })
  for (const k of ['ios', 'android']) {
    await scrollBottom(P[k])
    await sleep(800)
    await P[k].screenshot({ path: `${OUT}real-21-final-bottom-${k}.png` })
  }
  report.workers = workers
  check(workers.host.some((u) => /worker/.test(u)), 'host started the analysis worker', workers.host)
} catch (e) {
  fatal = e
  log('FATAL', e.stack)
  await shotAll('zz-failure')
}
report.errors = { host: host.errors, ios: ios.errors, android: android.errors }
writeFileSync(new URL(`./out/real${process.env.TAG ?? ''}.json`, import.meta.url), JSON.stringify(report, null, 1))
log('errors', JSON.stringify(report.errors).slice(0, 2000))
await closeBrowsers()
process.exit(fatal ? 1 : 0)
