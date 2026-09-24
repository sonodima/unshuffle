// Release screenshot set: a REAL game over the public PeerJS cloud, every screen shot
// at desktop 1440x900 and phone 390x844.
//
//   host   Chrome desktop 1440x900 (mouse); also shot at 390x844 by resizing the page
//   desk   Chrome desktop 1440x900 guest (mouse)
//   phone  Chrome 390x844 @2x touch guest (CDP touch drags)
//
// Playwright's WebKit can't open RTCDataChannels (scripts/qa-mobile/webrtc-probe.mjs), so a
// WebKit iPhone can't join a real room: its shots come from the shell lab's fixture states
// (ENGINE=webkit VPS=iphone14 node scripts/qa-mobile/sweep.mjs).
//
// Usage: node scripts/release/shots.mjs [baseUrl]   (default http://127.0.0.1:5500/)
// Output: scripts/e2e/shots/release-<nn>-<screen>-<who>.png
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://127.0.0.1:5500/'
const OUT = new URL('../e2e/shots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const T0 = Date.now()
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1).padStart(6)}s]`, ...a)
const problems = []
const notes = []

const chrome = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })

const PROFILES = {
  host: { name: 'Tommaso', avatar: 3, color: 0 },
  desk: { name: 'Giulia Bianchi', avatar: 7, color: 2 },
  phone: { name: 'Marco', avatar: 12, color: 4 },
  iphone: { name: 'Sofia', avatar: 18, color: 6 },
}

async function openPlayer(who, browser, opts) {
  const ctx = await browser.newContext(opts)
  const p = PROFILES[who]
  await ctx.addInitScript((prof) => {
    try {
      localStorage.setItem('unshuffle:onboarded', String(Date.now()))
      if (!localStorage.getItem('unshuffle:profile')) {
        localStorage.setItem('unshuffle:profile', JSON.stringify({ id: `rel-${prof.name.replace(/\W/g, '')}-${Math.random().toString(36).slice(2, 8)}`, ...prof }))
      }
    } catch {
      /* ignore */
    }
  }, p)
  const page = await ctx.newPage()
  page.__who = who
  page.on('dialog', (d) => void d.accept().catch(() => {}))
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`[${who}] console.error: ${m.text().slice(0, 300)}`)
  })
  page.on('pageerror', (e) => problems.push(`[${who}] pageerror: ${e.message}`))
  return page
}

const DESK = { viewport: { width: 1440, height: 900 } }
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
const host = await openPlayer('host', chrome, DESK)
const desk = await openPlayer('desk', chrome, DESK)
const phone = await openPlayer('phone', chrome, PHONE)
const iphone = null
const guests = [desk, phone, iphone].filter(Boolean)
const all = [host, ...guests]

let n = 0
const tagOf = (screen) => `release-${String(++n).padStart(2, '0')}-${screen}`
/** Shoot `pages` (default everyone); the host is also shot at phone size. */
async function shot(screen, pages = all, { hostPhone = true } = {}) {
  const tag = tagOf(screen)
  await Promise.all(pages.map((p) => p.screenshot({ path: `${OUT}${tag}-${p.__who === 'host' ? 'host-desktop' : p.__who}.png` }).catch((e) => problems.push(`shot ${tag} ${p.__who}: ${e.message}`))))
  if (hostPhone && pages.includes(host)) {
    await host.setViewportSize({ width: 390, height: 844 })
    await host.waitForTimeout(700)
    await host.screenshot({ path: `${OUT}${tag}-host-phone.png` }).catch(() => {})
    await host.setViewportSize({ width: 1440, height: 900 })
    await host.waitForTimeout(400)
  }
  log('📸', tag)
}

const live = '[data-screen-frame]:not([inert])'
const waitScreen = (p, s, timeout = 30_000) => p.locator(`[data-screen-frame][data-screen="${s}"]:not([inert])`).waitFor({ state: 'visible', timeout })
const waitPhase = (p, k, timeout = 90_000) =>
  p.waitForFunction((kk) => document.querySelector(`[data-screen-frame]:not([inert]) [data-phase="${kk}"]`) !== null, k, { timeout, polling: 100 })
const press = async (p, loc) => (p.__who === 'phone' || p.__who === 'iphone' ? loc.tap() : loc.click())

async function center(p, pos) {
  const box = await p.locator(`${live} [data-round-view="playing"] .sb-item[data-pos="${pos}"]`).boundingBox()
  if (!box) throw new Error(`no block at ${pos}`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}
async function touchDrag(p, from, to, steps = 16) {
  const cdp = await p.context().newCDPSession(p)
  const a = await center(p, from)
  const b = await center(p, to)
  const pt = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(a.x, a.y) })
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps) })
    await p.waitForTimeout(16)
  }
  await p.waitForTimeout(120)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await p.waitForTimeout(450)
  await cdp.detach()
}
async function mouseDrag(p, from, to, steps = 14) {
  const a = await center(p, from)
  const b = await center(p, to)
  await p.mouse.move(a.x, a.y)
  await p.mouse.down()
  for (let i = 1; i <= steps; i++) {
    await p.mouse.move(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps)
    await p.waitForTimeout(16)
  }
  await p.waitForTimeout(120)
  await p.mouse.up()
  await p.waitForTimeout(450)
}
const confirmBtn = (p) => p.locator(`${live} button`).filter({ hasText: /^Conferma$|Non hai spostato nulla/ }).first()
async function confirm(p) {
  await press(p, confirmBtn(p))
  const armed = p.locator(`${live} button[data-armed]`).first()
  if (await armed.waitFor({ state: 'visible', timeout: 400 }).then(() => true, () => false)) await press(p, armed)
}
async function scrollBottom(p) {
  await p.evaluate(() => {
    const f = document.querySelector('[data-screen-frame]:not([inert])')
    const els = [...(f?.querySelectorAll('*') ?? [])].filter((e) => e.scrollHeight > e.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(e).overflowY))
    const sc = els.sort((a, b) => b.clientHeight - a.clientHeight)[0] ?? document.scrollingElement
    sc?.scrollTo({ top: sc.scrollHeight })
  })
}
async function scrollTop(p) {
  await p.evaluate(() => {
    const f = document.querySelector('[data-screen-frame]:not([inert])')
    for (const e of f?.querySelectorAll('*') ?? []) if (e.scrollTop > 0) e.scrollTo({ top: 0 })
  })
}
async function noOverflow(p, where) {
  const o = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  if (o > 0) problems.push(`[${p.__who}] horizontal overflow ${o}px on ${where}`)
}

let exit = 0
try {
  // ------------------------------------------------------------------ home
  await Promise.all(all.map((p) => p.goto(BASE, { waitUntil: 'load' })))
  await Promise.all(all.map((p) => waitScreen(p, 'home')))
  await host.waitForTimeout(1500)
  await shot('home')
  for (const p of [phone, desk]) await p.getByRole('button', { name: /Come si gioca/ }).first().click()
  await phone.waitForTimeout(900)
  await shot('home-howto', [phone, desk], { hostPhone: false })
  for (const p of [phone, desk]) await p.keyboard.press('Escape')
  await phone.waitForTimeout(500)

  // ------------------------------------------------------------------ lobby
  await host.getByRole('button', { name: 'Crea stanza', exact: true }).click()
  await waitScreen(host, 'lobby')
  const code = await host.evaluate(() => /#\/r\/([A-Z]{5})/.exec(location.hash)?.[1] ?? null)
  log('room', code)
  await host.waitForTimeout(800)
  await shot('lobby-host-empty', [host])
  for (const g of guests) {
    await g.goto(`${BASE}#/r/${code}`)
    await waitScreen(g, 'home')
    await g.waitForTimeout(500)
  }
  await shot('home-invited', guests, { hostPhone: false })
  for (const g of guests) {
    await press(g, g.getByRole('button', { name: /^Entra/ }).first())
    await waitScreen(g, 'lobby')
  }
  const search = host.getByRole('searchbox', { name: 'Cerca playlist' })
  await search.click()
  await search.fill('hits 2000')
  const first = host.locator('section[aria-label="Scegli la playlist"] ul:not([aria-hidden]) li button[aria-pressed]').first()
  await first.waitFor({ state: 'visible', timeout: 20_000 })
  await host.waitForTimeout(700)
  await first.click()
  const radio = async (group, name) => host.getByRole('radiogroup', { name: group }).first().getByRole('radio', { name }).first().click()
  await radio('Round', '3')
  await radio('Spezzoni', /^8/)
  await radio('Tempo per round', '60s')
  await radio('Timer finale', '10s')
  await host.evaluate(() => document.activeElement?.blur?.())
  await host.waitForTimeout(1200)
  await shot('lobby')
  await noOverflow(phone, 'lobby')
  // kick confirmation (cancelled)
  await host.getByRole('button', { name: `Rimuovi ${PROFILES.phone.name}` }).first().click()
  await host.waitForTimeout(700)
  await shot('lobby-kick-confirm', [host], { hostPhone: false })
  await host.getByRole('button', { name: 'Annulla' }).first().click()
  await host.waitForTimeout(400)

  // ------------------------------------------------------------------ round 1
  await host.getByRole('button', { name: /Inizia partita/ }).first().click()
  await Promise.all(all.map((p) => waitScreen(p, 'round', 30_000)))
  await host.waitForTimeout(600)
  await shot('preparing', all, { hostPhone: false })
  await Promise.all(all.map((p) => waitPhase(p, 'intro', 60_000))).then(
    async () => {
      await host.waitForTimeout(1500)
      await shot('intro', all, { hostPhone: false })
    },
    () => notes.push('intro not captured'),
  )
  await Promise.all(all.map((p) => waitPhase(p, 'playing', 60_000)))
  await Promise.all(all.map((p) => p.locator(`${live} [data-round-view="playing"] .sb-item`).first().waitFor({ timeout: 15_000 })))
  await host.waitForTimeout(2200)
  await shot('playing')
  await noOverflow(phone, 'playing')
  // untouched CONFERMA only arms the button
  await press(desk, confirmBtn(desk))
  if (iphone) await press(iphone, confirmBtn(iphone))
  await desk.waitForTimeout(350)
  await shot('playing-armed', [desk, iphone].filter(Boolean), { hostPhone: false })
  // phone drags and confirms first → final-timer banner everywhere
  await touchDrag(phone, 0, 3)
  await touchDrag(phone, 6, 1)
  await host.getByRole('button', { name: 'Ascolta tutti gli spezzoni in ordine' }).click()
  await host.waitForTimeout(900)
  await shot('playing-dragged', [host, phone], { hostPhone: false })
  await confirm(phone)
  await host.getByText(/ha confermato!/).first().waitFor({ timeout: 6000 }).catch(() => problems.push('host never saw the first-confirm banner'))
  await host.waitForTimeout(600)
  await shot('playing-first-confirm', all, { hostPhone: false })
  // exit menu (guest sheet on the phone, host dialog on desktop)
  await press(phone, phone.getByRole('button', { name: 'Esci dalla partita' }).first())
  await host.getByRole('button', { name: 'Termina partita' }).first().click()
  await host.waitForTimeout(700)
  await shot('game-menu', [host, phone], { hostPhone: false })
  for (const p of [host, phone]) await p.keyboard.press('Escape')
  await host.waitForTimeout(400)
  await mouseDrag(host, 0, 2)
  await confirm(host)
  await host.waitForTimeout(700)
  await shot('playing-waiting', [host, desk], { hostPhone: false })

  // ------------------------------------------------------------------ reveal 1
  await Promise.all(all.map((p) => waitPhase(p, 'reveal', 40_000)))
  await host.waitForTimeout(1800)
  await shot('reveal-mid', all, { hostPhone: false })
  await Promise.all(all.map((p) => p.waitForSelector('.rv-root[data-stage="done"]', { timeout: 25_000 })))
  await host.waitForTimeout(700)
  await shot('reveal')
  await noOverflow(phone, 'reveal')
  for (const p of [phone, desk]) {
    const mine = p.getByRole('radio', { name: 'Il tuo ordine' })
    if (await mine.count()) await press(p, mine.first())
  }
  await phone.waitForTimeout(1300)
  await shot('reveal-your-order', [phone, desk], { hostPhone: false })
  for (const p of [phone, iphone].filter(Boolean)) await scrollBottom(p)
  await phone.waitForTimeout(600)
  await shot('reveal-bottom', [phone, iphone].filter(Boolean), { hostPhone: false })
  await host.getByRole('button', { name: /Prossimo round/ }).first().click()

  // ------------------------------------------------------------------ rounds 2–3 (quick)
  for (let r = 1; r < 3; r++) {
    await Promise.all(all.map((p) => waitPhase(p, 'playing', 60_000)))
    await Promise.all(all.map((p) => p.locator(`${live} [data-round-view="playing"] .sb-item`).first().waitFor({ timeout: 15_000 })))
    await host.waitForTimeout(1800)
    await touchDrag(phone, 1, 4)
    await mouseDrag(desk, 2, 0)
    await mouseDrag(host, 3, 1)
    for (const p of all) await confirm(p)
    await Promise.all(all.map((p) => waitPhase(p, 'reveal', 30_000)))
    await Promise.all(all.map((p) => p.waitForSelector('.rv-root[data-stage="done"]', { timeout: 25_000 })))
    await host.waitForTimeout(500)
    await host.getByRole('button', { name: r === 2 ? /Classifica finale/ : /Prossimo round/ }).first().click()
  }

  // ------------------------------------------------------------------ final
  await Promise.all(all.map((p) => waitScreen(p, 'final', 30_000)))
  await host.waitForTimeout(4500)
  await shot('final')
  await noOverflow(phone, 'final')
  for (const p of all) await scrollBottom(p)
  await host.waitForTimeout(1300)
  await shot('final-bottom', all, { hostPhone: false })
  for (const p of all) await scrollTop(p)
  const rem = phone.getByRole('button', { name: 'Rivincita!' })
  if (await rem.count()) {
    await press(phone, rem.first())
    await host.waitForTimeout(1200)
    await shot('final-rematch', [host, phone], { hostPhone: false })
  } else notes.push('no Rivincita! button on the phone guest')
  // host closes the room → guests get the exit notice
  await host.getByRole('button', { name: 'Esci', exact: true }).first().click()
  await host.waitForTimeout(700)
  await shot('final-close-confirm', [host], { hostPhone: false })
  await host.getByRole('button', { name: 'Chiudi stanza' }).last().click()
  await Promise.all(guests.map((g) => g.getByText(/Stanza chiusa|chiuso la stanza/).first().waitFor({ timeout: 20_000 }).catch(() => problems.push(`[${g.__who}] no room-closed notice`))))
  await phone.waitForTimeout(900)
  await shot('room-closed', guests, { hostPhone: false })
} catch (err) {
  exit = 1
  problems.push(`FATAL ${err?.stack ?? err}`)
  try {
    await shot('FAIL', all, { hostPhone: false })
  } catch {
    /* ignore */
  }
} finally {
  await chrome.close()
}
console.log('\n---- notes ----\n' + (notes.join('\n') || '(none)'))
console.log('\n---- problems ----\n' + (problems.join('\n') || '(none)'))
if (problems.length) exit = 1
console.log(`\nSHOTS ${exit ? 'FAIL' : 'PASS'} (${n} steps) in ${((Date.now() - T0) / 1000).toFixed(1)}s`)
process.exit(exit)
