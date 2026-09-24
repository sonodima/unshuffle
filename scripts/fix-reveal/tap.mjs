// Tap-to-seek check on the fix-reveal lab: a block tap during the reveal keeps the
// song going from that snippet (tag 'reveal', mode 'full'); tapping the playing
// block pauses; the song button resumes from the same spot.
import { chromium } from 'playwright'

const base = process.env.BASE ?? 'http://localhost:5402/lab/fix-reveal.html'
const touch = process.env.TOUCH === '1'
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const ctx = await browser.newContext(
  touch ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } },
)
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(`${base}?me=p-host&auto=0`)
await page.waitForFunction(() => window.__fixReveal?.audio === 'ready', null, { timeout: 30000 })
await page.evaluate(() => window.__fixReveal.replay())
await page.waitForSelector('.rv-root[data-stage="done"]', { timeout: 20000 })
await page.waitForTimeout(600)

const snap = async (label) => {
  const r = await page.evaluate(() => {
    const s = window.__fixReveal.state()
    const p = window.__fixReveal.pos()
    const btn = document.querySelector('.rv-song button[aria-label*="canzone"]')?.getAttribute('aria-label')
    const np = document.querySelector('[data-rv-board]')?.getAttribute('data-now-playing') ?? null
    return { tag: s.tag, mode: s.mode, playing: s.playing, elapsed: p?.elapsed ?? null, btn, np }
  })
  console.log(label.padEnd(26), JSON.stringify(r))
  return r
}
let ok = true
const expect = (cond, msg) => {
  if (!cond) {
    ok = false
    console.log('  FAIL:', msg)
  }
}

const before = await snap('before tap')
expect(before.playing && before.tag === 'reveal' && before.mode === 'full', 'song plays on reveal')

const tap = async (seg) => {
  const el = page.locator(`.rv-board .sb-item[data-seg="${seg}"]`)
  if (touch) await el.tap()
  else await el.click()
}
await tap(5)
await page.waitForTimeout(150)
const a = await snap('tap block 5 (+150ms)')
expect(a.playing && a.tag === 'reveal' && a.mode === 'full', 'block tap keeps the song (full, reveal)')
await page.waitForTimeout(3500)
const b = await snap('after 3.5 s')
expect(b.playing && b.tag === 'reveal', 'song still playing after the snippet length')
expect(b.np != null && b.np !== '5', `highlight moved on (np=${b.np})`)

// Tap the block that is playing now -> pause.
const cur = b.np
if (cur != null) {
  await tap(cur)
  await page.waitForTimeout(300)
  const c = await snap(`tap playing block ${cur}`)
  expect(!c.playing, 'tapping the playing block pauses')
  expect(c.btn === 'Riprendi la canzone', `button offers resume (${c.btn})`)
  const shown = await page.evaluate(() => document.querySelector('.rv-np')?.parentElement?.textContent ?? '')
  console.log('  now-playing text:', shown)
  await page.click('.rv-song button[aria-label="Riprendi la canzone"]')
  await page.waitForTimeout(200)
  const d = await snap('resume via song button')
  expect(d.playing && d.tag === 'reveal', 'resumes')
  expect(d.np === cur, `resumes inside the paused block (np=${d.np}, want ${cur})`)
}
// Toggle to "Il tuo ordine" and back.
await page.getByRole('radio', { name: 'Il tuo ordine' }).click()
await page.waitForTimeout(900)
const mine = await page.evaluate(() => [...document.querySelectorAll('.rv-board .sb-item')].map((e) => `${e.getAttribute('data-seg')}:${e.querySelector('.sb-block')?.getAttribute('data-mark') ?? '-'}`).join(' '))
console.log('mine view      ', mine)
await page.getByRole('radio', { name: 'L’ordine giusto' }).click()
await page.waitForTimeout(900)
const right = await page.evaluate(() => [...document.querySelectorAll('.rv-board .sb-item')].map((e) => `${e.getAttribute('data-seg')}:${e.querySelector('.sb-block')?.getAttribute('data-mark') ?? '-'}`).join(' '))
console.log('correct view   ', right)
expect(!right.includes('wrong'), 'correct view has no wrong marks')
expect(mine.includes('wrong'), 'mine view shows wrong marks')

// Exit: phase changes -> reveal stays on screen while fading, song fades out.
await page.evaluate(() => window.__fixReveal.exit())
await page.waitForTimeout(120)
const mid = await page.evaluate(() => ({
  reveal: !!document.querySelector('.rv-root'),
  opacity: getComputedStyle(document.querySelector('.rv-root')?.closest('section') ?? document.body).opacity,
  playing: window.__fixReveal.state().playing,
}))
console.log('exit +120ms    ', JSON.stringify(mid))
expect(mid.reveal, 'reveal still rendered during the exit fade')
await page.waitForTimeout(700)
const gone = await page.evaluate(() => ({ reveal: !!document.querySelector('.rv-root'), playing: window.__fixReveal.state().playing }))
console.log('exit +820ms    ', JSON.stringify(gone))
expect(!gone.reveal && !gone.playing, 'reveal gone and silent after the fade')

if (errors.length) console.log('CONSOLE:', [...new Set(errors)].join('\n'))
console.log(ok ? 'PASS' : 'FAILED')
await browser.close()
process.exit(ok ? 0 : 1)
