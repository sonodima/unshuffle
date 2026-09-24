// Interaction checks for the lobby lab (mock catalog). Usage: node scripts/lobby/interact.mjs <tag>
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const tag = process.argv[2] ?? 'i'
const BASE = 'http://127.0.0.1:5211/lab/lobby.html'
const OUT = new URL('./shots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' })
const errors = []
const results = []
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)

async function scenario(name, fn) {
  try {
    await fn()
  } catch (err) {
    results.push(`FAIL ${name} threw: ${String(err.message).split('\n')[0]}`)
  }
}

async function open(q, device = 'desk') {
  const phone = device === 'phone'
  const ctx = await browser.newContext({
    viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    deviceScaleFactor: phone ? 2 : 1,
    hasTouch: phone,
    isMobile: phone,
    permissions: ['clipboard-read', 'clipboard-write'],
  })
  const page = await ctx.newPage()
  page.on('console', (m) => {
    if (/LanguageModel|text session|AudioContext was not allowed/.test(m.text())) return
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${q}] ${m.type()}: ${m.text()}`)
  })
  page.on('pageerror', (e) => errors.push(`[${q}] pageerror: ${e.message}`))
  await page.goto(`${BASE}?${q}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  return { page, ctx }
}
const shot = (page, name) => page.screenshot({ path: `${OUT}${tag}-${name}.png` })

// ── Desktop host: search, chips, links, start ──────────────────────────────
await scenario("desk-host", async () => {
  const { page, ctx } = await open('role=host&pl=0&n=3')
  const search = page.getByRole('searchbox', { name: 'Cerca playlist' })
  await search.fill('rap italiano')
  await page.waitForTimeout(120)
  const busy = await page.locator('[aria-busy="true"]').count()
  check('search shows loading while debouncing', busy > 0)
  await page.waitForTimeout(1200)
  const cards = await page.locator('button[aria-pressed]').filter({ hasText: 'brani' }).count()
  check('search results rendered', cards >= 10, `${cards} cards`)
  await shot(page, 'desk-search')

  await page.locator('button[aria-pressed]').filter({ hasText: 'brani' }).first().click()
  await page.waitForTimeout(700)
  const startEnabled = await page.getByRole('button', { name: 'Inizia partita' }).isEnabled()
  check('selecting a card enables start', startEnabled)
  await shot(page, 'desk-selected')

  await search.fill('zzzqqq')
  await page.waitForTimeout(1300)
  check('empty state', (await page.getByText('Nessuna playlist per “zzzqqq”').count()) === 1)
  await shot(page, 'desk-empty')

  await search.fill('errore')
  await page.waitForTimeout(1300)
  check('error state with retry', (await page.getByRole('button', { name: 'Riprova' }).count()) === 1)
  await shot(page, 'desk-error')

  await search.fill('https://link.deezer.com/s/30abcXYZ')
  await page.waitForTimeout(300)
  check('short link hint', (await page.getByText('Incolla il link completo della playlist').count()) === 1)
  await shot(page, 'desk-shortlink')

  await search.fill('https://www.deezer.com/it/album/302127')
  await page.waitForTimeout(300)
  check('foreign link hint', (await page.getByText('Questo link non è una playlist').count()) === 1)

  await search.fill('https://www.deezer.com/it/playlist/1303152955?utm=x')
  await page.waitForTimeout(1200)
  const heroTitle = await page.locator('section[aria-label="Playlist scelta"] h2').textContent()
  check('pasted link auto-selects', /Rap Italiano/i.test(heroTitle ?? ''), heroTitle ?? '')
  await shot(page, 'desk-link')

  await search.fill('')
  await page.getByRole('button', { name: /Anni 80/ }).click()
  await page.waitForTimeout(1100)
  check('chip search', (await page.getByRole('heading', { name: /Anni 80/ }).count()) === 1)
  await shot(page, 'desk-chip')

  // Settings
  await page.getByRole('radiogroup', { name: 'Spezzoni' }).getByRole('radio', { name: /16/ }).click()
  await page.waitForTimeout(300)
  check('settings update', (await page.getByRole('radiogroup', { name: 'Spezzoni' }).getByRole('radio', { name: /16/ }).getAttribute('aria-checked')) === 'true')

  // Start
  await page.getByRole('button', { name: 'Inizia partita' }).click()
  await page.waitForTimeout(150)
  check('start shows loading', (await page.locator('button[aria-busy="true"]').count()) >= 1)
  await page.waitForTimeout(1400)
  check('start resolves', (await page.getByTestId('started').count()) === 1)
  await ctx.close()
})

// ── Desktop host: start failure, kick, leave, QR, profile ─────────────────
await scenario("desk-host-2", async () => {
  const { page, ctx } = await open('role=host&pl=1&n=5&fail=1')
  await page.getByRole('button', { name: 'Inizia partita' }).click()
  await page.waitForTimeout(1600)
  check('start failure message', (await page.getByRole('alert').filter({ hasText: 'non ha abbastanza brani' }).count()) === 1)
  await shot(page, 'desk-startfail')

  await page.getByRole('button', { name: 'Rimuovi Giulia' }).click()
  await page.waitForTimeout(500)
  await shot(page, 'desk-kick')
  await page.getByRole('dialog').getByRole('button', { name: 'Rimuovi' }).click()
  await page.waitForTimeout(700)
  check('kick removes player', (await page.getByText('Giulia', { exact: true }).count()) === 0)

  await page.getByRole('button', { name: 'Ingrandisci QR code' }).click()
  await page.waitForTimeout(500)
  await shot(page, 'desk-qr')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  await page.getByRole('button', { name: 'Copia link' }).first().click()
  await page.waitForTimeout(300)
  const clip = await page.evaluate(() => navigator.clipboard.readText())
  check('copy link writes clipboard', clip.endsWith('#/r/KXQPM'), clip)

  await page.getByRole('button', { name: 'Modifica profilo' }).click()
  await page.waitForTimeout(500)
  await shot(page, 'desk-profile')
  await page.getByRole('dialog').getByRole('textbox').fill('Tommaso')
  await page.getByRole('dialog').getByRole('button', { name: 'Salva' }).click()
  await page.waitForTimeout(500)
  check('profile edit', (await page.getByText('Tommaso', { exact: true }).count()) >= 1)

  await page.getByRole('button', { name: 'Chiudi stanza' }).first().click()
  await page.waitForTimeout(500)
  await shot(page, 'desk-leave')
  await ctx.close()
})

// ── Phone: tabs, invite, QR sheet ─────────────────────────────────────────
await scenario("phone-host", async () => {
  const { page, ctx } = await open('role=host&pl=0&n=2', 'phone')
  check('phone opens playlist tab for host without playlist', (await page.getByRole('tab', { name: /Playlist/ }).getAttribute('aria-selected')) === 'true')
  await page.locator('button[aria-pressed]').filter({ hasText: 'brani' }).nth(1).click()
  await page.waitForTimeout(900)
  await shot(page, 'phone-selected')
  await page.getByRole('tab', { name: /Giocatori/ }).click()
  await page.waitForTimeout(400)
  await shot(page, 'phone-players')
  await page.getByRole('button', { name: 'Invita' }).click()
  await page.waitForTimeout(500)
  await shot(page, 'phone-invite-toast')
  await page.getByRole('button', { name: 'Mostra QR code' }).click()
  await page.waitForTimeout(700)
  await shot(page, 'phone-qr')
  await ctx.close()
})

// ── Phone guest ────────────────────────────────────────────────────────────
await scenario("phone-guest", async () => {
  const { page, ctx } = await open('role=guest&pl=1&n=4&tab=playlist', 'phone')
  await shot(page, 'phone-guest-playlist')
  await page.getByRole('tab', { name: /Regole/ }).click()
  await page.waitForTimeout(300)
  const ro = await page.getByRole('radiogroup', { name: 'Round', exact: true }).getAttribute('aria-readonly')
  check('guest settings read-only', ro === 'true')
  check('guest has no start button', (await page.getByRole('button', { name: 'Inizia partita' }).count()) === 0)
  await ctx.close()
})

await browser.close()
console.log(results.join('\n'))
console.log(errors.length ? errors.join('\n') : 'no console errors')
