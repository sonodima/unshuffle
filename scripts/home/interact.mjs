// Home interaction checks (lab + connected screen). Usage: node scripts/home/interact.mjs
import { chromium } from 'playwright'
const BASE = 'http://127.0.0.1:5210/lab/home.html'
const OUT = new URL('./shots/', import.meta.url).pathname
const browser = await chromium.launch({ channel: 'chrome' })
const errors = []
const results = []
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`)

async function open(url, { phone = true, onboarded = true } = {}) {
  const ctx = await browser.newContext(
    phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } : { viewport: { width: 1440, height: 900 } },
  )
  if (onboarded) await ctx.addInitScript(() => localStorage.setItem('unshuffle:onboarded', '1'))
  const page = await ctx.newPage()
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`[${url}] ${m.text()}`))
  page.on('pageerror', (e) => errors.push(`[${url}] pageerror: ${e.message}`))
  await page.goto(url, { waitUntil: 'load' })
  await page.waitForTimeout(1200)
  return { ctx, page }
}

// 1 · typing a code moves focus to Entra, Enter joins, error comes back inline
{
  const { ctx, page } = await open(BASE)
  const boxes = page.getByRole('group', { name: 'Codice stanza' }).locator('input')
  await boxes.first().tap()
  await page.keyboard.type('kxqpa')
  const code = await boxes.evaluateAll((els) => els.map((e) => e.value).join(''))
  check('code typed uppercase', code === 'KXQPA', code)
  const active = await page.evaluate(() => document.activeElement?.textContent?.trim())
  check('focus moved to Entra', active === 'Entra', String(active))
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  check('join pending shows status', await page.getByText('Mi collego alla stanza…').isVisible())
  await page.waitForTimeout(1500)
  check('join error inline', await page.getByText('Stanza non trovata. Controlla il codice.').isVisible())
  await page.screenshot({ path: `${OUT}int-join-error.png` })
  await boxes.nth(4).tap()
  await page.keyboard.press('Backspace')
  await page.waitForTimeout(300)
  check('error clears on edit', !(await page.getByText('Stanza non trovata. Controlla il codice.').isVisible()))
  await page.getByRole('button', { name: 'Entra' }).tap()
  await page.waitForTimeout(300)
  check('incomplete code hint', await page.getByText('Inserisci tutte e 5 le lettere del codice.').isVisible())
  await ctx.close()
}

// 2 · profile: avatar sheet, name editing, random name
{
  const { ctx, page } = await open(BASE)
  await page.getByRole('button', { name: 'Cambia avatar e colore' }).tap()
  await page.waitForTimeout(600)
  check('avatar sheet open', await page.getByRole('dialog', { name: 'Il tuo look' }).isVisible())
  await page.getByRole('radio', { name: 'Avatar 🐙' }).tap()
  await page.getByRole('radio', { name: 'Colore 3' }).tap()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}int-avatar-sheet.png` })
  await page.getByRole('button', { name: 'Fatto' }).tap()
  await page.waitForTimeout(600)
  const avatarLabel = await page.getByRole('button', { name: 'Cambia avatar e colore' }).innerHTML()
  check('avatar updated', avatarLabel.includes('🐙'))
  const name = page.getByLabel('Il tuo nome')
  await name.fill('')
  await name.pressSequentially('  Tommaso   Di ')
  check('draft keeps spaces while typing', (await name.inputValue()) === '  Tommaso   Di ', JSON.stringify(await name.inputValue()))
  await name.press('Enter')
  await page.waitForTimeout(100)
  check('name sanitized on blur', (await name.inputValue()) === 'Tommaso Di', JSON.stringify(await name.inputValue()))
  await name.fill('')
  await page.getByRole('button', { name: 'Cambia avatar e colore' }).focus()
  check('empty name reverts', (await name.inputValue()) === 'Tommaso Di', JSON.stringify(await name.inputValue()))
  await page.getByRole('button', { name: 'Nome a caso' }).tap()
  const random = await name.inputValue()
  check('random name', random !== 'Tommaso Di' && random.length > 2, random)
  await ctx.close()
}

// 3 · help overlay
{
  const { ctx, page } = await open(BASE, { phone: false })
  await page.getByRole('button', { name: 'Come si gioca' }).click()
  await page.waitForTimeout(700)
  check('howto open', await page.getByRole('dialog', { name: 'Come si gioca' }).isVisible())
  await page.getByRole('button', { name: 'Ho capito, si gioca!' }).click()
  await page.waitForTimeout(500)
  check('howto closed', !(await page.getByRole('dialog', { name: 'Come si gioca' }).isVisible()))
  await ctx.close()
}

// 4 · connected: first visit opens HowToPlay once; invite link prefills + focuses Entra
{
  const { ctx, page } = await open(`${BASE}?connected=1`, { phone: false, onboarded: false })
  await page.waitForTimeout(1200)
  check('onboarding auto-opens', await page.getByRole('dialog', { name: 'Come si gioca' }).isVisible())
  check('onboarded flag stored', (await page.evaluate(() => localStorage.getItem('unshuffle:onboarded'))) != null)
  await page.keyboard.press('Escape')
  await page.reload({ waitUntil: 'load' })
  await page.waitForTimeout(2500)
  check('onboarding not repeated', !(await page.getByRole('dialog', { name: 'Come si gioca' }).isVisible()))
  await page.goto(`${BASE}?connected=1#/r/kxqpm`, { waitUntil: 'load' })
  await page.reload({ waitUntil: 'load' })
  await page.waitForTimeout(1200)
  const boxes = page.getByRole('group', { name: 'Codice stanza' }).locator('input')
  const code = await boxes.evaluateAll((els) => els.map((e) => e.value).join(''))
  check('invite prefills code', code === 'KXQPM', code)
  check('invite label', await page.getByText('Hai un invito!').isVisible())
  const active = await page.evaluate(() => document.activeElement?.textContent?.trim())
  check('invite focuses Entra (desktop)', active === 'Entra in KXQPM', String(active))
  await page.evaluate(() => (location.hash = '#/r/ABCDE'))
  await page.waitForTimeout(300)
  const code2 = await boxes.evaluateAll((els) => els.map((e) => e.value).join(''))
  check('hashchange prefills', code2 === 'ABCDE', code2)
  await page.screenshot({ path: `${OUT}int-connected-invite.png` })
  await ctx.close()
}

await browser.close()
console.log(results.join('\n'))
console.log(errors.length ? errors.join('\n') : 'no console errors')
