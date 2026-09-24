// End-to-end smoke test: a REAL game between two browsers over the public
// PeerJS cloud, driven only through the UI (no store pokes).
//
//   host  : desktop 1440×900        — creates the room, picks a playlist via search,
//                                     sets 3 rounds / 6 snippets, starts, plays.
//   guest : phone 390×844 @2x touch  — joins by typing the code on Home, drags with
//                                     touch, confirms first.
//
// Usage: node scripts/e2e/smoke.mjs [baseUrl] (default http://127.0.0.1:5220/)
//   env QUERY='hits 2000'  playlist search · env HEADFUL=1 to watch
// Screenshots: scripts/e2e/shots/<run>-<step>-<who>.png
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://127.0.0.1:5220/'
const QUERY = process.env.QUERY ?? 'hits 2000'
const OUT = new URL('./shots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const RUN = process.env.RUN ?? 'smoke'
const ROUNDS = 3
/** CHAOS=1: also reload both tabs at once in the middle of round 2. */
const CHAOS = !!process.env.CHAOS
const T0 = Date.now()

const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1).padStart(6)}s]`, ...a)
const problems = []
const consoleLines = []

const browser = await chromium.launch({
  channel: 'chrome',
  headless: !process.env.HEADFUL,
  args: ['--autoplay-policy=no-user-gesture-required'],
})

async function openPlayer(name, opts) {
  const ctx = await browser.newContext(opts)
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('unshuffle:onboarded', String(Date.now()))
    } catch {
      /* ignore */
    }
  })
  const page = await ctx.newPage()
  // The host's in-game "leave?" guard: accept it when the test reloads on purpose.
  page.on('dialog', (d) => void d.accept().catch(() => {}))
  page.on('console', (m) => {
    const t = m.type()
    if (t !== 'error' && t !== 'warning') return
    const text = m.text()
    consoleLines.push(`[${name}] ${t}: ${text.slice(0, 400)}`)
    if (t === 'error') problems.push(`[${name}] console.error: ${text.slice(0, 400)}`)
  })
  page.on('pageerror', (e) => problems.push(`[${name}] pageerror: ${e.message}`))
  page.on('requestfailed', (r) => {
    const u = r.url()
    // Deezer JSONP callbacks and cancelled media range requests are noisy but harmless.
    if (/dzcdn|deezer\.com|peerjs/.test(u) && r.failure()?.errorText === 'net::ERR_ABORTED') return
    consoleLines.push(`[${name}] requestfailed ${u.slice(0, 160)} ${r.failure()?.errorText}`)
  })
  return page
}

const host = await openPlayer('host', { viewport: { width: 1440, height: 900 } })
const guest = await openPlayer('guest', {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
})

let shotN = 0
async function shot(step) {
  shotN++
  const tag = `${RUN}-${String(shotN).padStart(2, '0')}-${step}`
  await Promise.all([
    host.screenshot({ path: `${OUT}${tag}-host.png` }),
    guest.screenshot({ path: `${OUT}${tag}-guest.png` }),
  ])
  log('📸', tag)
}

const frame = (page, screen) => page.locator(`[data-screen-frame][data-screen="${screen}"]:not([inert])`)
async function waitScreen(page, screen, timeout = 30_000) {
  await frame(page, screen).waitFor({ state: 'visible', timeout })
}
async function roundView(page) {
  return page.evaluate(() => {
    const el = document.querySelector('[data-screen-frame]:not([inert]) [data-phase]')
    return el ? el.getAttribute('data-phase') : null
  })
}
async function waitPhase(page, kind, timeout = 90_000) {
  await page.waitForFunction(
    (k) => document.querySelector(`[data-screen-frame]:not([inert]) [data-phase="${k}"]`) !== null,
    kind,
    { timeout, polling: 100 },
  )
}
function check(cond, msg) {
  if (!cond) {
    problems.push(`CHECK FAILED: ${msg}`)
    log('❌', msg)
  } else log('✅', msg)
}

async function boardOrder(page) {
  return page.$$eval('[data-screen-frame]:not([inert]) [data-round-view="playing"] .sb-item', (els) =>
    els
      .map((e) => ({ pos: Number(e.getAttribute('data-pos')), seg: Number(e.getAttribute('data-seg')) }))
      .sort((a, b) => a.pos - b.pos)
      .map((e) => e.seg),
  )
}
async function center(page, pos) {
  const box = await page
    .locator(`[data-screen-frame]:not([inert]) [data-round-view="playing"] .sb-item[data-pos="${pos}"]`)
    .boundingBox()
  if (!box) throw new Error(`no block at pos ${pos}`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}
async function touchDrag(page, from, to, steps = 16) {
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
  await page.waitForTimeout(120)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(450)
  await cdp.detach()
}
async function mouseDrag(page, from, to, steps = 14) {
  const a = await center(page, from)
  const b = await center(page, to)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps)
    await page.waitForTimeout(16)
  }
  await page.waitForTimeout(120)
  await page.mouse.up()
  await page.waitForTimeout(450)
}
function arrayMove(arr, from, to) {
  const a = arr.slice()
  const [x] = a.splice(from, 1)
  a.splice(to, 0, x)
  return a
}

let exitCode = 0
try {
  // ------------------------------------------------------------ home
  await Promise.all([host.goto(BASE, { waitUntil: 'load' }), guest.goto(BASE, { waitUntil: 'load' })])
  await Promise.all([waitScreen(host, 'home'), waitScreen(guest, 'home')])
  await host.waitForTimeout(1200)
  await shot('home')

  // ------------------------------------------------------------ host creates
  await host.getByRole('button', { name: 'Crea stanza', exact: true }).click()
  await waitScreen(host, 'lobby', 30_000)
  const code = await host.evaluate(() => /#\/r\/([A-Z]{5})/.exec(location.hash)?.[1] ?? null)
  check(!!code, `host created a room (${code})`)
  log('room code', code)

  // ------------------------------------------------------------ guest joins by typing
  const firstBox = guest.getByRole('textbox', { name: 'Codice stanza: lettera 1 di 5' })
  await firstBox.tap()
  await guest.keyboard.type(code.toLowerCase(), { delay: 60 })
  await guest.waitForTimeout(250)
  await guest.getByRole('button', { name: /^Entra/ }).tap()
  await waitScreen(guest, 'lobby', 30_000)
  check(true, 'guest joined the lobby by typing the code')
  await host.waitForTimeout(900)
  await shot('lobby-joined')

  // ------------------------------------------------------------ playlist via search
  const search = host.getByRole('searchbox', { name: 'Cerca playlist' })
  await search.click()
  await search.fill(QUERY)
  const firstResult = host.locator('section[aria-label="Scegli la playlist"] ul:not([aria-hidden]) li button[aria-pressed]').first()
  await firstResult.waitFor({ state: 'visible', timeout: 20_000 })
  await host.waitForTimeout(600)
  const plTitle = await firstResult.getAttribute('title')
  await firstResult.click()
  log('playlist picked:', plTitle)
  await host.waitForFunction(() => document.querySelector('section[aria-label="Scegli la playlist"] li button[aria-pressed="true"]') !== null, null, { timeout: 5000 })

  // ------------------------------------------------------------ settings
  const setRadio = async (group, name) => {
    const g = host.getByRole('radiogroup', { name: group }).first()
    await g.getByRole('radio', { name }).first().click()
  }
  await setRadio('Round', '3')
  await setRadio('Spezzoni', /^6/)
  await setRadio('Timer finale', '10s')
  await host.waitForTimeout(700)
  // Guest sees the host's settings (read-only) and the playlist.
  const guestSettings = await guest.evaluate(() => {
    const read = (label) => {
      const g = [...document.querySelectorAll('[role="radiogroup"]')].find((e) => e.getAttribute('aria-label') === label)
      const r = g?.querySelector('[role="radio"][aria-checked="true"]')
      return r?.textContent?.trim() ?? null
    }
    return { rounds: read('Round'), snippets: read('Spezzoni'), final: read('Timer finale') }
  })
  log('guest sees settings', guestSettings)
  check(guestSettings.rounds === '3' && (guestSettings.snippets ?? '').startsWith('6'), 'guest sees rounds=3 / snippets=6')
  await shot('lobby-configured')

  // ------------------------------------------------------------ start
  const startBtn = host.getByRole('button', { name: /Inizia partita/ }).first()
  await startBtn.click()
  log('start pressed')
  await Promise.all([waitScreen(host, 'round', 30_000), waitScreen(guest, 'round', 30_000)])
  await host.waitForTimeout(700)
  await shot('r1-preparing')

  for (let r = 0; r < ROUNDS; r++) {
    const R = `r${r + 1}`
    // ---------------------------------------------------------- intro → playing
    try {
      await Promise.all([waitPhase(host, 'intro', 60_000), waitPhase(guest, 'intro', 60_000)])
      await host.waitForTimeout(900)
      await shot(`${R}-intro`)
    } catch {
      log('(intro not captured)')
    }
    await Promise.all([waitPhase(host, 'playing', 60_000), waitPhase(guest, 'playing', 60_000)])
    await Promise.all([
      host.locator('[data-round-view="playing"] .sb-item').first().waitFor({ timeout: 10_000 }),
      guest.locator('[data-round-view="playing"] .sb-item').first().waitFor({ timeout: 10_000 }),
    ])
    await host.waitForTimeout(1800) // "VIA!" burst clears
    const n = (await boardOrder(guest)).length
    check(n === 6, `${R}: guest board has 6 snippets (got ${n})`)
    const wf = await guest.evaluate(() =>
      [...document.querySelectorAll('[data-round-view="playing"] .sb-item canvas')].filter((c) => c.width > 0 && c.height > 0).length,
    )
    check(wf >= 6, `${R}: guest waveforms rendered (${wf} canvases)`)
    if (r === 0) {
      const sound = (p) =>
        p.evaluate(
          () =>
            [...document.querySelectorAll('button[aria-haspopup="dialog"]')].filter((b) => /^Audio/.test(b.getAttribute('aria-label') ?? '')).filter((b) => {
              const r = b.getBoundingClientRect()
              return r.width > 0 && r.height > 0 && !b.closest('[inert]') && getComputedStyle(b).visibility !== 'hidden'
            }).length,
        )
      const [sg, sh] = [await sound(guest), await sound(host)]
      check(sg === 1 && sh === 1, `exactly one visible sound control on each player while playing (guest ${sg}, host ${sh})`)
      const overflow = await guest.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      check(overflow <= 0, `guest has no horizontal overflow while playing (${overflow}px)`)
    }
    await shot(`${R}-playing`)

    // ---------------------------------------------------------- guest drags (touch)
    const before = await boardOrder(guest)
    await touchDrag(guest, 0, 3)
    const mid = await boardOrder(guest)
    check(JSON.stringify(mid) === JSON.stringify(arrayMove(before, 0, 3)), `${R}: guest touch-drag 0→3 reordered (${before} → ${mid})`)
    await touchDrag(guest, 5, 1)
    const after = await boardOrder(guest)
    check(JSON.stringify(after) === JSON.stringify(arrayMove(mid, 5, 1)), `${R}: guest touch-drag 5→1 reordered (${mid} → ${after})`)

    if (CHAOS && r === 1) {
      // Both tabs reload at once mid-round: the host restores its snapshot and
      // reclaims the code, the guest resumes and gets its arrangement back.
      await guest.waitForTimeout(600) // let the debounced arrangement reach the host
      log('🔄 reloading both tabs mid-round')
      await Promise.all([host.reload(), guest.reload()])
      await Promise.all([waitPhase(host, 'playing', 30_000), waitPhase(guest, 'playing', 30_000)])
      await guest.locator('[data-round-view="playing"] .sb-item').first().waitFor({ timeout: 10_000 })
      await host.waitForTimeout(1500)
      const restored = await boardOrder(guest)
      check(JSON.stringify(restored) === JSON.stringify(after), `${R}: after a double reload the guest is back in the round with its order (${restored})`)
      await shot(`${R}-after-reload`)
    }

    // ---------------------------------------------------------- host play-all
    await host.getByRole('button', { name: 'Ascolta tutti gli spezzoni in ordine' }).click()
    const lit = await host
      .waitForFunction(() => document.querySelector('[data-round-view="playing"] .sb-block[data-playing]') !== null, null, { timeout: 6000 })
      .then(() => true)
      .catch(() => false)
    check(lit, `${R}: host play-all lights a block`)
    await host.waitForTimeout(900)
    await shot(`${R}-dragged-playall`)
    // host also rearranges (mouse) in later rounds
    if (r > 0) {
      await mouseDrag(host, 0, 2)
    }

    // ---------------------------------------------------------- guest confirms first
    await guest.getByRole('button', { name: /^Conferma/ }).first().tap()
    const banner = await host
      .getByText(/ha confermato!/)
      .first()
      .waitFor({ timeout: 6000 })
      .then(() => true)
      .catch(() => false)
    check(banner, `${R}: host sees the final-timer banner`)
    const dupToast = await host.getByText('Ultimi 10 secondi per tutti!').count()
    check(dupToast === 0, `${R}: no duplicate first-submit toast over the round HUD`)
    await host.waitForTimeout(500)
    await shot(`${R}-guest-confirmed`)

    if (r === 0) {
      // Round 1: the host lets the final timer run out (timed-out scoring).
      log('waiting for the final timer…')
    } else {
      await host.getByRole('button', { name: /^Conferma/ }).first().click()
    }

    // ---------------------------------------------------------- reveal
    await Promise.all([waitPhase(host, 'reveal', 40_000), waitPhase(guest, 'reveal', 40_000)])
    await host.waitForTimeout(1800)
    await shot(`${R}-reveal-mid`)
    await Promise.all([
      host.waitForSelector('.rv-root[data-stage="done"]', { timeout: 20_000 }),
      guest.waitForSelector('.rv-root[data-stage="done"]', { timeout: 20_000 }),
    ])
    await host.waitForTimeout(600)
    await shot(`${R}-reveal-done`)
    // The original preview plays on both sides (the song card offers "Ferma la canzone").
    const songOn = async (p) => (await p.getByRole('button', { name: 'Ferma la canzone' }).count()) > 0
    const [hSong, gSong] = [await songOn(host), await songOn(guest)]
    check(hSong && gSong, `${R}: the revealed song is playing for both (host ${hSong}, guest ${gSong})`)
    // guest scrolled page: capture the leaderboard too
    await guest.evaluate(() => {
      const root = document.querySelector('[data-screen-frame]:not([inert]) .rv-root')
      const sc = root?.closest('.overflow-y-auto') ?? root?.parentElement
      if (sc) sc.scrollTo({ top: sc.scrollHeight })
    })
    await guest.waitForTimeout(500)
    await guest.screenshot({ path: `${OUT}${RUN}-${R}-reveal-guest-bottom.png` })

    const last = r === ROUNDS - 1
    await host.getByRole('button', { name: last ? /Classifica finale/ : /Prossimo round/ }).first().click()
    if (!last) {
      await Promise.all([
        host.waitForFunction(() => !document.querySelector('[data-phase="reveal"]'), null, { timeout: 15_000 }),
        guest.waitForFunction(() => !document.querySelector('[data-phase="reveal"]'), null, { timeout: 15_000 }),
      ])
    }
  }

  // ------------------------------------------------------------ final
  await Promise.all([waitScreen(host, 'final', 20_000), waitScreen(guest, 'final', 20_000)])
  await host.waitForTimeout(3200)
  await shot('final-podium')
  for (const p of [host, guest]) {
    await p.evaluate(() => {
      const f = document.querySelector('[data-screen-frame]:not([inert])')
      const sc = f?.querySelector('.overflow-y-auto') ?? f
      sc?.scrollTo({ top: sc.scrollHeight })
    })
  }
  await host.waitForTimeout(1200)
  await shot('final-bottom')

  await host.getByRole('button', { name: 'Rigioca' }).click()
  await Promise.all([waitScreen(host, 'lobby', 15_000), waitScreen(guest, 'lobby', 15_000)])
  await host.waitForTimeout(900)
  check(true, 'Rigioca → both back in the lobby')
  const players = await host.evaluate(() => document.title)
  log('host title after replay:', players)
  await shot('lobby-again')
} catch (err) {
  exitCode = 1
  problems.push(`FATAL: ${err?.stack ?? err}`)
  log('💥', err?.message ?? err)
  try {
    await shot('failure')
    log('host view:', await roundView(host), '| guest view:', await roundView(guest))
  } catch {
    /* ignore */
  }
} finally {
  await browser.close()
}

console.log('\n---- console warnings/errors (both pages) ----')
console.log(consoleLines.length ? consoleLines.join('\n') : '(none)')
console.log('\n---- problems ----')
console.log(problems.length ? problems.join('\n') : '(none)')
if (problems.length) exitCode = 1
console.log(`\nSMOKE ${exitCode === 0 ? 'PASS' : 'FAIL'} in ${((Date.now() - T0) / 1000).toFixed(1)}s`)
process.exit(exitCode)
