// WebKit (iPhone 14): AudioContext locked before a gesture, running after the first tap; SFX + decode + worker.
import { webkit, devices } from 'playwright'
const BASE = process.env.PBASE ?? 'http://127.0.0.1:5303/'
const b = await webkit.launch()
const ctx = await b.newContext({ ...devices['iPhone 14'] })
await ctx.addInitScript(() => { try { localStorage.setItem('unshuffle:onboarded', '1') } catch {} })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)))
await p.goto(BASE)
await p.locator('[data-screen-frame][data-screen="home"]:not([inert])').waitFor()
await p.waitForTimeout(1200)
const probe = () => p.evaluate(() => {
  // AudioContext instances are not globally reachable in prod; patch-free probe via the sound button label + a fresh context.
  const btn = [...document.querySelectorAll('button')].find((b) => /^Audio/.test(b.getAttribute('aria-label') || ''))
  return { soundLabel: btn?.getAttribute('aria-label'), audioSession: navigator.audioSession?.type ?? 'n/a', shader: document.querySelector('.ushf-bg')?.getAttribute('data-mode') ?? null }
})
console.log('before tap', JSON.stringify(await probe()))
// First gesture: tap the avatar button (harmless) then close the sheet.
await p.getByRole('button', { name: 'Cambia avatar e colore' }).tap()
await p.waitForTimeout(600)
await p.keyboard.press('Escape')
await p.waitForTimeout(500)
console.log('after first tap', JSON.stringify(await probe()))
console.log('errors', errs)
await b.close()
