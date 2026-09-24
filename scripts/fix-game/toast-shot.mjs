// Screenshot of the (neutral) audio-failure toast over the play HUD, phone + desktop.
import { chromium } from 'playwright'
const URL = 'http://127.0.0.1:5458/lab/fix-game.html'
const OUT = new globalThis.URL('./shots/', import.meta.url).pathname
const PLAYLIST = { id: 248297032, title: '00s Hits', picture: '', nbTracks: 100 }
const b = await chromium.launch({ channel: 'chrome' })
for (const [tag, opts] of [
  ['toast-390', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }],
  ['toast-360', { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }],
  ['toast-1440', { viewport: { width: 1440, height: 900 } }],
]) {
  const ctx = await b.newContext(opts)
  await ctx.addInitScript(() => localStorage.setItem('unshuffle:onboarded', String(Date.now())))
  const p = await ctx.newPage()
  await p.goto(URL)
  await p.waitForFunction(() => !!window.__fg)
  await p.evaluate(async (pl) => {
    const s = window.__fg.useGame.getState()
    await s.createRoom()
    s.updateSettings({ playlist: pl, rounds: 3, snippets: 8, roundTime: 90, finalTimer: 15 })
    await window.__fg.useGame.getState().startGame()
  }, PLAYLIST)
  await p.waitForFunction(() => window.__fg.useGame.getState().room?.phase.kind === 'playing', null, { timeout: 90_000 })
  await p.waitForTimeout(1500)
  await p.evaluate(() => window.__fg.useGame.getState().notify('Audio di questo round non disponibile: puoi comunque giocare.'))
  await p.waitForTimeout(700)
  await p.screenshot({ path: `${OUT}${tag}.png` })
  await ctx.close()
}
await b.close()
