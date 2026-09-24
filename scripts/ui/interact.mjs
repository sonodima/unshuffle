// Interaction checks for the UI kit in the lab page. Prints PASS/FAIL lines and saves screenshots.
import { chromium } from 'playwright'

const PAGE = 'http://localhost:5201/lab/ui.html'
const OUT = new URL('./shots/', import.meta.url).pathname
const browser = await chromium.launch({ channel: 'chrome' })
const errors = []
const results = []
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`)

async function open(name, viewport, dsf, mobile) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dsf, hasTouch: mobile, isMobile: mobile })
  const page = await ctx.newPage()
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`[${name}] ${m.type()}: ${m.text()}`))
  page.on('pageerror', (e) => errors.push(`[${name}] pageerror: ${e.message}`))
  await page.goto(PAGE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  return { ctx, page }
}

// ---------------- desktop
{
  const { ctx, page } = await open('desk', { width: 1440, height: 900 }, 1, false)

  // CodeInput: type with auto-advance, lowercase → uppercase, invalid letters rejected
  const boxes = page.getByRole('group', { name: 'Codice stanza' }).locator('input')
  await boxes.first().scrollIntoViewIfNeeded()
  await boxes.first().click()
  await page.keyboard.type('kx0q')
  const vals = await boxes.evaluateAll((els) => els.map((e) => e.value))
  check('code: typing uppercases + rejects digits', vals.join('') === 'KXQ', vals.join(','))
  const focusedIdx = await boxes.evaluateAll((els) => els.indexOf(document.activeElement))
  check('code: focus advanced to 4th box', focusedIdx === 3, String(focusedIdx))
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Backspace')
  const afterBs = await boxes.evaluateAll((els) => els.map((e) => e.value).join(''))
  check('code: backspace on empty box clears previous (twice → K)', afterBs === 'K', afterBs)
  // Paste a share link
  await page.evaluate(() => {
    const el = document.activeElement
    const dt = new DataTransfer()
    dt.setData('text', 'https://example.com/unshuffle/#/r/zztpq')
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  })
  await page.waitForTimeout(100)
  const pasted = await boxes.evaluateAll((els) => els.map((e) => e.value).join(''))
  check('code: paste link fills all', pasted === 'ZZTPQ', pasted)
  await page.waitForTimeout(500)
  const invalid = await boxes.first().getAttribute('aria-invalid')
  check('code: wrong code → invalid state', invalid === 'true')
  await page.locator('#sg-fields').screenshot({ path: OUT + 'i-desk-code-invalid.png' })
  // Correct code clears invalid and shows success
  await boxes.nth(0).click()
  for (let i = 0; i < 5; i++) await page.keyboard.press('Delete'), await page.keyboard.press('ArrowRight')
  await boxes.nth(0).click()
  await page.keyboard.type('KXQPM')
  await page.waitForTimeout(300)
  const okText = await page.locator('#sg-fields').innerText()
  check('code: correct code accepted', okText.includes('Stanza trovata'))
  await page.locator('#sg-fields').screenshot({ path: OUT + 'i-desk-code-ok.png' })

  // Segmented keyboard
  const seg = page.getByRole('radiogroup', { name: 'Numero di round' }).first()
  await seg.getByRole('radio', { checked: true }).focus()
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(350)
  const segSel = await seg.getByRole('radio', { checked: true }).innerText()
  check('segmented: arrow key moves selection', segSel.trim() === '7', segSel)
  await page.locator('#sg-controls').screenshot({ path: OUT + 'i-desk-seg-focus.png' })

  // Avatar picker keyboard
  const grid = page.getByRole('radiogroup', { name: 'Scegli avatar' })
  await grid.getByRole('radio', { checked: true }).focus()
  await page.keyboard.press('ArrowDown')
  const sel = await grid.getByRole('radio', { checked: true }).getAttribute('data-index')
  check('avatar picker: ArrowDown moves one row', sel === '15', sel)

  // Tooltip on hover
  const play = page.getByRole('button', { name: 'Riproduci tutto' }).first()
  await play.scrollIntoViewIfNeeded()
  await play.hover()
  await page.waitForTimeout(600)
  const tip = await page.getByRole('tooltip').count()
  check('tooltip: appears on hover (desktop)', tip === 1)
  await page.screenshot({ path: OUT + 'i-desk-tooltip.png' })
  await page.mouse.move(5, 5)

  // Keyboard focus ring on a button
  await page.getByRole('button', { name: 'Crea stanza' }).focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await page.locator('#sg-buttons').screenshot({ path: OUT + 'i-desk-focus.png' })

  // Modal: open, focus trap, Esc closes and restores focus
  const trigger = page.locator('#sg-feedback').getByRole('button', { name: 'Come si gioca' })
  await trigger.scrollIntoViewIfNeeded()
  await trigger.click()
  await page.waitForTimeout(500)
  const dialog = page.getByRole('dialog')
  check('modal: opens', (await dialog.count()) === 1)
  await page.screenshot({ path: OUT + 'i-desk-modal.png' })
  for (let i = 0; i < 6; i++) await page.keyboard.press('Tab')
  const inside = await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))
  check('modal: focus trapped', inside)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  check('modal: Esc closes', (await dialog.count()) === 0)
  const restored = await page.evaluate(() => document.activeElement?.textContent?.includes('Come si gioca'))
  check('modal: focus restored to trigger', !!restored)

  // Toasts
  const fb = page.locator('#sg-feedback')
  await fb.getByRole('button', { name: 'Ingresso' }).click()
  await fb.getByRole('button', { name: 'Conferma', exact: true }).click()
  await fb.getByRole('button', { name: 'Errore' }).click()
  await page.waitForTimeout(500)
  check('toasts: 3 visible', (await page.locator('[aria-label=Notifiche] [role=status]').count()) === 3)
  await page.screenshot({ path: OUT + 'i-desk-toasts.png' })
  await page.getByRole('button', { name: 'Chiudi notifica' }).first().click()
  await page.waitForTimeout(400)
  check('toasts: dismiss', (await page.locator('[aria-label=Notifiche] [role=status]').count()) === 2)

  // Timer jump to urgent
  await page.getByRole('button', { name: 'Salta a 8s' }).click()
  await page.locator('#sg-timers').scrollIntoViewIfNeeded()
  await page.waitForTimeout(700)
  await page.locator('#sg-timers').screenshot({ path: OUT + 'i-desk-timer-urgent.png' })

  // Horizontal overflow
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  check('desk: no horizontal overflow', !overflow)
  await ctx.close()
}

// ---------------- phone
{
  const { ctx, page } = await open('phone', { width: 390, height: 844 }, 2, true)
  const trigger = page.getByRole('button', { name: 'Bottom sheet' })
  await trigger.scrollIntoViewIfNeeded()
  await trigger.tap()
  await page.waitForTimeout(700)
  await page.screenshot({ path: OUT + 'i-phone-sheet.png' })
  check('phone: sheet opens', (await page.getByRole('dialog').count()) === 1)
  await page.getByRole('dialog').getByRole('button', { name: 'Chiudi', exact: true }).tap()
  await page.waitForTimeout(500)
  await page.locator('#sg-feedback').getByRole('button', { name: 'Come si gioca' }).tap()
  await page.waitForTimeout(700)
  await page.screenshot({ path: OUT + 'i-phone-modal-auto.png' })
  const box = await page.getByRole('dialog').boundingBox()
  check('phone: auto modal is a bottom sheet', !!box && Math.abs(box.y + box.height - 844) < 2, JSON.stringify(box))
  await page.getByRole('button', { name: 'Ho capito' }).tap()
  await page.waitForTimeout(500)
  await page.locator('#sg-feedback').getByRole('button', { name: 'Conferma', exact: true }).tap()
  await page.getByRole('button', { name: 'Reazione' }).tap()
  await page.waitForTimeout(500)
  await page.screenshot({ path: OUT + 'i-phone-toasts.png' })
  const tipCount = await page.getByRole('tooltip').count()
  check('phone: no tooltips on touch', tipCount === 0)
  const overflow = await page.evaluate(() => {
    const sc = document.querySelector('.h-dvh')
    return document.documentElement.scrollWidth > window.innerWidth || (sc && sc.scrollWidth > sc.clientWidth)
  })
  check('phone: no horizontal overflow', !overflow)
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .filter((b) => b.offsetParent !== null && !b.closest('[role=radiogroup]') && !b.closest('[aria-label=Notifiche]'))
      .map((b) => ({ t: b.getAttribute('aria-label') || b.textContent.trim().slice(0, 20), h: Math.round(b.getBoundingClientRect().height) }))
      .filter((b) => b.h < 36),
  )
  check('phone: tap targets ≥ 36px (sm buttons) ', small.length === 0, JSON.stringify(small.slice(0, 8)))
  await ctx.close()
}

await browser.close()
console.log(results.join('\n'))
console.log(errors.length ? errors.join('\n') : 'no console errors')
