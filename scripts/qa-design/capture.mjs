// QA "design": screenshot every lab state at 3 viewports. READ-ONLY on the app.
// Usage: node scripts/qa-design/capture.mjs [filter]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://127.0.0.1:5303'
const OUT = new URL('./shots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const filter = process.argv[2] ?? ''

const VP = {
  d1440: { viewport: { width: 1440, height: 900 } },
  d1280: { viewport: { width: 1280, height: 720 } },
  p390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
}

// [name, path, wait ms, viewports]
const SCENES = [
  ['home-idle', '/lab/home.html?state=idle', 1500],
  ['home-howto', '/lab/home.html?state=howto', 1500],
  ['home-joinerr', '/lab/home.html?state=join-error', 1200],
  ['lobby-host-nopl', '/lab/lobby.html?role=host&pl=0&n=1', 1500],
  ['lobby-host-pl', '/lab/lobby.html?role=host&pl=1&n=5', 1500],
  ['lobby-guest', '/lab/lobby.html?role=guest&pl=1&n=5', 1500],
  ['round-preparing', '/lab/round.html?s=preparing&ui=0&bg=css', 1500],
  ['round-slicing', '/lab/round.html?s=slicing&ui=0&bg=css', 1500],
  ['round-introcard', '/lab/round.html?s=intro-card&ui=0&bg=css&live=0', 1200],
  ['round-playing', '/lab/round.html?s=playing&ui=0&bg=css', 3500],
  ['round-n16', '/lab/round.html?s=n16&ui=0&bg=css', 3500],
  ['round-minefirst', '/lab/round.html?s=mine-first&ui=0&bg=css', 3000],
  ['round-submitted', '/lab/round.html?s=submitted&ui=0&bg=css', 3000],
  ['round-final', '/lab/round.html?s=final&ui=0&bg=css', 3000],
  ['round-timeup', '/lab/round.html?s=timeup&ui=0&bg=css', 3000],
  ['round-spectator', '/lab/round.html?s=spectator&ui=0&bg=css', 3000],
  ['round-audioerror', '/lab/round.html?s=audioerror&ui=0&bg=css', 3000],
  ['reveal-host-done', '/lab/reveal.html?me=p-host&ui=0&skip=1', 3500],
  ['reveal-p3-done', '/lab/reveal.html?me=p-3&ui=0&skip=1', 3500],
  ['reveal-p2-perfect', '/lab/reveal.html?me=p-2&ui=0&skip=1', 3500],
  ['reveal-p4-timeout', '/lab/reveal.html?me=p-4&ui=0&skip=1', 3500],
  ['reveal-spect', '/lab/reveal.html?me=p-5&ui=0&skip=1', 3500],
  ['reveal-n16', '/lab/reveal.html?me=p-3&n=16&ui=0&skip=1', 3500],
  ['final-final', '/lab/final.html?v=final&ui=0&celebrate=0', 4500],
  ['final-duo', '/lab/final.html?v=duo&ui=0&celebrate=0', 4500],
  ['final-zero', '/lab/final.html?v=zero&ui=0&celebrate=0', 4500],
  ['final-crowd', '/lab/final.html?v=crowd&ui=0&celebrate=0', 4500],
  ['styleguide', '/#/styleguide', 1500],
]

const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
for (const [name, path, wait, vps] of SCENES) {
  if (filter && !name.includes(filter)) continue
  for (const vp of vps ?? Object.keys(VP)) {
    const ctx = await browser.newContext(VP[vp])
    await ctx.addInitScript(() => {
      try { localStorage.setItem('unshuffle:onboarded', String(Date.now())) } catch {}
    })
    const page = await ctx.newPage()
    const errs = []
    page.on('pageerror', (e) => errs.push(e.message))
    try {
      await page.goto(BASE + path, { waitUntil: 'load' })
      await page.waitForTimeout(wait)
      await page.screenshot({ path: `${OUT}${name}-${vp}.png` })
      if (process.env.FULL) await page.screenshot({ path: `${OUT}${name}-${vp}-full.png`, fullPage: true })
      console.log('ok', name, vp, errs.length ? errs : '')
    } catch (e) {
      console.log('FAIL', name, vp, e.message)
    }
    await ctx.close()
  }
}
await browser.close()
