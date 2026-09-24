// QA "code": two real browsers over the PeerJS cloud.
//  Round 1 — host confirms first (10 s final timer), the guest's tab reloads right after:
//            does the round wait for the guest to come back or end at once?
//  Round 2 — host confirms, the guest drops a block ~150 ms before the deadline:
//            is the final visible board what gets scored?
// Usage: node scripts/qa-code/blip-e2e.mjs [baseUrl]   (default http://127.0.0.1:5305/)
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://127.0.0.1:5305/'
const OUT = new URL('./shots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const T0 = Date.now()
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1).padStart(6)}s]`, ...a)
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
async function open(opts) {
  const ctx = await browser.newContext(opts)
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('unshuffle:onboarded', String(Date.now()))
    } catch {}
  })
  const page = await ctx.newPage()
  page.on('dialog', (d) => void d.accept().catch(() => {}))
  return page
}
const host = await open({ viewport: { width: 1440, height: 900 } })
const guest = await open({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const frame = (page, screen) => page.locator(`[data-screen-frame][data-screen="${screen}"]:not([inert])`)
const waitPhase = (page, k, timeout = 90_000) =>
  page.waitForFunction((k) => document.querySelector(`[data-screen-frame]:not([inert]) [data-phase="${k}"]`) !== null, k, { timeout, polling: 50 })
// Same module instances the app uses (dev server): read the store directly.
const room = (page) => page.evaluate(async () => (await import('/src/game/store.ts')).useGame.getState().room)
const hostNow = (page) => page.evaluate(async () => (await import('/src/game/clock.ts')).hostNow())
const boardOrder = (page) =>
  page.$$eval('[data-screen-frame]:not([inert]) [data-round-view="playing"] .sb-item', (els) =>
    els.map((e) => ({ pos: +e.getAttribute('data-pos'), seg: +e.getAttribute('data-seg') })).sort((a, b) => a.pos - b.pos).map((e) => e.seg),
  )
async function center(page, pos) {
  const b = await page.locator(`[data-screen-frame]:not([inert]) [data-round-view="playing"] .sb-item[data-pos="${pos}"]`).boundingBox()
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}
const result = {}
try {
  await Promise.all([host.goto(BASE), guest.goto(BASE)])
  await frame(host, 'home').waitFor({ timeout: 30_000 })
  await host.getByRole('button', { name: 'Crea stanza', exact: true }).click()
  await frame(host, 'lobby').waitFor({ timeout: 30_000 })
  const code = await host.evaluate(() => /#\/r\/([A-Z]{5})/.exec(location.hash)?.[1] ?? null)
  log('room', code)
  await guest.goto(`${BASE}#/r/${code}`)
  await frame(guest, 'home').waitFor({ timeout: 30_000 })
  await guest.getByRole('button', { name: /^Entra/ }).tap()
  await frame(guest, 'lobby').waitFor({ timeout: 30_000 })
  const search = host.getByRole('searchbox', { name: 'Cerca playlist' })
  await search.click()
  await search.fill('hits 2000')
  const first = host.locator('section[aria-label="Scegli la playlist"] ul:not([aria-hidden]) li button[aria-pressed]').first()
  await first.waitFor({ timeout: 20_000 })
  await host.waitForTimeout(500)
  await first.click()
  const setRadio = (g, n) => host.getByRole('radiogroup', { name: g }).first().getByRole('radio', { name: n }).first().click()
  await setRadio('Round', '3')
  await setRadio('Spezzoni', /^6/)
  await setRadio('Timer finale', '10s')
  await host.waitForTimeout(600)
  await host.getByRole('button', { name: /Inizia partita/ }).first().click()

  // ---------------- round 1: blip during the final timer
  await Promise.all([waitPhase(host, 'playing'), waitPhase(guest, 'playing')])
  await guest.locator('[data-round-view="playing"] .sb-item').first().waitFor()
  await host.waitForTimeout(2000)
  await host.getByRole('button', { name: /^Conferma/ }).first().click()
  await host.waitForTimeout(300)
  const r1 = await room(host)
  const left = r1.phase.endsAt - (await hostNow(host))
  log(`host confirmed; final timer ${(left / 1000).toFixed(1)} s left; guest reloads now`)
  const reloadAt = Date.now()
  await guest.reload()
  await waitPhase(host, 'reveal', 30_000)
  const revealAfter = Date.now() - reloadAt
  log(`host went to REVEAL ${(revealAfter / 1000).toFixed(1)} s after the guest reload (final timer had ${(left / 1000).toFixed(1)} s)`)
  await host.waitForTimeout(1500)
  await host.screenshot({ path: `${OUT}blip-r1-reveal-host.png` })
  await waitPhase(guest, 'reveal', 30_000).catch(() => {})
  await guest.waitForTimeout(1500)
  await guest.screenshot({ path: `${OUT}blip-r1-reveal-guest.png` })
  const rr1 = await room(host)
  const gid = rr1.players.find((p) => !p.isHost).id
  result.round1 = { finalTimerLeftMs: Math.round(left), revealAfterReloadMs: revealAfter, guest: rr1.results[0].find((r) => r.playerId === gid) }

  // ---------------- round 2: drop 150 ms before the deadline
  await host.getByRole('button', { name: /Prossimo round|Classifica/ }).first().click().catch(() => {})
  await Promise.all([waitPhase(host, 'playing'), waitPhase(guest, 'playing')])
  await guest.locator('[data-round-view="playing"] .sb-item').first().waitFor()
  await host.waitForTimeout(2000)
  await host.getByRole('button', { name: /^Conferma/ }).first().click()
  await host.waitForTimeout(400)
  const r2 = await room(guest)
  const endsAt = r2.phase.endsAt
  const cdp = await guest.context().newCDPSession(guest)
  const a = await center(guest, 0)
  const b = await center(guest, 3)
  const pt = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }]
  // Pick the block up well before the end, release it just before the deadline.
  while (endsAt - (await hostNow(guest)) > 1500) await guest.waitForTimeout(50)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(a.x, a.y) })
  for (let i = 1; i <= 12; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(a.x + ((b.x - a.x) * i) / 12, a.y + ((b.y - a.y) * i) / 12) })
    await guest.waitForTimeout(16)
  }
  while (endsAt - (await hostNow(guest)) > 150) await guest.waitForTimeout(5)
  const dropLead = endsAt - (await hostNow(guest))
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await guest.waitForTimeout(60)
  const visible = await boardOrder(guest).catch(() => null)
  const storeArr = await guest.evaluate(async () => (await import('/src/game/store.ts')).useGame.getState().arrangement)
  await waitPhase(host, 'reveal', 30_000)
  await host.waitForTimeout(500)
  const rr2 = await room(host)
  const scored = rr2.results[1].find((r) => r.playerId === gid)
  await guest.waitForTimeout(2500)
  await guest.screenshot({ path: `${OUT}blip-r2-reveal-guest.png` })
  result.round2 = { dropLeadMs: Math.round(dropLead), guestBoardAfterDrop: visible, guestStoreArrangement: storeArr, scoredOrder: scored.order, timedOut: scored.timedOut, points: scored.points }
  log(JSON.stringify(result))
} catch (err) {
  log('ERROR', err?.message ?? err)
  await host.screenshot({ path: `${OUT}blip-error-host.png` }).catch(() => {})
  await guest.screenshot({ path: `${OUT}blip-error-guest.png` }).catch(() => {})
  console.log(JSON.stringify(result))
} finally {
  await browser.close()
}
