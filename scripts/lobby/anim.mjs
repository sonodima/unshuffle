// Live changes (guest sees host pick a playlist, players join/leave), keyboard tabs. Usage: node scripts/lobby/anim.mjs <tag>
import { chromium } from 'playwright'
const tag = process.argv[2] ?? 'a'
const OUT = new URL('./shots/', import.meta.url).pathname
const browser = await chromium.launch({ channel: 'chrome' })
const errors = []
for (const device of ['desk', 'phone']) {
  const phone = device === 'phone'
  const ctx = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: phone ? 2 : 1, hasTouch: phone, isMobile: phone })
  const page = await ctx.newPage()
  page.on('console', (m) => {
    if (/LanguageModel|text session|AudioContext was not allowed/.test(m.text())) return
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${device}] ${m.type()}: ${m.text()}`)
  })
  page.on('pageerror', (e) => errors.push(`[${device}] pageerror: ${e.message}`))
  await page.goto(`http://127.0.0.1:5211/lab/lobby.html?role=guest&pl=0&n=2&ui=1${phone ? '&tab=playlist' : ''}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${OUT}${tag}-${device}-0-empty.png` })
  await page.getByRole('button', { name: /Playlist: no/ }).click()
  await page.waitForTimeout(260)
  await page.screenshot({ path: `${OUT}${tag}-${device}-1-mid.png` })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${OUT}${tag}-${device}-2-picked.png` })
  if (!phone) {
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '+ giocatore' }).click()
    await page.waitForTimeout(150)
    await page.screenshot({ path: `${OUT}${tag}-${device}-3-joining.png` })
    await page.waitForTimeout(900)
    await page.getByRole('button', { name: '− giocatore' }).click()
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${OUT}${tag}-${device}-4-left.png` })
  } else {
    await page.getByRole('tab', { name: /Playlist/ }).focus()
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(400)
    const sel = await page.getByRole('tab', { name: /Regole/ }).getAttribute('aria-selected')
    const focused = await page.evaluate(() => document.activeElement?.textContent)
    console.log('keyboard tabs:', sel, focused)
    await page.screenshot({ path: `${OUT}${tag}-${device}-3-rules.png` })
  }
  await ctx.close()
}
await browser.close()
console.log(errors.length ? errors.join('\n') : 'no console errors')
