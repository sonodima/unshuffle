// Fix-shell lab screenshots + DOM checks. Usage: node scripts/fix-shell/shoot.mjs [scenario…]
// Needs: UNSHUFFLE_VITE_CACHE=node_modules/.vite-fix-shell npx vite --port 5406 --strictPort
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:5406'
const OUT = new URL('./shots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

const VIEWPORTS = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  land: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const fx = (page, fn, ...args) => page.evaluate(([f, a]) => window.__fx[f](...a), [fn, args])

/** Box of an element (CSS px) or null. */
async function box(page, selector) {
  const el = await page.$(selector)
  if (!el) return null
  return el.boundingBox()
}

async function hudBox(page) {
  return box(page, '[data-screen-frame]:not([inert]) [data-round-view="playing"] > header')
}

/** A gesture that unlocks audio without touching the screen's controls. */
async function unlock(page) {
  // A click in the left gutter: user activation, no control underneath.
  await page.mouse.click(2, 300)
  await wait(250)
}

const checks = []
function check(name, ok, detail = '') {
  checks.push({ name, ok, detail })
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const SCENARIOS = {
  async 'playing-toasts'(page, vp) {
    await unlock(page)
    await fx(page, 'setFixture', 'playing', 'p-2')
    await wait(1800)
    await fx(page, 'demoToasts')
    await wait(900)
    const hud = await hudBox(page)
    const toasts = await page.$$eval('section[aria-label="Notifiche"] [role="status"]', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, text: e.textContent } }))
    check(`${vp} toasts below HUD`, !!hud && toasts.length > 0 && toasts.every((t) => t.top >= hud.y + hud.height - 1), `hud bottom ${hud && Math.round(hud.y + hud.height)}, toasts ${JSON.stringify(toasts.map((t) => Math.round(t.top)))}`)
    if (vp === 'phone') {
      check(`${vp} one toast, roster news quiet`, toasts.length === 1 && !/entrato/.test(toasts[0].text), toasts.map((t) => t.text).join(' | '))
    }
  },
  async 'playing-cue'(page, vp) {
    await fx(page, 'setFixture', 'playing', 'p-2')
    await wait(2400)
    const cue = await page.$$eval('section[aria-label="Notifiche"] [role="status"]', (els) => els.map((e) => e.textContent))
    check(`${vp} unlock cue shown`, cue.some((t) => /attivare l’audio/.test(t)), cue.join(' | '))
    await page.screenshot({ path: `${OUT}${vp}-playing-cue.png` })
    await unlock(page)
    await wait(800)
    const after = await page.$$eval('section[aria-label="Notifiche"] [role="status"]', (els) => els.map((e) => e.textContent))
    check(`${vp} unlock cue gone after a gesture`, !after.some((t) => /audio/.test(t)), after.join(' | '))
    return 'skip-shot'
  },
  async 'reveal-cue'(page, vp) {
    await fx(page, 'setFixture', 'reveal', 'p-2')
    await wait(2600)
    const cue = await page.$$eval('section[aria-label="Notifiche"] [role="status"]', (els) => els.map((e) => e.textContent))
    check(`${vp} reveal cue says "ascoltare la canzone"`, cue.some((t) => /ascoltare la canzone/.test(t)), cue.join(' | '))
  },
  async reconnecting(page, vp) {
    await unlock(page)
    await fx(page, 'setFixture', 'playing', 'p-2')
    await wait(1800)
    await fx(page, 'setConnection', 'reconnecting')
    await wait(6200)
    await fx(page, 'pushEvent', { type: 'info', message: 'Audio di “One More Time” non disponibile: puoi comunque giocare.' }, 0)
    await wait(700)
    const hud = await hudBox(page)
    const banner = await box(page, 'div[role="status"][aria-live="polite"].fixed > div')
    const toast = await box(page, 'section[aria-label="Notifiche"] [role="status"]')
    const hudBottom = hud ? hud.y + hud.height : 0
    check(`${vp} banner below HUD`, !!banner && banner.y >= hudBottom - 1, `hud ${Math.round(hudBottom)} banner ${banner && Math.round(banner.y)}`)
    const apart = !!banner && !!toast && (toast.y >= banner.y + banner.height - 1 || toast.x >= banner.x + banner.width || toast.x + toast.width <= banner.x)
    check(`${vp} toast clear of banner`, apart, `banner ${banner && JSON.stringify([banner.x, banner.y, banner.width, banner.height].map(Math.round))} toast ${toast && JSON.stringify([toast.x, toast.y, toast.width].map(Math.round))}`)
  },
  async 'lobby-reconnecting'(page, vp) {
    await unlock(page)
    await fx(page, 'setFixture', 'lobby', 'p-2')
    await wait(1200)
    await fx(page, 'setConnection', 'reconnecting')
    await wait(6200)
    const banner = await box(page, 'div[role="status"][aria-live="polite"].fixed > div')
    const vw = page.viewportSize().width
    check(`${vp} lobby banner leaves the top corners free`, !!banner && (vw >= 640 || (banner.x >= 56 && banner.x + banner.width <= vw - 56)), banner ? JSON.stringify([banner.x, banner.width].map(Math.round)) : 'none')
  },
  async 'home-scroll'(page, vp) {
    await unlock(page)
    await fx(page, 'home')
    await wait(1500)
    const sound = 'button[aria-haspopup="dialog"][aria-label^="Audio"]'
    const at0 = await page.$eval(sound, (b) => getComputedStyle(b.closest('[aria-hidden]') ?? b).opacity).catch(() => 'missing')
    await page.screenshot({ path: `${OUT}${vp}-home-top.png` })
    const y = await fx(page, 'scrollScreen', 320)
    await wait(700)
    const hidden = await page.$eval(sound, (b) => { const w = b.closest('[inert]'); return !!w && getComputedStyle(w).opacity === '0' }).catch(() => 'missing')
    check(`${vp} floating sound control away when scrolled`, hidden === true, `scrollTop ${y} top-opacity ${at0} hidden ${hidden}`)
    await page.screenshot({ path: `${OUT}${vp}-home-scrolled.png` })
    await fx(page, 'scrollScreen', 0)
    await wait(700)
    const back = await page.$eval(sound, (b) => !b.closest('[inert]')).catch(() => 'missing')
    check(`${vp} floating sound control back at the top`, back === true, String(back))
    return 'skip-shot'
  },
  async 'lost-lobby'(page) {
    await unlock(page)
    await fx(page, 'setFixture', 'lobby', 'p-2')
    await wait(900)
    await fx(page, 'setConnection', 'closed', 'Connessione con l’host persa.')
    await wait(900)
    const text = await page.$eval('[role="dialog"]', (d) => d.textContent)
    check('lobby lost copy has no score promise', !/punteggio/.test(text) && /forse ha chiuso la stanza/.test(text), text)
  },
  async 'lost-game'(page) {
    await unlock(page)
    await fx(page, 'setFixture', 'playing', 'p-2')
    await wait(1200)
    await fx(page, 'setConnection', 'closed', 'Connessione con l’host persa.')
    await wait(900)
    const text = await page.$eval('[role="dialog"]', (d) => d.textContent)
    check('game lost copy is conditional', /Se l’host è ancora in partita/.test(text), text)
  },
  async 'retry-fail'(page, vp) {
    await unlock(page)
    await fx(page, 'setRejoinMode', 'fail')
    await fx(page, 'setFixture', 'playing', 'p-2')
    await wait(1200)
    await fx(page, 'setConnection', 'closed', 'Connessione con l’host persa.')
    await wait(900)
    await page.getByRole('button', { name: 'Riprova' }).click()
    await wait(500)
    const during = await page.$$eval('[role="dialog"]', (ds) => ds.length)
    await wait(1600)
    const dialogs = await page.$$eval('[role="dialog"]', (ds) => ds.map((d) => d.textContent))
    check(`${vp} failed retry = same single dialog`, during === 1 && dialogs.length === 1, `during ${during}, after ${dialogs.length}`)
    check(`${vp} failed retry explains the room is gone`, /Stanza non più disponibile/.test(dialogs[0] ?? '') && !/Controlla il codice/.test(dialogs[0] ?? '') && !/Riprova/.test(dialogs[0] ?? ''), dialogs[0])
    await page.screenshot({ path: `${OUT}${vp}-retry-fail.png` })
    await page.getByRole('button', { name: 'Torna alla home' }).click()
    await wait(700)
    const left = await page.$$eval('[role="dialog"]', (ds) => ds.map((d) => d.getAttribute('aria-labelledby') ? d.textContent.slice(0, 60) : d.textContent.slice(0, 60)))
    check(`${vp} home closes it (only Home's own first-visit guide may remain)`, left.every((t) => !/Stanza non più disponibile|Connessione persa/.test(t)), JSON.stringify(left))
    return 'skip-shot'
  },
  async 'gallery-host-gone'(page, vp) {
    await page.goto(`${BASE}/lab/fix-shell.html?gallery=1`)
    await wait(600)
    await fx(page, 'gallery', { kind: 'lost', context: 'game', cause: 'host-gone' })
    await wait(700)
    const text = await page.$eval('[role="dialog"]', (d) => d.textContent)
    check(`${vp} host-gone: home only`, /L’host ha lasciato la partita/.test(text) && !/Riprova/.test(text), text)
  },
}

