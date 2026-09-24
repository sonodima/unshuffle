// QA "mobile" helpers: viewports, browser contexts, in-page layout metrics, fixture tweaks.
import { chromium, webkit, devices } from 'playwright'
import { mkdirSync } from 'node:fs'

export const BASE = process.env.BASE ?? 'http://127.0.0.1:5302'
export const OUT = new URL('./shots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

export const VIEWPORTS = [
  { id: '360x740', width: 360, height: 740, mobile: true, dpr: 3, safe: { top: 24, bottom: 0, left: 0, right: 0 } },
  { id: '390x844', width: 390, height: 844, mobile: true, dpr: 3, safe: { top: 47, bottom: 34, left: 0, right: 0 } },
  { id: '430x932', width: 430, height: 932, mobile: true, dpr: 3, safe: { top: 59, bottom: 34, left: 0, right: 0 } },
  { id: '844x390', width: 844, height: 390, mobile: true, dpr: 3, safe: { top: 0, bottom: 21, left: 47, right: 47 } },
  { id: '768x1024', width: 768, height: 1024, mobile: true, dpr: 2, safe: { top: 24, bottom: 20, left: 0, right: 0 } },
  { id: '1024x768', width: 1024, height: 768, mobile: true, dpr: 2, safe: { top: 24, bottom: 20, left: 0, right: 0 } },
  { id: '1280x720', width: 1280, height: 720, mobile: false, dpr: 1, safe: null },
  { id: '1440x900', width: 1440, height: 900, mobile: false, dpr: 1, safe: null },
]

const IOS_UA = devices['iPhone 14'].userAgent
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'

let _chrome = null
let _webkit = null
export async function getBrowser(engine) {
  if (engine === 'chromium') {
    _chrome ??= await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
    return _chrome
  }
  _webkit ??= await webkit.launch()
  return _webkit
}
export async function closeBrowsers() {
  await _chrome?.close().catch(() => {})
  await _webkit?.close().catch(() => {})
}

/** A context for `engine` × viewport. `vp` may be 'iphone14' (WebKit device descriptor). */
export async function newContext(engine, vp, { onboarded = true, safeArea = true } = {}) {
  const browser = await getBrowser(engine)
  let opts
  if (vp === 'iphone14') opts = { ...devices['iPhone 14'] }
  else if (vp.mobile)
    opts = {
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dpr,
      isMobile: true,
      hasTouch: true,
      userAgent: engine === 'webkit' ? IOS_UA : ANDROID_UA,
    }
  else opts = { viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr }
  const ctx = await browser.newContext(opts)
  if (onboarded)
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem('unshuffle:onboarded', String(Date.now()))
      } catch {}
    })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text().slice(0, 300)}`)
  })
  page.on('dialog', (d) => void d.accept().catch(() => {}))
  if (engine === 'chromium' && safeArea && vp !== 'iphone14' && vp.safe) {
    const cdp = await ctx.newCDPSession(page)
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: vp.safe }).catch(() => {})
  }
  return { ctx, page, errors }
}

/** In-page layout audit. Runs in the browser. */
export function metricsFn() {
  const vw = document.documentElement.clientWidth
  const vh = window.innerHeight
  const desc = (el) => {
    const cls = typeof el.className === 'string' ? el.className.split(/\s+/).slice(0, 4).join('.') : ''
    const txt = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${txt ? ` "${txt}"` : ''}`
  }
  const visible = (el) => {
    if (el.closest('[inert],[aria-hidden="true"]')) return false
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }
  const clipper = (el) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a)
      if (cs.overflowX !== 'visible' || cs.clipPath !== 'none' || cs.contain.includes('paint')) return a
    }
    return null
  }
  const out = {
    vw,
    vh,
    docOverflowX: document.documentElement.scrollWidth - vw,
    bodyOverflowX: document.body.scrollWidth - document.body.clientWidth,
    docScrollY: document.scrollingElement.scrollHeight - vh,
    offscreen: [],
    textSpill: [],
    truncated: [],
    smallTargets: [],
    soundOverlap: [],
    scrollers: [],
    safe: null,
    cta: null,
  }
  const frame = document.querySelector('[data-screen-frame]:not([inert])')
  const nodes = [...document.body.querySelectorAll('*')]
  for (const el of nodes) {
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.closest('svg') && el.tagName !== 'svg') continue
    if (!visible(el)) continue
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    const interactive = el.matches('button,a[href],input,select,textarea,[role="button"],[role="radio"],[role="tab"],[role="switch"],[tabindex="0"]')
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    // scroll containers
    if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 2)
      out.scrollers.push({ el: desc(el), sh: el.scrollHeight, ch: el.clientHeight, st: el.scrollTop })
    if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 2)
      out.scrollers.push({ el: desc(el), axis: 'x', sw: el.scrollWidth, cw: el.clientWidth })
    if (!(interactive || hasText || el.tagName === 'IMG' || el.tagName === 'CANVAS')) continue
    // horizontal: sticking out of the viewport and not clipped inside a narrower component
    if ((r.right > vw + 1 || r.left < -1) && r.bottom > 0 && r.top < vh) {
      const c = clipper(el)
      const cr = c?.getBoundingClientRect()
      const intentional = c && cr.right <= vw + 1 && cr.left >= -1 && cr.width < vw - 2
      const inHScroller = c && (getComputedStyle(c).overflowX === 'auto' || getComputedStyle(c).overflowX === 'scroll')
      if (!intentional && !inHScroller) out.offscreen.push({ el: desc(el), left: Math.round(r.left), right: Math.round(r.right) })
    }
    if (hasText && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
      if (cs.textOverflow === 'ellipsis' || cs.overflowX === 'hidden' || cs.overflowX === 'clip') out.truncated.push({ el: desc(el), sw: el.scrollWidth, cw: el.clientWidth })
      else if (cs.display !== 'inline') out.textSpill.push({ el: desc(el), sw: el.scrollWidth, cw: el.clientWidth })
    }
    if (interactive && (r.width < 40 || r.height < 40) && el.tagName !== 'INPUT' && r.width > 4)
      out.smallTargets.push({ el: desc(el), w: Math.round(r.width), h: Math.round(r.height) })
  }
  // Floating sound control (the one NOT inside a screen frame)
  const sb = [...document.querySelectorAll('button[aria-haspopup="dialog"]')].find(
    (b) => /^Audio/.test(b.getAttribute('aria-label') || '') && !b.closest('[data-screen-frame]') && visible(b),
  )
  if (sb) {
    const r = sb.getBoundingClientRect()
    out.sound = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
    const hits = new Set()
    for (let i = 0; i <= 4; i++)
      for (let j = 0; j <= 4; j++) {
        const x = r.left + (r.width * i) / 4
        const y = r.top + (r.height * j) / 4
        for (const e of document.elementsFromPoint(Math.min(vw - 1, x), Math.min(vh - 1, y))) {
          if (sb.contains(e) || e.contains(sb) || !frame?.contains(e) || e === frame) continue
          const ecs = getComputedStyle(e)
          const txt = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
          const inter = e.matches('button,a[href],input,[role="button"],[role="radio"],[role="tab"],.sb-item,.sb-block')
          if (txt || inter || e.tagName === 'IMG' || e.tagName === 'CANVAS' && !e.closest('[data-shader]')) {
            if (ecs.pointerEvents === 'none' && !txt) continue
            hits.add(desc(e))
          }
        }
      }
    out.soundOverlap = [...hits].slice(0, 8)
  }
  const d = document.createElement('div')
  d.style.cssText = 'position:fixed;top:env(safe-area-inset-top);bottom:env(safe-area-inset-bottom);left:env(safe-area-inset-left);right:env(safe-area-inset-right);pointer-events:none'
  document.body.appendChild(d)
  const sr = d.getBoundingClientRect()
  out.safe = { top: sr.top, bottom: vh - sr.bottom, left: sr.left, right: vw - sr.right }
  d.remove()
  const ctaRe = /^(Crea stanza|Entra|Inizia partita|Conferma|Prossimo round|Classifica finale|Rigioca|Ho capito)/i
  const cta = [...document.querySelectorAll('button')].find((b) => visible(b) && ctaRe.test((b.textContent || '').trim()) && !b.closest('[inert]'))
  if (cta) {
    const r = cta.getBoundingClientRect()
    out.cta = { text: (cta.textContent || '').trim().slice(0, 30), top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), inView: r.bottom <= vh && r.top >= 0, disabled: cta.disabled }
  }
  out.smallTargets = out.smallTargets.slice(0, 12)
  out.truncated = out.truncated.slice(0, 12)
  out.textSpill = out.textSpill.slice(0, 12)
  out.offscreen = out.offscreen.slice(0, 12)
  return out
}

export async function metrics(page) {
  return page.evaluate(metricsFn)
}

/** Scroll the active screen's main scroller to a fraction (0..1). Returns whether it scrolled. */
export async function scrollScreen(page, frac) {
  return page.evaluate((f) => {
    const frame = document.querySelector('[data-screen-frame]:not([inert])')
    if (!frame) return false
    const cands = [frame, ...frame.querySelectorAll('*')].filter((e) => {
      const cs = getComputedStyle(e)
      return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 4 && e.clientHeight > window.innerHeight * 0.4
    })
    if (!cands.length) return false
    let did = false
    for (const sc of cands) {
      sc.scrollTo({ top: (sc.scrollHeight - sc.clientHeight) * f, behavior: 'instant' })
      did = true
    }
    return did
  }, frac)
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
