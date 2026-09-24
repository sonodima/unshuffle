// Real 2-browser check over the public PeerJS cloud (production snapshot):
// the host closes its tab in the lobby → the guest gets ONE dialog with lobby copy
// (no score promise); "Riprova" fails → the same dialog explains the room is gone.
// Usage: node scripts/fix-shell/hostgone.mjs [baseUrl]  (default http://127.0.0.1:5456/)
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://127.0.0.1:5456/'
const OUT = new URL('./shots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const T0 = Date.now()
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1).padStart(6)}s]`, ...a)
const problems = []
const check = (ok, msg) => {
  log(ok ? 'OK  ' : 'FAIL', msg)
  if (!ok) problems.push(msg)
}

const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
async function open(name, opts) {
  const ctx = await browser.newContext(opts)
  await ctx.addInitScript(() => localStorage.setItem('unshuffle:onboarded', String(Date.now())))
  const page = await ctx.newPage()
  page.on('dialog', (d) => void d.accept().catch(() => {}))
  page.on('pageerror', (e) => problems.push(`[${name}] pageerror ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') log(`[${name}] console.error`, m.text().slice(0, 200))
  })
  return { ctx, page }
}

const host = await open('host', { viewport: { width: 1280, height: 800 } })
const guest = await open('guest', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const frame = (page, screen) => page.locator(`[data-screen-frame][data-screen="${screen}"]:not([inert])`)

try {
  await Promise.all([host.page.goto(BASE), guest.page.goto(BASE)])
  await host.page.getByRole('button', { name: 'Crea stanza', exact: true }).click()
  await frame(host.page, 'lobby').waitFor({ timeout: 30_000 })
  const code = await host.page.evaluate(() => /#\/r\/([A-Z]{5})/.exec(location.hash)?.[1] ?? null)
  log('room', code)
  await guest.page.getByRole('textbox', { name: 'Codice stanza: lettera 1 di 5' }).tap()
  await guest.page.keyboard.type(code.toLowerCase(), { delay: 50 })
  await guest.page.getByRole('button', { name: /^Entra/ }).tap()
  await frame(guest.page, 'lobby').waitFor({ timeout: 30_000 })
  log('guest in lobby')
  await guest.page.waitForTimeout(1500)

  // Host tab goes away for good (no goodbye).
  await host.ctx.close()
  log('host closed')

  const dialog = guest.page.locator('[role="dialog"]')
  let bannerSeen = false
  const t = Date.now()
  while (Date.now() - t < 180_000) {
    if (!bannerSeen && (await guest.page.getByText(/Connessione persa|Riconnessione/).count())) {
      bannerSeen = true
      log('reconnect banner visible')
      await guest.page.screenshot({ path: `${OUT}e2e-lobby-banner.png` })
    }
    if (await dialog.count()) break
    await guest.page.waitForTimeout(500)
  }
  await guest.page.waitForTimeout(700)
  const texts = await dialog.allTextContents()
  log('dialog after', ((Date.now() - t) / 1000).toFixed(1), 's')
  await guest.page.screenshot({ path: `${OUT}e2e-lobby-lost.png` })
  check(texts.length === 1, `one dialog (${texts.length})`)
  check(/forse ha chiuso la stanza/.test(texts[0] ?? '') && !/punteggio/.test(texts[0] ?? ''), `lobby copy: ${texts[0]}`)

  await guest.page.getByRole('button', { name: 'Riprova' }).tap()
  log('Riprova')
  // The store keeps retrying "room not found" briefly; wait for the answer.
  const t2 = Date.now()
  let during = 0
  while (Date.now() - t2 < 40_000) {
    during = Math.max(during, await dialog.count())
    const txt = (await dialog.allTextContents()).join(' ')
    if (/Stanza non più disponibile|Impossibile rientrare/.test(txt)) break
    await guest.page.waitForTimeout(300)
  }
  await guest.page.waitForTimeout(800)
  const after = await dialog.allTextContents()
  await guest.page.screenshot({ path: `${OUT}e2e-lobby-retry-failed.png` })
  log('answer after', ((Date.now() - t2) / 1000).toFixed(1), 's')
  check(during <= 1 && after.length === 1, `never two dialogs (max during ${during}, after ${after.length})`)
  check(/Stanza non più disponibile/.test(after[0] ?? '') && !/Controlla il codice/.test(after[0] ?? '') && !/Riprova/.test(after[0] ?? ''), `failure copy: ${after[0]}`)

  await guest.page.getByRole('button', { name: 'Torna alla home' }).tap()
  await guest.page.waitForTimeout(900)
  check((await dialog.count()) === 0, 'home closes the dialog')
  check(await frame(guest.page, 'home').isVisible(), 'guest on home')
} catch (err) {
  problems.push(String(err?.stack ?? err))
  await guest.page.screenshot({ path: `${OUT}e2e-error.png` }).catch(() => {})
} finally {
  await browser.close()
}
log(problems.length ? `PROBLEMS:\n  ${problems.join('\n  ')}` : 'ALL OK')
process.exit(problems.length ? 1 : 0)
