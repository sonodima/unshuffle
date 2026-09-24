// Behaviour checks against the lab. node scripts/round/interact.mjs
import { chromium } from 'playwright'

const BASE = 'http://localhost:5212/lab/round.html?ui=0&bg=css'
const OUT = new URL('./shots/', import.meta.url).pathname
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
let failures = 0
const check = (ok, msg) => {
  console.log(ok ? 'PASS' : 'FAIL', msg)
  if (!ok) failures++
}

async function open(qs, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(`${BASE}&${qs}`)
  await page.waitForFunction(() => window.__round, null, { timeout: 15000 })
  return { ctx, page, errors }
}
const sfx = (page) => page.evaluate(() => [...window.__round.sfx])
const clearSfx = (page) => page.evaluate(() => window.__round.sfx.splice(0))

// 1. Enter confirms from the page body; a second Enter does nothing.
{
  const { ctx, page, errors } = await open('s=playing')
  await page.waitForTimeout(800)
  await clearSfx(page)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)
  check((await sfx(page)).includes('submit'), 'Enter → submit sfx')
  check(await page.getByText('Confermato', { exact: true }).isVisible(), 'Enter → "Confermato" panel')
  check((await page.locator('.sb-board[data-locked]').count()) === 1, 'board locked after confirm')
  await clearSfx(page)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  check(!(await sfx(page)).includes('submit'), 'second Enter ignored')
  check(errors.length === 0, `no console errors (${errors.join(' | ')})`)
  await ctx.close()
}

// 2. Plain Enter on a focused block plays it (does not confirm); Cmd+Enter confirms.
{
  const { ctx, page } = await open('s=playing')
  await page.waitForTimeout(800)
  await page.waitForFunction(() => window.__round.audioReady(), null, { timeout: 15000 }).catch(() => {})
  await page.locator('.sb-item').first().focus()
  await clearSfx(page)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)
  check(!(await sfx(page)).includes('submit'), 'Enter on a block does not confirm')
  await page.keyboard.press('Meta+Enter')
  await page.waitForTimeout(300)
  check((await sfx(page)).includes('submit'), 'Cmd+Enter on a block confirms')
  await ctx.close()
}

// 3. Ticks in the last 10 s; audio stops at time up; board locks.
{
  const { ctx, page } = await open('s=playing&t=56500&live=1')
  await page.waitForFunction(() => window.__round.audioReady(), null, { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(400)
  await page.locator('.tb-play').click()
  await page.waitForTimeout(300)
  const playing = await page.evaluate(() => document.querySelector('.tb')?.hasAttribute('data-playing'))
  check(playing, 'play-all started')
  await page.waitForTimeout(3600)
  const s = await sfx(page)
  check(s.filter((x) => x === 'tick' || x === 'tickUrgent').length >= 2, `ticks in the last seconds (${s.join(',')})`)
  check(s.includes('tickUrgent'), 'tickUrgent in the last 3 s')
  const stillPlaying = await page.evaluate(() => document.querySelector('.tb')?.hasAttribute('data-playing'))
  check(!stillPlaying, 'playback stopped at time up')
  check(await page.getByText('Tempo scaduto!').isVisible(), '"Tempo scaduto!" shown')
  await page.screenshot({ path: `${OUT}i-timeup-live.png` })
  await ctx.close()
}

// 4. Spectator cannot confirm; board locked.
{
  const { ctx, page } = await open('s=spectator')
  await page.waitForTimeout(800)
  await clearSfx(page)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  check(!(await sfx(page)).includes('submit'), 'spectator Enter ignored')
  check((await page.getByRole('button', { name: /^conferma$/i }).count()) === 0, 'no CONFERMA for spectators')
  await ctx.close()
}

// 5. Audio error → retry pending → failed again (lab never has the audio).
{
  const { ctx, page } = await open('s=audioerror')
  await page.waitForTimeout(800)
  const btn = page.getByRole('button', { name: /riprova/i })
  check(await btn.isVisible(), 'retry button visible')
  await btn.click()
  await page.waitForTimeout(150)
  check((await page.locator('[role=alert] button').getAttribute('aria-busy')) === 'true', 'retry shows loading')
  await page.waitForTimeout(1200)
  check(await page.getByText('Audio non disponibile').isVisible(), 'error persists after failed retry')
  await ctx.close()
}

// 6. Reduced motion renders without errors.
{
  const { ctx, page, errors } = await open('s=flow', { reducedMotion: 'reduce' })
  await page.waitForTimeout(9500)
  await page.screenshot({ path: `${OUT}i-reduced-playing.png` })
  check(await page.getByRole('button', { name: /^conferma$/i }).isVisible(), 'reduced motion: reached play phase')
  check(errors.filter((e) => !/reduced motion/i.test(e)).length === 0, `reduced motion: no errors (${errors.join(' | ')})`)
  await ctx.close()
}

// 7. Phone: no page scroll in the play phase.
{
  const { ctx, page } = await open('s=n16', { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await page.waitForTimeout(900)
  const m = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ch: innerHeight, sw: document.documentElement.scrollWidth, cw: innerWidth }))
  check(m.sh <= m.ch && m.sw <= m.cw, `no overflow at 360x640 (${JSON.stringify(m)})`)
  await ctx.close()
}

await browser.close()
console.log(failures ? `${failures} FAILURES` : 'ALL PASS')
