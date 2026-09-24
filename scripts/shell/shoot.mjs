// Shell lab screenshots + console checks. Usage: node scripts/shell/shoot.mjs [scenario…]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:5215'
const OUT = new URL('./shots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

const VIEWPORTS = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const SCENARIOS = {
  async toasts(page) {
    await page.evaluate(() => window.__shell.setFixture('lobby'))
    await wait(500)
    await page.evaluate(() => window.__shell.demoToasts())
    await wait(900)
  },
  async reactions(page) {
    await page.evaluate(() => window.__shell.setFixture('lobby'))
    await wait(400)
    await page.evaluate(() => window.__shell.reactions(10))
    await wait(1100)
  },
  async reconnecting(page) {
    await page.evaluate(() => window.__shell.setFixture('playing', 'p-2'))
    await wait(400)
    await page.evaluate(() => window.__shell.setConnection('reconnecting'))
    await wait(2600)
  },
  async hostwarn(page) {
    await page.evaluate(() => window.__shell.setFixture('playing'))
    await wait(400)
    await page.evaluate(() => window.__shell.setConnection('open', 'Connessione al server persa: i nuovi giocatori non possono entrare.'))
    await wait(700)
  },
  async lost(page) {
    await page.evaluate(() => window.__shell.setFixture('playing', 'p-2'))
    await wait(400)
    await page.evaluate(() => window.__shell.setConnection('closed', 'Connessione con l’host persa.'))
    await wait(800)
  },
  async kicked(page) {
    await page.evaluate(() => window.__shell.setFixture('lobby', 'p-2'))
    await wait(400)
    await page.evaluate(() => window.__shell.dropOut('kicked'))
    await wait(900)
  },
  async resume(page) {
    await page.evaluate(() => window.__shell.resume())
    await wait(900)
  },
  async crash(page) {
    await page.evaluate(() => window.__shell.setFixture('playing'))
    await wait(500)
    await page.evaluate(() => window.__shell.crash())
    await wait(700)
  },
  async sound(page) {
    await page.evaluate(() => window.__shell.setFixture('playing'))
    await wait(500)
    await page.getByRole('button', { name: /^Audio/ }).first().click()
    await wait(600)
  },
  async unlock(page) {
    await page.evaluate(() => window.__shell.setFixture('lobby', 'p-2'))
    await wait(800)
  },
}

const only = process.argv.slice(2)
const names = only.length ? only : Object.keys(SCENARIOS)

const browser = await chromium.launch({ channel: 'chrome' })
const errors = []
for (const [vp, opts] of Object.entries(VIEWPORTS)) {
  // Warm-up context: the first GPU frame of a run is sometimes blank.
  const warm = await browser.newContext(opts)
  await (await warm.newPage()).goto(`${BASE}/lab/shell.html?panel=0`, { waitUntil: 'networkidle' })
  await warm.close()
  for (const name of names) {
    const ctx = await browser.newContext(opts)
    const page = await ctx.newPage()
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`[${vp}/${name}] ${m.text()}`)
    })
    page.on('pageerror', (e) => errors.push(`[${vp}/${name}] pageerror ${e.message}`))
    await page.goto(`${BASE}/lab/shell.html?panel=0${process.env.REAL ? '&real=1' : ''}`, { waitUntil: 'networkidle' })
    await wait(600)
    await SCENARIOS[name](page)
    await page.screenshot({ path: `${OUT}${process.env.REAL ? 'real-' : ''}${name}-${vp}.png` })
    await ctx.close()
  }
}
await browser.close()
console.log(errors.length ? errors.join('\n') : 'no console errors')
