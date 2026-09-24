// Interaction checks on the fix-round lab: untouched-board confirm guard, keyboard
// shortcuts, exit menu, spectator card. Usage: node scripts/fix-round/interact.mjs
import { chromium } from 'playwright'

const BASE = process.env.BASE ?? 'http://localhost:5401/lab/fix-round.html'
const OUT = new URL('./shots/', import.meta.url).pathname
let failures = 0
const check = (label, ok, extra = '') => {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`)
}

const browser = await chromium.launch({ channel: 'chrome' })

async function open(qs, device = { viewport: { width: 1440, height: 900 } }) {
  const ctx = await browser.newContext(device)
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(`${BASE}?ui=0&bg=css&engine=mock&${qs}`)
  await page.waitForFunction(() => window.__round)
  await page.waitForTimeout(900)
  return { ctx, page, errors }
}
const submittedAt = (page) => page.evaluate(() => window.__round.submittedAt())
const events = (page) => page.evaluate(() => [...window.__round.events])
const confirmBtn = (page) => page.locator('footer button[aria-keyshortcuts]')

// 1) Untouched board: the first click arms, the second submits.
{
  const { ctx, page, errors } = await open('s=playing')
  await confirmBtn(page).click()
  await page.waitForTimeout(250)
  check('untouched: first click does not submit', (await submittedAt(page)) === null)
  const armedText = await confirmBtn(page).innerText()
  check('untouched: button asks again', /spostato nulla/i.test(armedText), JSON.stringify(armedText))
  await page.screenshot({ path: `${OUT}i-desktop-armed.png` })
  await confirmBtn(page).click()
  await page.waitForTimeout(250)
  check('untouched: second click submits', (await submittedAt(page)) !== null)
  check('no console errors', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

// 2) Armed state expires.
{
  const { ctx, page } = await open('s=playing')
  await confirmBtn(page).click()
  await page.waitForTimeout(2900)
  const txt = await confirmBtn(page).innerText()
  check('armed state expires after ~2.6 s', /conferma/i.test(txt) && !/spostato/i.test(txt), JSON.stringify(txt))
  await confirmBtn(page).click()
  await page.waitForTimeout(250)
  check('after expiry the first click arms again', (await submittedAt(page)) === null)
  await ctx.close()
}

// 3) A moved board submits on the first click.
{
  const { ctx, page } = await open('s=playing')
  const blocks = page.locator('[data-snippet-block]')
  const a = await blocks.nth(0).boundingBox()
  const b = await blocks.nth(2).boundingBox()
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 12; i++) await page.mouse.move(a.x + a.width / 2 + ((b.x - a.x) * i) / 12, a.y + a.height / 2 + ((b.y - a.y) * i) / 12)
  await page.mouse.up()
  await page.waitForTimeout(500)
  await confirmBtn(page).click()
  await page.waitForTimeout(250)
  check('moved board: first click submits', (await submittedAt(page)) !== null)
  await ctx.close()
}

// 4) Keyboard: plain Enter after clicking a block never submits; Ctrl+Enter arms then submits.
{
  const { ctx, page } = await open('s=playing')
  await page.locator('[data-snippet-block]').nth(1).click()
  await page.waitForTimeout(200)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)
  check('click block + Enter: no submit', (await submittedAt(page)) === null)
  await page.mouse.click(5, 450)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)
  check('Enter with nothing focused: no submit', (await submittedAt(page)) === null)
  await page.keyboard.press('Control+Enter')
  await page.waitForTimeout(300)
  check('Ctrl+Enter on untouched board: arms only', (await submittedAt(page)) === null && /premi di nuovo/i.test(await confirmBtn(page).innerText()))
  await page.keyboard.press('Control+Enter')
  await page.waitForTimeout(300)
  check('second Ctrl+Enter submits', (await submittedAt(page)) !== null)
  await ctx.close()
}

// 5) Guest exit menu.
{
  const { ctx, page } = await open('s=playing&me=p-3')
  await page.getByRole('button', { name: 'Esci dalla partita' }).first().click()
  await page.waitForTimeout(500)
  const dialog = page.getByRole('dialog')
  check('guest: menu opens', await dialog.isVisible())
  check('guest: title', /uscire dalla partita/i.test(await dialog.innerText()))
  await page.keyboard.press('Control+Enter')
  await page.waitForTimeout(250)
  check('menu open: Ctrl+Enter does nothing', (await submittedAt(page)) === null && !/spostato/i.test(await confirmBtn(page).innerText()))
  await page.screenshot({ path: `${OUT}i-desktop-menu-guest.png` })
  await dialog.getByRole('button', { name: 'Esci dalla partita' }).click()
  await page.waitForTimeout(400)
  check('guest: leave called once', JSON.stringify(await events(page)) === '["leave"]', JSON.stringify(await events(page)))
  await ctx.close()
}

// 6) Host menu: back to lobby / close room; Esc closes.
{
  const { ctx, page } = await open('s=playing')
  const trigger = page.getByRole('button', { name: 'Termina partita' }).first()
  await trigger.click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}i-desktop-menu-host.png` })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  check('host: Esc closes', !(await page.getByRole('dialog').isVisible().catch(() => false)))
  await trigger.click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: /Torna alla lobby/ }).click()
  await page.waitForTimeout(300)
  check('host: back to lobby', JSON.stringify(await events(page)) === '["endGame"]', JSON.stringify(await events(page)))
  await trigger.click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: /Chiudi la stanza/ }).click()
  await page.waitForTimeout(300)
  check('host: close room', JSON.stringify(await events(page)) === '["endGame","leave"]', JSON.stringify(await events(page)))
  await ctx.close()
}

// 7) Phone: menu as a bottom sheet, armed button, spectator card dismissed by a tap.
{
  const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  const { ctx, page } = await open('s=playing&me=p-3', phone)
  await page.getByRole('button', { name: 'Esci dalla partita' }).first().tap()
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}i-phone-menu-guest.png` })
  await page.getByRole('button', { name: 'Resta' }).tap()
  await page.waitForTimeout(400)
  await confirmBtn(page).tap()
  await page.waitForTimeout(400)
  check('phone: tap hint', /tocca di nuovo/i.test(await confirmBtn(page).innerText()), JSON.stringify(await confirmBtn(page).innerText()))
  await page.screenshot({ path: `${OUT}i-phone-armed.png` })
  await ctx.close()
  const s = await open('s=spectator', phone)
  check('spectator: card shown', await s.page.getByText('Stai guardando').isVisible())
  await s.page.locator('[data-snippet-block]').nth(3).tap()
  await s.page.waitForTimeout(600)
  check('spectator: tap on the board dismisses the card', !(await s.page.getByText('Stai guardando').isVisible().catch(() => false)))
  await s.ctx.close()
  const h = await open('s=playing', phone)
  await h.page.getByRole('button', { name: 'Termina partita' }).first().tap()
  await h.page.waitForTimeout(600)
  await h.page.screenshot({ path: `${OUT}i-phone-menu-host.png` })
  await h.ctx.close()
}

await browser.close()
console.log(failures ? `${failures} FAILED` : 'all passed')
process.exit(failures ? 1 : 0)
