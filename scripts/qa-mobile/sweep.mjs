// Layout sweep: every screen/state × viewport, real screens over fixture states (shell lab).
// Usage: ENGINE=chromium|webkit [VPS=360x740,390x844] [STATES=home,lobby-host] node scripts/qa-mobile/sweep.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { BASE, OUT, VIEWPORTS, newContext, metrics, scrollScreen, sleep, closeBrowsers } from './lib.mjs'
import { installQa, setState, goHome } from './states.mjs'

const ENGINE = process.env.ENGINE ?? 'chromium'
const onlyVps = process.env.VPS?.split(',')
const onlyStates = process.env.STATES?.split(',')
const vps = [...VIEWPORTS, ...(ENGINE === 'webkit' ? ['iphone14'] : [])].filter((v) => !onlyVps || onlyVps.includes(v === 'iphone14' ? v : v.id))
const RES = new URL('./out/', import.meta.url).pathname
mkdirSync(RES, { recursive: true })

const clickIf = async (loc) => {
  if ((await loc.count()) && (await loc.first().isVisible())) {
    await loc.first().click()
    return true
  }
  return false
}
const tab = (p, name) => clickIf(p.getByRole('tab', { name: new RegExp(`^${name}`) }))

const STATES = [
  { id: 'home', run: async (p) => goHome(p), wait: 1600, bottom: true },
  {
    id: 'home-avatar',
    run: async (p) => {
      await goHome(p)
      await sleep(800)
      await p.getByRole('button', { name: 'Cambia avatar e colore' }).click()
    },
    wait: 900,
    after: (p) => p.keyboard.press('Escape'),
  },
  {
    id: 'home-code',
    run: async (p) => {
      await goHome(p)
      await sleep(700)
      const box = p.getByRole('textbox', { name: 'Codice stanza: lettera 1 di 5' })
      await box.click()
      await p.keyboard.type('KXQ')
    },
    wait: 500,
  },
  { id: 'lobby-host', run: (p) => setState(p, 'lobby'), wait: 1200, bottom: true },
  {
    id: 'lobby-host-search',
    run: async (p) => {
      await setState(p, 'lobby')
      await sleep(700)
      await tab(p, 'Playlist')
      const s = p.getByRole('searchbox', { name: 'Cerca playlist' })
      await s.click()
      await s.fill('rock anni 80 classici')
      await p
        .locator('section[aria-label="Scegli la playlist"] ul:not([aria-hidden]) li button[aria-pressed]')
        .first()
        .waitFor({ timeout: 15_000 })
        .catch(() => {})
      await p.evaluate(() => document.activeElement?.blur?.())
    },
    wait: 900,
    bottom: true,
  },
  {
    id: 'lobby-host-chips',
    run: async (p) => {
      await setState(p, 'lobby')
      await sleep(700)
      await tab(p, 'Playlist')
    },
    wait: 2500,
    bottom: true,
  },
  {
    id: 'lobby-host-rules',
    run: async (p) => {
      await setState(p, 'lobby')
      await sleep(700)
      await tab(p, 'Regole')
    },
    wait: 900,
    bottom: true,
  },
  { id: 'lobby-guest', run: (p) => setState(p, 'lobby', { meId: 'p-2' }), wait: 1200, bottom: true },
  {
    id: 'lobby-guest-playlist',
    run: async (p) => {
      await setState(p, 'lobby', { meId: 'p-2', long: true })
      await sleep(700)
      await tab(p, 'Playlist')
    },
    wait: 1200,
    bottom: true,
  },
  { id: 'lobby-long', run: (p) => setState(p, 'lobby', { long: true }), wait: 1200, bottom: true },
  {
    id: 'lobby-qr',
    run: async (p) => {
      await setState(p, 'lobby')
      await sleep(900)
      if (!(await clickIf(p.getByRole('button', { name: 'Mostra QR code' })))) await clickIf(p.getByRole('button', { name: 'Ingrandisci QR code' }))
    },
    wait: 1000,
    after: (p) => p.keyboard.press('Escape'),
  },
  { id: 'preparing', run: (p) => setState(p, 'preparing'), wait: 1200 },
  { id: 'intro', run: (p) => setState(p, 'intro'), wait: 900 },
  { id: 'playing-6', run: (p) => setState(p, 'playing', { n: 6 }), wait: 2200, audio: true },
  { id: 'playing-8', run: (p) => setState(p, 'playing', { n: 8 }), wait: 2200, audio: true },
  { id: 'playing-12', run: (p) => setState(p, 'playing', { n: 12 }), wait: 2200, audio: true },
  { id: 'playing-16', run: (p) => setState(p, 'playing', { n: 16 }), wait: 2200, audio: true },
  { id: 'playing-16-long', run: (p) => setState(p, 'playing', { n: 16, long: true, meId: 'p-2' }), wait: 2200, audio: true },
  { id: 'submitted', run: (p) => setState(p, 'submitted', { n: 8, long: true, meId: 'p-host' }), wait: 1800, audio: true },
  { id: 'final-timer', run: (p) => setState(p, 'finalTimer', { n: 8 }), wait: 900, audio: true },
  { id: 'reveal-mid', run: (p) => setState(p, 'reveal', { n: 8 }), wait: 1900, audio: true },
  { id: 'reveal-done', run: (p) => setState(p, 'reveal', { n: 8 }), wait: 7500, audio: true, bottom: true, mid: true },
  { id: 'reveal-guest-long', run: (p) => setState(p, 'reveal', { n: 16, long: true, meId: 'p-2' }), wait: 8000, audio: true, bottom: true, mid: true },
  { id: 'final', run: (p) => setState(p, 'final'), wait: 4200, bottom: true, mid: true },
  { id: 'final-long-guest', run: (p) => setState(p, 'final', { long: true, meId: 'p-2' }), wait: 4200, bottom: true, mid: true },
  {
    id: 'reconnecting',
    run: async (p) => {
      await setState(p, 'playing', { n: 8, meId: 'p-2' })
      await sleep(900)
      await p.evaluate(() => window.__shell.setConnection('reconnecting'))
    },
    wait: 1200,
  },
  {
    id: 'closed',
    run: async (p) => {
      await setState(p, 'playing', { n: 8, meId: 'p-2' })
      await sleep(900)
      await p.evaluate(() => window.__shell.setConnection('closed', 'Connessione con l’host persa.'))
    },
    wait: 1200,
  },
  {
    id: 'resume',
    run: async (p) => {
      await goHome(p)
      await sleep(500)
      await p.evaluate(() => window.__shell.resume())
    },
    wait: 1200,
    after: (p) => p.evaluate(() => window.__shell.resumeDone()),
  },
  {
    id: 'toasts-playing',
    run: async (p) => {
      await setState(p, 'playing', { n: 12, meId: 'p-2' })
      await sleep(900)
      await p.evaluate(() => window.__shell.demoToasts())
    },
    wait: 1400,
    audio: true,
  },
  {
    id: 'reactions-lobby',
    run: async (p) => {
      await setState(p, 'lobby', { meId: 'p-2' })
      await sleep(900)
      await p.evaluate(() => window.__shell.reactions(8))
    },
    wait: 900,
  },
].filter((s) => !onlyStates || onlyStates.includes(s.id))

