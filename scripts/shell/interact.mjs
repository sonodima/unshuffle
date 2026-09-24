// Keyboard + interaction checks on the lab: sound popover a11y, M shortcut, reaction throttle, reduced motion, transitions.
import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome' })
const errors = []
const ok = (cond, msg) => console.log(cond ? 'PASS' : 'FAIL', msg)
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)))
  await page.goto('http://localhost:5215/lab/shell.html?panel=0', { waitUntil: 'networkidle' })
  await page.evaluate(() => window.__shell.setFixture('lobby'))
  await page.waitForTimeout(500)
  // keyboard open → focus inside, Esc → closed + focus back
  const btn = page.getByRole('button', { name: /^Audio/ })
  await btn.focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(250)
  const dlg = page.getByRole('dialog', { name: 'Impostazioni audio' })
  ok((await dlg.count()) === 1, 'popover opens with Enter')
  ok(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]')), 'focus moved into popover')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)
  ok((await dlg.count()) === 0, 'Esc closes popover')
  ok(await page.evaluate(() => document.activeElement?.getAttribute('aria-haspopup') === 'dialog'), 'focus back on button')
  // M shortcut
  const vol = () => page.evaluate(async () => (await import('/src/audio/engine.ts')).audioEngine.volume)
  const before = await vol()
  await page.keyboard.press('m')
  await page.waitForTimeout(100)
  const muted = await vol()
  await page.keyboard.press('m')
  await page.waitForTimeout(100)
  const after = await vol()
  ok(before > 0 && muted === 0 && Math.abs(after - before) < 0.01, `M toggles mute (${before} → ${muted} → ${after})`)
  // slider
  await btn.click()
  await page.waitForTimeout(250)
  const slider = page.getByRole('slider', { name: 'Volume' })
  await slider.fill('35')
  await page.waitForTimeout(100)
  ok(Math.abs((await vol()) - 0.35) < 0.01, 'slider sets volume')
  await page.mouse.click(700, 450)
  await page.waitForTimeout(250)
  ok((await dlg.count()) === 0, 'outside click closes popover')
  // sfx switch persists
  await btn.click()
  await page.waitForTimeout(200)
  const sw = page.getByRole('switch', { name: 'Effetti sonori' })
  const was = await sw.getAttribute('aria-checked')
  await sw.click()
  ok((await sw.getAttribute('aria-checked')) !== was, 'sfx switch toggles')
  await sw.click()
  await page.keyboard.press('Escape')
  // reaction throttle: 5 fast clicks → 1 react() call within 400ms
  const calls = await page.evaluate(async () => {
    let n = 0
    const g = window.__shell.useGame
    const orig = g.getState().react
    g.setState({ react: () => n++ })
    const b = document.querySelector('[aria-label="Reazione: Fuoco"]')
    for (let i = 0; i < 5; i++) b.click()
    await new Promise((r) => setTimeout(r, 450))
    b.click()
    g.setState({ react: orig })
    return n
  })
  ok(calls === 2, `reaction throttle (${calls} calls for 5 fast + 1 late clicks)`)
  // transitions: lobby → round → final; exiting frames are inert
  const mid = await page.evaluate(async () => {
    window.__shell.setFixture('playing')
    await new Promise((r) => setTimeout(r, 40))
    return [...document.querySelectorAll('[data-screen-frame]')].map((e) => [e.getAttribute('data-screen'), e.inert])
  })
  ok(mid.length === 2 && mid.some(([s, i]) => s === 'lobby' && i) && mid.some(([s, i]) => s === 'round' && !i), `crossfade frames ${JSON.stringify(mid)}`)
  await page.waitForTimeout(600)
  ok((await page.$$('[data-screen-frame]')).length === 1, 'old frame removed')
  ok((await page.title()) === 'UNSHUFFLE · Round 3/5', 'title follows the phase: ' + (await page.title()))
  await ctx.close()
}
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push('reduced: ' + e.message))
  await page.goto('http://localhost:5215/lab/shell.html?panel=0', { waitUntil: 'networkidle' })
  await page.evaluate(() => window.__shell.setFixture('lobby'))
  await page.waitForTimeout(400)
  await page.evaluate(() => window.__shell.reactions(4))
  await page.waitForTimeout(700)
  await page.screenshot({ path: 'scripts/shell/shots/reduced-reactions-phone.png' })
  ok(true, 'reduced motion renders')
  await ctx.close()
}
await browser.close()
console.log(errors.length ? errors.join('\n') : 'no console errors')
