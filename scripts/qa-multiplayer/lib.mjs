// Shared harness for the "multiplayer" QA scripts: real browsers, real PeerJS
// cloud, real Deezer. The store is read (never written) through the dev
// server's module graph: `import('/src/game/store.ts')` resolves to the very
// module instance the app uses.
import { chromium } from 'playwright'
import { mkdirSync, appendFileSync } from 'node:fs'

export const BASE = process.env.BASE ?? 'http://127.0.0.1:5301/'
export const OUT = new URL('./shots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
export const T0 = Date.now()
export const RUN = process.env.RUN ?? 'mp'

export const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1).padStart(6)}s]`, ...a)
export const results = [] // { name, ok, detail }
export const consoleLines = []
export const problems = []

export function check(name, cond, detail = '') {
  results.push({ name, ok: !!cond, detail })
  log(cond ? 'PASS' : 'FAIL', name, detail)
  return !!cond
}

export let browser
export async function launch() {
  browser = await chromium.launch({
    channel: 'chrome',
    headless: !process.env.HEADFUL,
    args: ['--autoplay-policy=no-user-gesture-required'],
  })
  return browser
}

export const DESKTOP = { viewport: { width: 1440, height: 900 } }
export const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }

/**
 * Opens a player in its own context. `profile` = PlayerProfile to seed (only if
 * the context has none yet), `storageState` to clone another context's storage.
 */
export async function openPlayer(name, device, { profile, storageState } = {}) {
  const ctx = await browser.newContext({ ...device, ...(storageState ? { storageState } : {}) })
  await ctx.addInitScript((prof) => {
    try {
      localStorage.setItem('unshuffle:onboarded', String(Date.now()))
      if (prof && !localStorage.getItem('unshuffle:profile')) localStorage.setItem('unshuffle:profile', JSON.stringify(prof))
    } catch {
      /* ignore */
    }
  }, profile ?? null)
  const page = await ctx.newPage()
  page.__name = name
  page.on('dialog', (d) => void d.accept().catch(() => {}))
  page.on('console', (m) => {
    const t = m.type()
    if (t !== 'error' && t !== 'warning') return
    const text = m.text()
    consoleLines.push(`[${name}] ${t}: ${text.slice(0, 300)}`)
  })
  page.on('pageerror', (e) => {
    problems.push(`[${name}] pageerror: ${e.message}`)
    consoleLines.push(`[${name}] PAGEERROR: ${e.message}`)
  })
  return page
}

export const frameSel = (screen) => `[data-screen-frame][data-screen="${screen}"]:not([inert])`
export async function waitScreen(page, screen, timeout = 30_000) {
  await page.locator(frameSel(screen)).waitFor({ state: 'visible', timeout })
}
export async function currentScreen(page) {
  return page.evaluate(() => document.querySelector('[data-screen-frame]:not([inert])')?.getAttribute('data-screen') ?? null)
}

/** Snapshot of the store (+ host clock) from inside the page. */
export async function st(page) {
  return page.evaluate(async () => {
    const m = await import('/src/game/store.ts')
    const c = await import('/src/game/clock.ts')
    const s = m.useGame.getState()
    return {
      role: s.role,
      connection: s.connection,
      error: s.error,
      me: s.me,
      room: s.room,
      arrangement: s.arrangement,
      arrangementRound: s.arrangementRound,
      submitted: s.submitted,
      toasts: s.toasts.map((t) => t.event),
      hostNow: c.hostNow(),
      localNow: Date.now(),
    }
  })
}

export async function waitStore(page, fnSrc, arg, timeout = 60_000) {
  // fnSrc: (state, arg) => boolean, evaluated in page against useGame.getState().
  // NOTE: waitForFunction does not await an async predicate (a Promise is truthy),
  // so the store is exposed on window first and the predicate stays synchronous.
  const deadline = Date.now() + timeout
  for (;;) {
    try {
      await page.evaluate(async () => {
        if (!window.__qaG) window.__qaG = (await import('/src/game/store.ts')).useGame
      })
      return await page.waitForFunction(
        ([src, a]) => {
          const g = window.__qaG
          if (!g) throw new Error('store gone (reload)')
          const f = new Function('s', 'a', `return (${src})(s, a)`)
          return f(g.getState(), a)
        },
        [fnSrc, arg],
        { timeout: Math.max(1, deadline - Date.now()), polling: 50 },
      )
    } catch (err) {
      // A reload/navigation mid-wait destroys the context: retry until the deadline.
      if (Date.now() >= deadline || !/context was destroyed|store gone|navigat|Execution context/i.test(String(err?.message))) throw err
      await page.waitForTimeout(200)
    }
  }
}

export async function waitPhase(page, kind, round, timeout = 90_000) {
  await waitStore(
    page,
    `(s, a) => !!s.room && s.room.phase.kind === a.kind && (a.round == null || s.room.phase.round === a.round)`,
    { kind, round },
    timeout,
  )
}

export async function shot(page, step) {
  const path = `${OUT}${RUN}-${step}-${page.__name}.png`
  await page.screenshot({ path }).catch(() => {})
  return path
}

// ---- lobby -----------------------------------------------------------------

export async function gotoHome(page) {
  await page.goto(BASE, { waitUntil: 'load' })
  await waitScreen(page, 'home')
}

export async function createRoom(host) {
  await host.getByRole('button', { name: 'Crea stanza', exact: true }).click()
  await waitScreen(host, 'lobby', 30_000)
  return host.evaluate(() => /#\/r\/([A-Z]{5})/.exec(location.hash)?.[1] ?? null)
}

/** Types the code on Home and taps/clicks Entra. */
export async function joinByCode(page, code, { touch } = {}) {
  const box = page.getByRole('textbox', { name: 'Codice stanza: lettera 1 di 5' })
  if (touch) await box.tap()
  else await box.click()
  await page.keyboard.type(code.toLowerCase(), { delay: 30 })
  await page.waitForTimeout(200)
  const btn = page.getByRole('button', { name: /^Entra/ })
  if (touch) await btn.tap()
  else await btn.click()
}

export async function pickPlaylist(host, query) {
  const search = host.getByRole('searchbox', { name: 'Cerca playlist' })
  await search.click()
  await search.fill(query)
  const first = host.locator('section[aria-label="Scegli la playlist"] ul:not([aria-hidden]) li button[aria-pressed]').first()
  await first.waitFor({ state: 'visible', timeout: 20_000 })
  await host.waitForTimeout(500)
  const title = await first.getAttribute('title')
  await first.click()
  await host.waitForFunction(
    () => document.querySelector('section[aria-label="Scegli la playlist"] li button[aria-pressed="true"]') !== null,
    null,
    { timeout: 5000 },
  )
  return title
}

export async function setRadio(host, group, name) {
  const g = host.getByRole('radiogroup', { name: group }).first()
  await g.getByRole('radio', { name }).first().click()
}

export async function configure(host, { rounds, snippets, roundTime, finalTimer }) {
  if (rounds) await setRadio(host, 'Round', String(rounds))
  if (snippets) await setRadio(host, 'Spezzoni', new RegExp(`^${snippets}`))
  if (roundTime) await setRadio(host, 'Tempo per round', `${roundTime}s`)
  if (finalTimer) await setRadio(host, 'Timer finale', `${finalTimer}s`)
  await host.waitForTimeout(400)
}

export async function startGame(host) {
  await host.getByRole('button', { name: /Inizia partita/ }).first().click()
}

// ---- board -------------------------------------------------------------------

const PLAY = '[data-screen-frame]:not([inert]) [data-round-view="playing"]'

export async function boardOrder(page) {
  return page.$$eval(`${PLAY} .sb-item`, (els) =>
    els
      .map((e) => ({ pos: Number(e.getAttribute('data-pos')), seg: Number(e.getAttribute('data-seg')) }))
      .sort((a, b) => a.pos - b.pos)
      .map((e) => e.seg),
  )
}

export async function waitBoard(page, timeout = 15_000) {
  await page.locator(`${PLAY} .sb-item`).first().waitFor({ timeout })
}

async function center(page, pos) {
  const box = await page.locator(`${PLAY} .sb-item[data-pos="${pos}"]`).boundingBox()
  if (!box) throw new Error(`no block at pos ${pos}`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

export async function touchDrag(page, from, to, { steps = 14, settle = 420 } = {}) {
  const cdp = await page.context().newCDPSession(page)
  const a = await center(page, from)
  const b = await center(page, to)
  const pt = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(a.x, a.y) })
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: pt(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps),
    })
    await page.waitForTimeout(16)
  }
  await page.waitForTimeout(100)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  if (settle) await page.waitForTimeout(settle)
  await cdp.detach()
}

export async function mouseDrag(page, from, to, { steps = 12, settle = 420 } = {}) {
  const a = await center(page, from)
  const b = await center(page, to)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps)
    await page.waitForTimeout(16)
  }
  await page.waitForTimeout(100)
  await page.mouse.up()
  if (settle) await page.waitForTimeout(settle)
}

export const isTouch = (page) => page.__touch === true
export async function drag(page, from, to, opts) {
  return isTouch(page) ? touchDrag(page, from, to, opts) : mouseDrag(page, from, to, opts)
}

/**
 * Drags the block holding segment `seg` to position `seg` (fixes that snippet).
 * Returns the new board order.
 */
export async function placeCorrect(page, seg, opts) {
  const order = await boardOrder(page)
  const from = order.indexOf(seg)
  if (from === seg) return order
  await drag(page, from, seg, opts)
  return boardOrder(page)
}

export async function confirm(page) {
  const btn = page.getByRole('button', { name: /^Conferma/ }).first()
  if (isTouch(page)) await btn.tap()
  else await btn.click()
  // An untouched board only arms CONFERMA ("Non hai spostato nulla"): the second press submits.
  const armed = page.locator('[data-screen-frame]:not([inert]) button[data-armed]').first()
  const isArmed = await armed.waitFor({ state: 'visible', timeout: 400 }).then(() => true, () => false)
  if (isArmed) {
    if (isTouch(page)) await armed.tap()
    else await armed.click()
  }
}

// ---- scoring (independent re-implementation of the documented formula) -----

export function score(order, n) {
  let correct = 0
  let pairs = 0
  for (let p = 0; p < n; p++) {
    if (order[p] === p) correct++
    if (p < n - 1 && order[p + 1] === order[p] + 1) pairs++
  }
  const perfect = correct === n
  // POSITION_WEIGHT 0.5: exact positions and correct pairs are worth half the round each.
  const points = perfect ? 5000 : Math.round((correct / n) * 2500 + (n > 1 ? (pairs / (n - 1)) * 2500 : 0))
  return { correct, pairs, points, perfect }
}

export function arrayMove(arr, from, to) {
  const a = arr.slice()
  const [x] = a.splice(from, 1)
  a.splice(to, 0, x)
  return a
}

export async function displayedTimer(page) {
  return page.evaluate(() => {
    const el = [...document.querySelectorAll('[data-screen-frame]:not([inert]) [role="timer"]')].find((e) => e.getBoundingClientRect().width > 0)
    const label = el?.getAttribute('aria-label') ?? null
    const n = label ? Number(/(\d+)/.exec(label)?.[1]) : null
    return { secs: n, at: Date.now() }
  })
}

/** Install a per-page recorder of phase transitions / first-submit arrival (local wall-clock). */
export async function installRecorder(page) {
  await page.evaluate(async () => {
    if (window.__qaRec) return
    const m = await import('/src/game/store.ts')
    const c = await import('/src/game/clock.ts')
    const rec = { phases: [], firstSubmit: {}, maxToasts: 0 }
    window.__qaRec = rec
    let last = ''
    m.useGame.subscribe((s) => {
      const ph = s.room?.phase
      const key = ph ? `${ph.kind}:${'round' in ph ? ph.round : ''}` : 'none'
      if (key !== last) {
        last = key
        rec.phases.push({ key, at: Date.now(), hostNow: c.hostNow(), endsAt: ph?.endsAt ?? null })
      }
      if (ph?.kind === 'playing' && ph.firstSubmit && !rec.firstSubmit[ph.round]) {
        rec.firstSubmit[ph.round] = { at: Date.now(), hostNow: c.hostNow(), endsAt: ph.endsAt, fsAt: ph.firstSubmit.at, by: ph.firstSubmit.playerId }
      }
      rec.maxToasts = Math.max(rec.maxToasts, s.toasts.length)
    })
  })
}
export async function rec(page) {
  return page.evaluate(() => window.__qaRec ?? null)
}

export function summary(extra = '') {
  console.log('\n==== RESULTS ====')
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`)
  console.log('\n==== console errors/warnings ====')
  const dedup = new Map()
  for (const l of consoleLines) dedup.set(l, (dedup.get(l) ?? 0) + 1)
  for (const [l, n] of dedup) console.log(`${n > 1 ? `(x${n}) ` : ''}${l}`)
  if (problems.length) console.log('\n==== problems ====\n' + problems.join('\n'))
  if (extra) console.log(extra)
  const file = new URL(`./${RUN}-results.json`, import.meta.url).pathname
  try {
    appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), results, consoleLines: [...dedup.entries()], problems }, null, 1) + '\n')
  } catch {
    /* ignore */
  }
}
