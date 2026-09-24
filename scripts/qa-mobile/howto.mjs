// First-visit "Come si gioca" overlay (onboarded=false) × every viewport, Chromium + WebKit.
import { BASE, OUT, VIEWPORTS, newContext, metrics, sleep, closeBrowsers } from './lib.mjs'
const ENGINES = (process.env.ENGINES ?? 'chromium,webkit').split(',')
for (const engine of ENGINES) {
  const vps = [...VIEWPORTS, ...(engine === 'webkit' ? ['iphone14'] : [])]
  for (const vp of vps) {
    const id = vp === 'iphone14' ? vp : vp.id
    const { ctx, page, errors } = await newContext(engine, vp, { onboarded: false })
    await page.goto(BASE + '/')
    const dlg = page.getByRole('dialog', { name: 'Come si gioca' })
    await dlg.waitFor({ timeout: 20000 }).catch(() => {})
    await sleep(1400)
    const m = await metrics(page)
    const info = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]')
      if (!d) return null
      const r = d.getBoundingClientRect()
      const btn = [...d.querySelectorAll('button')].find((b) => /Ho capito|Iniziamo|Gioca/i.test(b.textContent || '')) ?? [...d.querySelectorAll('button')].pop()
      const br = btn?.getBoundingClientRect()
      const sc = [d, ...d.querySelectorAll('*')].find((e) => { const cs = getComputedStyle(e); return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 2 })
      return { dlg: [Math.round(r.top), Math.round(r.bottom), Math.round(r.left), Math.round(r.right)], cta: btn && { t: btn.textContent.trim(), top: Math.round(br.top), bottom: Math.round(br.bottom), inView: br.bottom <= innerHeight && br.top >= 0 }, scroller: sc ? { sh: sc.scrollHeight, ch: sc.clientHeight } : null, vh: innerHeight }
    })
    await page.screenshot({ path: `${OUT}howto-${engine}-${id}.png` })
    console.log(engine, id, JSON.stringify(info), m.docOverflowX ? 'docX' + m.docOverflowX : '', m.offscreen.length ? 'off:' + JSON.stringify(m.offscreen.slice(0, 3)) : '', m.textSpill.length ? 'spill:' + JSON.stringify(m.textSpill.slice(0, 3)) : '', errors.length ? errors : '')
    await ctx.close()
  }
}
await closeBrowsers()
