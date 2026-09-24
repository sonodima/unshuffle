// QA "code": what happens to a guest when the HOST tab is frozen (a phone host
// switching to WhatsApp to share the link: iOS/Android suspend the page's JS).
// Headless Chrome ignores Page.setWebLifecycleState('frozen') for visible pages
// (see freeze-probe.mjs), so the host's main thread is stopped with CDP
// Debugger.pause (no timers, no message handlers run) and later resumed.
//
// Usage: node scripts/qa-code/freeze-host.mjs [baseUrl]   (default http://127.0.0.1:5305/)
//   env FREEZE_S=50 (seconds the host stays frozen)
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://127.0.0.1:5305/'
const FREEZE_S = Number(process.env.FREEZE_S ?? 50)
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
    } catch {
      /* ignore */
    }
  })
  const page = await ctx.newPage()
  page.on('dialog', (d) => void d.accept().catch(() => {}))
  return page
}
const host = await open({ viewport: { width: 1280, height: 800 } })
const guest = await open({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const frame = (page, screen) => page.locator(`[data-screen-frame][data-screen="${screen}"]:not([inert])`)

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
  await host.waitForTimeout(1500)
  const hostCountBefore = await host.evaluate(() => document.body.innerText.match(/\b(\d+)\s*\/\s*10\b/)?.[0] ?? null)
  log('lobby ok; host player counter', hostCountBefore)

  const cdp = await host.context().newCDPSession(host)
  await cdp.send('Debugger.enable')
  await cdp.send('Debugger.pause')
  const frozenAt = Date.now()
  log(`host frozen for ${FREEZE_S}s`)
  const seen = {}
  for (let i = 0; i < FREEZE_S; i++) {
    await guest.waitForTimeout(1000)
    const text = await guest.evaluate(() => document.body.innerText)
    const t = Math.round((Date.now() - frozenAt) / 1000)
    if (/Connessione persa, riprovo/.test(text) && seen.banner == null) {
      seen.banner = t
      log(`guest: reconnect banner after ${t}s`)
      await guest.screenshot({ path: `${OUT}freeze-banner-guest.png` })
    }
    if (/Il tuo punteggio è al sicuro|Torna alla home/.test(text) && seen.modal == null) {
      seen.modal = t
      log(`guest: blocking "Connessione persa" dialog after ${t}s`)
      await guest.screenshot({ path: `${OUT}freeze-lost-guest.png` })
    }
  }
  await cdp.send('Debugger.resume')
  await cdp.send('Debugger.disable')
  log('host unfrozen')
  await host.waitForTimeout(2000)
  await host.screenshot({ path: `${OUT}freeze-after-2s-host.png` })
  await host.waitForTimeout(18_000)
  const guestText = await guest.evaluate(() => document.body.innerText)
  const guestScreen = await guest.evaluate(() => document.querySelector('[data-screen-frame]:not([inert])')?.getAttribute('data-screen'))
  const hostCountAfter = await host.evaluate(() => document.body.innerText.match(/\b(\d+)\s*\/\s*10\b/)?.[0] ?? null)
  log('20s after unfreeze: guest screen =', guestScreen, '| guest still shows lost dialog =', /Torna alla home/.test(guestText), '| host counter =', hostCountAfter)
  await host.screenshot({ path: `${OUT}freeze-after-20s-host.png` })
  await guest.screenshot({ path: `${OUT}freeze-after-20s-guest.png` })
  console.log(JSON.stringify({ code, freezeS: FREEZE_S, bannerAfterS: seen.banner ?? null, lostDialogAfterS: seen.modal ?? null, hostCountBefore, hostCountAfter }))
} finally {
  await browser.close()
}
