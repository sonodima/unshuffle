// Diagnostic: who interrupts play-all? Wraps audioEngine.stop / play* and logs stacks + store changes.
import { chromium } from 'playwright'
const BASE = 'http://127.0.0.1:5304/'
const T0 = Date.now()
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1).padStart(6)}s]`, ...a)
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(() => localStorage.setItem('unshuffle:onboarded', String(Date.now())))
const page = await ctx.newPage()
page.on('console', (m) => { if (m.text().startsWith('[qa]')) log(m.text().slice(0, 1500)) })
await page.goto(BASE)
await page.locator('[data-screen-frame][data-screen="home"]:not([inert])').waitFor()
await page.getByRole('button', { name: 'Crea stanza', exact: true }).click()
await page.locator('[data-screen-frame][data-screen="lobby"]:not([inert])').waitFor()
await page.evaluate(async () => {
  const eng = await import('/src/audio/engine.ts')
  const e = eng.audioEngine
  for (const k of ['stop', 'playSequence', 'playSegment', 'playFull']) {
    const orig = e[k]
    e[k] = function (...a) {
      const st = new Error().stack.split('\n').slice(2, 9).map((s) => s.trim().replace(/https?:\/\/[^/]+/, '').replace(/\?[^:)]*/, '')).join(' <- ')
      console.log(`[qa] ${k}(${typeof a[0] === 'string' ? a[0] : a[0] ?? ''}${a[1]?.tag ? ' tag=' + a[1].tag : a[2]?.tag ? ' tag=' + a[2].tag : ''}) state=${JSON.stringify(e.getState())} :: ${st}`)
      return orig.apply(this, a)
    }
  }
  e.subscribe((s) => console.log(`[qa] state ${JSON.stringify(s)}`))
  const { useGame } = await import('/src/game/store.ts')
  let last = useGame.getState().room
  useGame.subscribe((s) => {
    if (s.room !== last) {
      const ch = []
      for (const k of Object.keys(s.room ?? {})) if (last && s.room[k] !== last[k]) ch.push(k)
      last = s.room
      if (s.room?.phase?.kind === 'playing') console.log(`[qa] room changed: ${ch.join(',')}`)
    }
  })
})
const search = page.getByRole('searchbox', { name: 'Cerca playlist' })
await search.click()
await search.fill('hits 2000')
const first = page.locator('section[aria-label="Scegli la playlist"] ul:not([aria-hidden]) li button[aria-pressed]').first()
await first.waitFor({ timeout: 20000 })
await page.waitForTimeout(500)
await first.click()
await page.getByRole('radiogroup', { name: 'Spezzoni' }).first().getByRole('radio', { name: /^8/ }).first().click()
await page.getByRole('radiogroup', { name: 'Tempo per round' }).first().getByRole('radio', { name: '120s' }).first().click()
await page.getByRole('button', { name: /Inizia partita/ }).first().click()
await page.waitForFunction(() => document.querySelector('[data-screen-frame]:not([inert]) [data-phase="playing"]'), null, { timeout: 90000 })
await page.waitForTimeout(2500)
log('click play-all')
await page.getByRole('button', { name: 'Ascolta tutti gli spezzoni in ordine' }).click()
await page.waitForTimeout(32000)
log('done shuffled; now identity + play-all')
await page.evaluate(async () => {
  const { useGame } = await import('/src/game/store.ts')
  const st = useGame.getState()
  const round = st.room.rounds[st.room.phase.round]
  st.setArrangement(round.segments.map((_, i) => i))
})
await page.waitForTimeout(800)
await page.getByRole('button', { name: 'Ascolta tutti gli spezzoni in ordine' }).click()
await page.waitForTimeout(32000)
const sched = await page.evaluate(async () => (await import('/src/audio/engine.ts')).engineDebug.schedule().map((i) => `${i.position}:${i.join}/${i.outro}`))
log('last schedule', sched.join(' '))
await browser.close()