const only = process.argv.slice(2)
const browser = await chromium.launch({ channel: 'chrome' })
const errors = []
for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  for (const [name, run] of Object.entries(SCENARIOS)) {
    if (only.length && !only.includes(name) && !only.includes(`${vpName}:${name}`)) continue
    if (vpName === 'land' && !['home-scroll', 'reconnecting', 'playing-toasts'].includes(name)) continue
    if (vpName !== 'land' && name === 'home-scroll') continue
    const ctx = await browser.newContext(vp)
    // A returning player: Home's first-visit guide already shown.
    await ctx.addInitScript(() => localStorage.setItem('unshuffle:onboarded', String(Date.now())))
    const page = await ctx.newPage()
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') errors.push(`${vpName}/${name}: ${m.text()}`)
    })
    page.on('pageerror', (e) => errors.push(`${vpName}/${name}: ${e.message}`))
    await page.goto(`${BASE}/lab/fix-shell.html`)
    await wait(900)
    const r = await run(page, vpName)
    if (r !== 'skip-shot') await page.screenshot({ path: `${OUT}${vpName}-${name}.png` })
    await ctx.close()
  }
}
await browser.close()
const failed = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - failed.length}/${checks.length} checks OK`)
if (errors.length) console.log(`console:\n  ${[...new Set(errors)].join('\n  ')}`)
process.exit(failed.length ? 1 : 0)
