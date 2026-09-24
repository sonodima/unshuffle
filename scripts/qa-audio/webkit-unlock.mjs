// WebKit (Playwright build, touch emulation): does the first tap unlock audio, and via which event?
import { webkit } from 'playwright'
const b = await webkit.launch()
for (const first of ['nickname-tap', 'crea', 'deeplink-entra']) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  await ctx.addInitScript(() => {
    localStorage.setItem('unshuffle:onboarded', String(Date.now()))
    window.__ev = []
    for (const t of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(t, () => window.__ev.push(t), { capture: true })
  })
  const p = await ctx.newPage()
  const url = first === 'deeplink-entra' ? 'http://127.0.0.1:5304/#/r/ABCDE' : 'http://127.0.0.1:5304/'
  await p.goto(url)
  await p.locator('[data-screen-frame][data-screen="home"]:not([inert])').waitFor({ timeout: 30000 })
  await p.waitForTimeout(800)
  const st = () => p.evaluate(async () => { const e = await import('/src/audio/engine.ts'); const c = e.getAudioContext(); return { ctx: c?.state ?? null, unlocked: e.audioEngine.unlocked, ev: window.__ev.slice(), audioSession: navigator.audioSession?.type ?? 'n/a' } })
  const before = await st()
  if (first === 'nickname-tap') await p.getByRole('textbox').first().tap()
  else if (first === 'crea') await p.getByRole('button', { name: 'Crea stanza', exact: true }).tap()
  else await p.getByRole('button', { name: /^Entra/ }).tap()
  await p.waitForTimeout(1200)
  console.log(first.padEnd(16), 'before', JSON.stringify(before), '→ after', JSON.stringify(await st()))
  await ctx.close()
}
await b.close()
