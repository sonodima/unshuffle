// fix-lobby interaction checks against the lab (dev server :5403). node scripts/fix-lobby/interact.mjs
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5403'
const browser = await chromium.launch({ channel: 'chrome' })
let fails = 0
const check = (name, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`)
}
const phone = (w = 390, h = 844) => browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const open = async (ctx, q) => {
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.text()))
  await page.goto(`${BASE}/lab/fix-lobby.html?${q}`, { waitUntil: 'load' })
  await page.waitForTimeout(1200)
  page.errors = errors
  return page
}
const startBtn = (page) => page.getByRole('button', { name: /Inizia partita/i })

// 1. Too-short playlist: start disabled, shortcut fixes it, start works.
{
  const ctx = await phone()
  const page = await open(ctx, 'role=host&pl=4&rounds=5&tab=players')
  check('short: start disabled', await startBtn(page).isDisabled())
  check('short: notice shown', await page.getByText(/Playlist troppo corta: ha 4 brani, ne servono 5/).isVisible())
  await page.getByRole('button', { name: 'Gioca 3 round' }).click()
  await page.waitForTimeout(300)
  check('short: start enabled after shortcut', await startBtn(page).isEnabled())
  check('short: notice gone', (await page.getByText(/Playlist troppo corta/).count()) === 0)
  await page.getByRole('tab', { name: /Regole/ }).click()
  check('short: rounds=3 selected', (await page.getByRole('radiogroup', { name: 'Round' }).getByRole('radio', { name: '3' }).getAttribute('aria-checked')) === 'true')
  await startBtn(page).click()
  await page.getByTestId('started').waitFor({ timeout: 4000 }).catch(() => {})
  check('short: game started', await page.getByTestId('started').isVisible())
  check('short: no console errors', page.errors.length === 0, page.errors.join(' | '))
  await ctx.close()
}
// 1b. No-fit playlist: no shortcut.
{
  const ctx = await phone(360, 740)
  const page = await open(ctx, 'role=host&pl=tiny&tab=players')
  check('tiny: start disabled', await startBtn(page).isDisabled())
  check('tiny: no shortcut', (await page.getByRole('button', { name: /Gioca \d+ round/ }).count()) === 0)
  check('tiny: copy', await page.getByText('Playlist troppo corta: ha solo 1 brano, ne servono almeno 3.').isVisible())
  await ctx.close()
}
// 1c. Guest never sees the notice.
{
  const ctx = await phone()
  const page = await open(ctx, 'role=guest&pl=tiny&tab=players')
  check('guest: no shortfall notice', (await page.getByText(/troppo corta/).count()) === 0)
  await ctx.close()
}
// 2. Typing in the search hides the start sheet; keyboard (resizes-content) keeps the field visible.
{
  const ctx = await phone()
  const page = await open(ctx, 'role=host&pl=1&tab=playlist')
  const bar = page.locator('div.sticky.bottom-0')
  const search = page.getByRole('searchbox', { name: 'Cerca playlist' })
  check('typing: bar visible before', (await bar.evaluate((el) => getComputedStyle(el).opacity)) === '1')
  await search.tap()
  await page.waitForTimeout(450)
  const hidden = await bar.evaluate((el) => ({ op: getComputedStyle(el).opacity, inert: el.inert, tr: getComputedStyle(el).translate }))
  check('typing: bar hidden while focused', hidden.op === '0' && hidden.inert === true, JSON.stringify(hidden))
  // Approximate a resizes-content keyboard: shrink the layout viewport by 330px.
  await page.setViewportSize({ width: 390, height: 514 })
  await page.waitForTimeout(700)
  const r = await search.evaluate((el) => { const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, vh: innerHeight } })
  check('keyboard: field inside the shrunk viewport', r.top >= 0 && r.bottom <= r.vh, JSON.stringify(r))
  await page.screenshot({ path: 'scripts/fix-lobby/shots/kb-390-search.png' })
  await search.fill('rock')
  await page.waitForTimeout(900)
  await page.setViewportSize({ width: 390, height: 844 })
  // Leave the field (tap on a neutral heading).
  await page.getByRole('heading', { name: 'Scegli la playlist' }).tap()
  await page.waitForTimeout(450)
  const shown = await bar.evaluate((el) => ({ op: getComputedStyle(el).opacity, inert: el.inert }))
  check('typing: bar back after blur', shown.op === '1' && shown.inert === false, JSON.stringify(shown))
  check('typing: no console errors', page.errors.length === 0, page.errors.join(' | '))
  await ctx.close()
}
// 2b. Narrow desktop window (mouse, no virtual keyboard): the bar stays.
{
  const ctx = await browser.newContext({ viewport: { width: 900, height: 800 } })
  const page = await open(ctx, 'role=host&pl=1&tab=playlist')
  await page.getByRole('searchbox', { name: 'Cerca playlist' }).click()
  await page.waitForTimeout(450)
  const st = await page.locator('div.sticky.bottom-0').evaluate((el) => ({ op: getComputedStyle(el).opacity, inert: el.inert }))
  check('narrow desktop: bar stays while typing', st.op === '1' && st.inert === false, JSON.stringify(st))
  await ctx.close()
}
// 3. Long names: kick buttons on screen and working at 360.
{
  const ctx = await phone(360, 740)
  const page = await open(ctx, 'role=host&n=10&names=long&tab=players')
  const off = await page.evaluate(() => [...document.querySelectorAll('ul[aria-label="Elenco giocatori"] button')].filter((b) => b.getBoundingClientRect().right > innerWidth).length)
  check('long names: no roster button offscreen', off === 0, `${off} offscreen`)
  await page.getByRole('button', { name: 'Rimuovi MMMMMMMMMMMMMMMM' }).tap()
  await page.getByRole('dialog').waitFor()
  await page.getByRole('dialog').getByRole('button', { name: 'Rimuovi' }).tap()
  await page.waitForTimeout(600)
  check('long names: kicked', (await page.getByRole('button', { name: 'Rimuovi MMMMMMMMMMMMMMMM' }).count()) === 0)
  await ctx.close()
}
// 4. QR sheet link keeps the room code tail.
for (const [w, h, q] of [[390, 844, ''], [360, 740, '&url=long']]) {
  const ctx = await phone(w, h)
  const page = await open(ctx, `role=host&pl=1&tab=players${q}`)
  await page.getByRole('button', { name: 'Mostra QR code' }).tap()
  await page.getByRole('dialog').waitFor()
  await page.waitForTimeout(500)
  const m = await page.evaluate(() => {
    const box = document.querySelector('[role="dialog"] .select-all')
    const [head, tail] = box.children
    const bb = box.getBoundingClientRect(), tb = tail.getBoundingClientRect()
    return { tail: tail.textContent, tailInside: tb.left >= bb.left - 0.5 && tb.right <= bb.right + 0.5, headTruncated: head.scrollWidth > head.clientWidth, text: box.textContent }
  })
  check(`qr ${w}${q}: tail visible`, /^#\/r\/[A-Z]{5}$/.test(m.tail) && m.tailInside, JSON.stringify(m))
  await page.screenshot({ path: `scripts/fix-lobby/shots/qr-${w}${q ? '-long' : ''}.png` })
  await ctx.close()
}
// 5. Desktop: every rule row clears the dock.
for (const [w, h, role] of [[1440, 900, 'host'], [1280, 720, 'host'], [1366, 768, 'host'], [1536, 864, 'host'], [1280, 800, 'host'], [1440, 900, 'guest'], [1280, 720, 'guest']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } })
  const page = await open(ctx, `role=${role}&pl=1&n=5`)
  await page.waitForTimeout(800)
  const m = await page.evaluate(() => {
    const dock = document.querySelector('div.sticky.bottom-0 .glass').getBoundingClientRect().top
    const groups = [...document.querySelectorAll('[role="radiogroup"]')].map((g) => Math.round(g.getBoundingClientRect().bottom))
    const h2 = [...document.querySelectorAll('h2')].map((e) => [e.textContent, Math.round(e.getBoundingClientRect().height)])
    return { dock: Math.round(dock), groups, h2 }
  })
  check(`desktop ${role} ${w}x${h}: rules above dock`, m.groups.length === 4 && m.groups.every((b) => b <= m.dock - 8), JSON.stringify(m))
  const title = m.h2.find(([t]) => t === 'Scegli la playlist')
  if (role === 'host') check(`desktop ${w}x${h}: picker title one line`, title && title[1] <= 32, JSON.stringify(title))
  await ctx.close()
}
await browser.close()
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
process.exit(fails ? 1 : 0)
