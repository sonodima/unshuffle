// Screenshots of the lobby lab. Usage: node scripts/lobby/shoot.mjs <tag> [filter] [--scroll]
// Needs the dev server: UNSHUFFLE_VITE_CACHE=node_modules/.vite-lobby npx vite --port 5211 --strictPort
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const tag = process.argv[2] ?? 'v'
const filter = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : ''
const scroll = process.argv.includes('--scroll')
// 127.0.0.1: another project's dev server may hold [::1]:5211 on this machine.
const BASE = 'http://127.0.0.1:5211/lab/lobby.html'
const OUT = new URL('./shots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

const SCENARIOS = [
  { name: 'host-pl', q: 'role=host&pl=1&n=5' },
  { name: 'host-nopl', q: 'role=host&pl=0&n=1' },
  { name: 'guest-pl', q: 'role=guest&pl=1&n=5' },
  { name: 'guest-nopl', q: 'role=guest&pl=0&n=3' },
  { name: 'host-tab-playlist', q: 'role=host&pl=1&n=5&tab=playlist', phoneOnly: true },
  { name: 'host-tab-rules', q: 'role=host&pl=1&n=5&tab=rules', phoneOnly: true },
  { name: 'guest-tab-rules', q: 'role=guest&pl=1&n=5&tab=rules', phoneOnly: true },
  { name: 'host-full', q: 'role=host&pl=1&n=10' },
]

const browser = await chromium.launch({ channel: 'chrome' })
const errors = []

async function shoot(s, device) {
  const phone = device === 'phone'
  const ctx = await browser.newContext({
    viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    deviceScaleFactor: phone ? 2 : 1,
    hasTouch: phone,
    isMobile: phone,
  })
  const page = await ctx.newPage()
  page.on('console', (m) => {
    if (/LanguageModel|text session|AudioContext was not allowed/.test(m.text())) return
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${s.name}/${device}] ${m.type()}: ${m.text()}`)
  })
  page.on('pageerror', (e) => errors.push(`[${s.name}/${device}] pageerror: ${e.message}`))
  await page.goto(`${BASE}?${s.q}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1600)
  const file = `${OUT}${tag}-${s.name}-${device}`
  await page.screenshot({ path: `${file}.png` })
  if (scroll) {
    const h = await page.evaluate(() => {
      const el = document.querySelector('main')?.parentElement
      return el ? el.scrollHeight - el.clientHeight : 0
    })
    let i = 1
    for (let y = 700; y < h + 700 && i < 6; y += 700, i++) {
      await page.evaluate((top) => document.querySelector('main')?.parentElement?.scrollTo({ top, behavior: 'instant' }), Math.min(y, h))
      await page.waitForTimeout(500)
      await page.screenshot({ path: `${file}-s${i}.png` })
      if (y >= h) break
    }
  }
  await ctx.close()
}

for (const s of SCENARIOS) {
  if (filter && !s.name.includes(filter)) continue
  await shoot(s, 'phone')
  if (!s.phoneOnly) await shoot(s, 'desk')
}
await browser.close()
console.log(errors.length ? errors.join('\n') : 'no console errors')