const results = []
for (const vp of vps) {
  const vpId = vp === 'iphone14' ? 'iphone14' : vp.id
  const { ctx, page, errors } = await newContext(ENGINE, vp)
  await page.goto(`${BASE}/lab/shell.html?real=1&panel=0`, { waitUntil: 'load' })
  await installQa(page)
  let audio = null
  for (const st of STATES) {
    const tag = `${ENGINE}-${vpId}-${st.id}`
    try {
      if (st.audio && !audio) audio = await page.evaluate(() => window.__qa.loadAudio())
      await goHome(page)
      await sleep(450)
      await st.run(page)
      await sleep(st.wait)
      const m = await metrics(page)
      await page.screenshot({ path: `${OUT}${tag}.png` })
      const entry = { engine: ENGINE, vp: vpId, state: st.id, top: m, errors: errors.splice(0) }
      if (st.mid && (await scrollScreen(page, 0.5))) {
        await sleep(500)
        entry.mid = await metrics(page)
        await page.screenshot({ path: `${OUT}${tag}-mid.png` })
      }
      if (st.bottom && (await scrollScreen(page, 1))) {
        await sleep(600)
        entry.bottom = await metrics(page)
        await page.screenshot({ path: `${OUT}${tag}-bottom.png` })
      }
      results.push(entry)
      const flag = [
        m.docOverflowX > 0 && `docX+${m.docOverflowX}`,
        m.offscreen.length && `offscreen:${m.offscreen.length}`,
        m.textSpill.length && `spill:${m.textSpill.length}`,
        m.soundOverlap.length && `soundOverlap:${m.soundOverlap.length}`,
        entry.bottom?.soundOverlap.length && `soundOverlapBottom:${entry.bottom.soundOverlap.length}`,
        entry.errors.length && `errors:${entry.errors.length}`,
      ].filter(Boolean)
      console.log(tag, flag.join(' ') || 'ok')
      if (st.after) await st.after(page).catch(() => {})
    } catch (e) {
      console.log(tag, 'FAILED', e.message.split('\n')[0])
      results.push({ engine: ENGINE, vp: vpId, state: st.id, failed: e.message.split('\n')[0], errors: errors.splice(0) })
    }
  }
  results.push({ engine: ENGINE, vp: vpId, state: '_audio', audio })
  await ctx.close()
}
writeFileSync(`${RES}sweep-${ENGINE}${process.env.TAG ?? ''}.json`, JSON.stringify(results, null, 1))
await closeBrowsers()
