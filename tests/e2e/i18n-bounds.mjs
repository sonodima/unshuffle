// i18n bounds suite: plays a REAL 2-player game per language (host desktop 1440×900,
// guest phone 390×844 @2x touch; home, lobby, final and the connection dialog also on a
// 360×740 phone, the host's lobby also at phone width) and, at every screen and state,
// runs an in-page detector over the visible text:
//
//   CLIPPED       text cut by its box: ellipsis / truncation (exact to the sub-pixel, like
//                 Chrome), line-clamp, cut by the nearest overflow-hidden ancestor, a vertical
//                 scroller that scrolls sideways, or text spilling out of its button / pill
//   OFFSCREEN     text crossing the viewport's left / right edge, or a page that scrolls sideways
//   OVERLAP       the text of one control (button, chip, tab, radio…) over another control, or
//                 two texts painted over each other (unless an opaque layer covers one entirely)
//   TOO-TALL      a single-line control (button, tab, radio, chip, badge / pill) whose label
//                 wraps (big CTAs: .btn-lg / .btn-xl may take 2 lines)
//   UNTRANSLATED  (not Italian) visible text / aria-label / placeholder / title / alt / screen-
//                 reader text equal to an Italian catalog message the locale translates differently
//                 (or doesn't have: the Italian fallback)
//   RAW-KEY       a catalog key ("lobby.start"), a {param} or a <tag> left in the text
//
// Ignored: player names, song / artist / album / playlist names (harvested from the Deezer
// responses), room codes, links, emoji and decorative aria-hidden text (not a catalog message);
// a truncation that only cuts such data (a long name shortened by design) is not reported.
// A layout finding must show, at the same place, in two samples 400 ms apart.
//
// Usage:
//   node tests/e2e/i18n-bounds.mjs <baseUrl> [locale ...] [--jobs N] [--headful]
//     locale: a code of LOCALES (src/i18n/locales.ts) or `pseudo` (a server of
//     tests/e2e/pseudo/vite.config.ts). Default: every locale the running app offers, found by
//     trying (a locale it doesn't have falls back to Italian: <html lang>); on the pseudo server
//     that is `pseudo`. --jobs N runs N locales at a time, each in its own process and browser.
//   node tests/e2e/i18n-bounds.mjs --selftest     the detector on a synthetic page (no server)
//   env QUERY='hits 2000' (playlist search) · HEADFUL=1 · I18N_TIMING=1 (ms per check)
//
//   npm run dev                                        # http://localhost:5173/
//   node tests/e2e/i18n-bounds.mjs http://localhost:5173/ it
//   node tests/e2e/i18n-bounds.mjs http://localhost:5173/ --jobs 3      # every offered locale, 3 at a time
//   npx vite --config tests/e2e/pseudo/vite.config.ts --port 5621
//   node tests/e2e/i18n-bounds.mjs http://localhost:5621/ pseudo
//
// Output: tests/e2e/i18n-report/<locale>.json (every finding with locale, viewport, player,
// state, rule, selector, text, catalog key, boxes, detail and crop), full screenshots
// tests/e2e/shots/i18n-<locale>-<viewport>-<state>.png, one crop per finding in
// tests/e2e/shots/i18n-crops/<locale>/ (text boxed in magenta, the box that cuts it in cyan),
// and a summary table. Exit code 1 if anything was found (or a run failed).
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ROOT, isPlural, loadCatalog, lookup, makeTranslator, messages, namespaces, pseudoCatalog } from './pseudo/catalogs.mjs'

const HERE = fileURLToPath(new URL('./', import.meta.url))
const SHOTS = `${HERE}shots/`
const CROPS = `${SHOTS}i18n-crops/`
const REPORTS = `${HERE}i18n-report/`
const RULES = ['CLIPPED', 'OFFSCREEN', 'OVERLAP', 'TOO-TALL', 'UNTRANSLATED', 'RAW-KEY']
const { LOCALES, LOCALE_INFO } = await import('../../src/i18n/locales.ts')

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  phone: { width: 390, height: 844 },
  'phone-sm': { width: 360, height: 740 },
}
const QUERY = process.env.QUERY ?? 'hits 2000'
/** Delay between the two detector samples: a finding must survive it. */
const STABLE_MS = 400
/** Crops per state (the rest of the findings are still reported, without a crop). */
const MAX_CROPS = 10

// ---------------------------------------------------------------- CLI

const argv = process.argv.slice(2)
const opts = { jobs: 1, child: false, headful: !!process.env.HEADFUL }
const positional = []
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--jobs' || a === '-j') opts.jobs = Number(argv[++i])
  else if (a.startsWith('--jobs=')) opts.jobs = Number(a.slice(7))
  else if (a === '--child') opts.child = true
  else if (a === '--headful') opts.headful = true
  else if (a === '--selftest') opts.selftest = true
  else if (a === '--help' || a === '-h') {
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\nimport ')[0].replace(/^\/\/ ?/gm, ''))
    process.exit(0)
  } else positional.push(a)
}
const BASE = positional[0] ?? 'http://localhost:5173/'
const requested = positional.slice(1)
if (!Number.isInteger(opts.jobs) || opts.jobs < 1) opts.jobs = 1

const T0 = Date.now()
/** Repo-relative path (for the report). */
const rel = (p) => (p.startsWith(ROOT) ? p.slice(ROOT.length) : p)
const stamp = () => `[${((Date.now() - T0) / 1000).toFixed(1).padStart(6)}s]`

// ---------------------------------------------------------------- catalogs & matching

const IT = await loadCatalog('it')
const NAMESPACES = namespaces()

function localeMeta(code) {
  if (code === 'pseudo') return { code, storage: 'it', tag: LOCALE_INFO.it.tag, name: LOCALE_INFO.it.name }
  if (!LOCALE_INFO[code]) return null
  return { code, storage: code, tag: LOCALE_INFO[code].tag, name: LOCALE_INFO[code].name }
}

const normalize = (s) => String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim()
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const formsOf = (v) => (typeof v === 'string' ? [v] : isPlural(v) ? Object.values(v) : [])
const TAGS = /<\/?\w+>/g
/** Params that always hold a number (a count, a place, a time…): they must match a digit. */
const NUMERIC = new Set(['count', 'number', 'total', 'round', 'rounds', 'seconds', 'points', 'gap', 'n', 'index', 'max', 'current', 'ready', 'done', 'need', 'min', 'minutes', 'position', 'pos', 'rank', 'time', 'value', 'accuracy', 'bpm', 'id', 'snippets', 'elapsed'])
const SPACED = new Set(['time', 'value', 'accuracy', 'rounds'])

/** Messages of a catalog as matchers: exact strings, and regexes for messages with {params}. */
export function buildMatcher(catalog) {
  const exact = new Map()
  const regs = []
  const add = (key, s) => {
    const text = normalize(s)
    const literal = text.replace(/\{\w+\}/g, '')
    if (!/\p{L}/u.test(literal)) return
    if (!/\{\w+\}/.test(text)) {
      if (!exact.has(text)) exact.set(text, key)
      return
    }
    const src = text
      .split(/(\{\w+\})/)
      .map((p) => {
        const m = /^\{(\w+)\}$/.exec(p)
        if (!m) return escapeRe(p)
        if (!NUMERIC.has(m[1])) return '.+?'
        return SPACED.has(m[1]) ? '\\S*\\d\\S*(?: \\S{1,6})?' : '\\S*\\d\\S*'
      })
      .join('')
    regs.push({ key, re: new RegExp(`^${src}$`, 'u'), lit: literal.length })
  }
  for (const { key, forms } of messages(catalog)) {
    for (const f of forms) {
      add(key, f.replace(TAGS, ''))
      const segs = f.split(TAGS).filter((x) => x.trim())
      if (segs.length > 1) for (const seg of segs) add(key, seg)
    }
  }
  regs.sort((a, b) => b.lit - a.lit)
  const cache = new Map()
  return (s) => {
    const text = normalize(s)
    if (!text) return null
    if (cache.has(text)) return cache.get(text)
    const key = exact.get(text) ?? regs.find((r) => r.re.test(text))?.key ?? null
    cache.set(text, key)
    return key
  }
}

// ---------------------------------------------------------------- in-page detector

/**
 * Runs in the page. Returns layout candidates (`items`), every visible / screen-reader
 * text and text attribute (`texts`, for UNTRANSLATED / RAW-KEY), and page metrics.
 * Self-contained: no closure over Node values.
 */
export function pageDetect({ scope, data, pseudo }) {
  const TOLX = 2.5
  const vw = document.documentElement.clientWidth
  const vh = document.documentElement.clientHeight
  const CONTROL =
    'button, a[href], [role="button"], [role="tab"], [role="radio"], [role="checkbox"], [role="switch"], [role="menuitem"], [role="option"], [role="link"], summary, select, textarea, input:not([type="hidden"])'
  const styles = new Map()
  const S = (el) => {
    let s = styles.get(el)
    if (!s) styles.set(el, (s = getComputedStyle(el)))
    return s
  }
  const rectOf = (el) => el.getBoundingClientRect()
  const R = (r) => (r ? { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.right - r.left), h: Math.round(r.bottom - r.top) } : null)
  const norm = (s) => s.replace(/\s+/g, ' ').trim()
  const rg = document.createRange()

  // ---- data (names, titles, codes, links, emoji): never translated, may be cut by design
  const dataList = data.filter((d) => d.length >= 3).map((d) => d.toLowerCase()).sort((a, b) => b.length - a.length)
  const isL = (c) => !!c && /\p{L}/u.test(c)
  const URLISH = /(?:https?:\/\/|www\.)\S+|\S*#\/r\/\S+/g
  const PICTO = /\p{Extended_Pictographic}|\p{Regional_Indicator}|‍|️|⃣/u
  const meaningful = (ch) => /[\p{L}\p{N}]/u.test(ch)
  function dataMask(text) {
    const mask = new Uint8Array(text.length)
    const lower = text.toLowerCase()
    for (const d of dataList) {
      // Whole words only: a song called "Ok" must not swallow "Book".
      for (let i = lower.indexOf(d); i >= 0; i = lower.indexOf(d, i + 1)) {
        if (isL(lower[i - 1]) || isL(lower[i + d.length])) continue
        let end = i + d.length
        // Pseudo-locale: a message that ends with a name / title gets its " ~~~]" after it; cutting
        // that padding is cutting the name (by design), not the translation.
        if (pseudo) end += /^ ?~*\]?/.exec(lower.slice(end))[0].length
        mask.fill(1, i, end)
      }
    }
    for (const m of text.matchAll(URLISH)) mask.fill(1, m.index, m.index + m[0].length)
    let i = 0
    for (const ch of text) {
      if (PICTO.test(ch)) mask.fill(1, i, i + ch.length)
      i += ch.length
    }
    return mask
  }
  function onlyData(text, mask) {
    let i = 0
    for (const ch of text) {
      if (meaningful(ch) && !mask[i]) return false
      i += ch.length
    }
    return true
  }

  // ---- visibility
  function alpha(el) {
    let a = 1
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      a *= parseFloat(S(e).opacity)
      if (a < 0.08) break
    }
    return a
  }
  function shown(el) {
    if (el.closest('[inert]')) return false
    const s = S(el)
    if (s.display === 'none' || s.visibility !== 'visible' || s.contentVisibility === 'hidden') return false
    return alpha(el) >= 0.08
  }
  function srOnly(el) {
    for (let e = el, i = 0; e && e.nodeType === 1 && i < 4; e = e.parentElement, i++) {
      const s = S(e)
      if (s.position === 'absolute' && (s.clipPath === 'inset(50%)' || s.clip === 'rect(0px, 0px, 0px, 0px)')) return true
      if (s.overflow !== 'visible' && s.display !== 'inline' && e.clientWidth <= 1 && e.clientHeight <= 1) return true
    }
    return false
  }

  // ---- geometry helpers
  function union(rects) {
    let u = null
    for (const r of rects) {
      if (!u) u = { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
      else {
        u.left = Math.min(u.left, r.left)
        u.top = Math.min(u.top, r.top)
        u.right = Math.max(u.right, r.right)
        u.bottom = Math.max(u.bottom, r.bottom)
      }
    }
    return u
  }
  function intersect(a, b) {
    if (!a || !b) return null
    const r = { left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) }
    return r.right > r.left && r.bottom > r.top ? r : null
  }
  function textRects(nodes) {
    const out = []
    for (const n of nodes) {
      rg.selectNodeContents(n)
      for (const r of rg.getClientRects()) if (r.width > 0.5 && r.height > 0.5) out.push(r)
    }
    return out
  }
  function lineCount(rects) {
    const lines = []
    for (const r of [...rects].sort((a, b) => a.top - b.top)) {
      const h = r.bottom - r.top
      const line = lines.find((l) => Math.min(l.bottom, r.bottom) - Math.max(l.top, r.top) > Math.min(h, l.bottom - l.top) * 0.5)
      if (line) {
        line.top = Math.min(line.top, r.top)
        line.bottom = Math.max(line.bottom, r.bottom)
      } else lines.push({ top: r.top, bottom: r.bottom })
    }
    return lines.length
  }
  /** Padding box in fractional pixels (clientWidth is rounded: a 12.1 px box reads 12). */
  const paddingBox = (a) => {
    const r = rectOf(a)
    const s = S(a)
    const bl = parseFloat(s.borderLeftWidth) || 0
    const br = parseFloat(s.borderRightWidth) || 0
    const bt = parseFloat(s.borderTopWidth) || 0
    const bb = parseFloat(s.borderBottomWidth) || 0
    // Classic scrollbars take whole pixels from the padding box.
    const sbx = Math.max(0, a.offsetWidth - a.clientWidth - Math.round(bl + br))
    const sby = Math.max(0, a.offsetHeight - a.clientHeight - Math.round(bt + bb))
    return { left: r.left + bl, top: r.top + bt, right: r.right - br - sbx, bottom: r.bottom - bb - sby }
  }
  /** A scale / skew / rotation on the element or an ancestor: bounding boxes are no longer exact. */
  const distorted = (el) => {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const s = S(e)
      if (s.transform !== 'none' && !/^matrix\(1, 0, 0, 1,|^matrix3d\(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0,/.test(s.transform)) return true
      if ((s.scale && s.scale !== 'none' && s.scale !== '1') || (s.rotate && s.rotate !== 'none' && s.rotate !== '0deg')) return true
    }
    return false
  }
  const transformed = (s) => s.transform !== 'none' || s.filter !== 'none' || s.perspective !== 'none' || /paint|layout|strict|content/.test(s.contain)

  /**
   * The first box that cuts text T, walking up from its element: overflow hidden / clip
   * (the element itself = truncated), a vertical scroller that also scrolls sideways; stops
   * (`scrolled`) at a horizontal strip or when the text is merely scrolled out of view.
   * Absolute / fixed elements escape the ancestors below their containing block.
   */
  function clipWalk(el, T, tolY) {
    let escape = null
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
      const s = S(a)
      if (a !== el && escape) {
        if (escape === 'fixed' && !transformed(s)) continue
        if (escape === 'abs' && s.position === 'static' && !transformed(s)) continue
        escape = null
      }
      const ox = s.overflowX
      const oy = s.overflowY
      if (!(ox === 'visible' && oy === 'visible') && s.display !== 'inline' && s.display !== 'contents') {
        if (a.clientWidth < 2 || a.clientHeight < 2) return { scrolled: true }
        const box = paddingBox(a)
        // An ellipsis replaces the end as soon as the text overflows by a fraction of a pixel
        // (exact only without a skew / scale around: those inflate bounding boxes).
        const ellipsis = s.textOverflow === 'ellipsis' && (ox === 'hidden' || ox === 'clip')
        const exact = ellipsis && !distorted(el)
        const outX = exact ? T.right > box.right + 0.05 || T.left < box.left - 0.05 : T.left < box.left - TOLX || T.right > box.right + TOLX
        const outY = T.top < box.top - tolY || T.bottom > box.bottom + tolY
        const kind = a === el ? 'truncated' : 'clipped'
        if ((ox === 'hidden' || ox === 'clip') && outX) return { by: a, box, axis: 'x', kind, ell: exact ? ellipsisWidth(a) : 0 }
        if ((oy === 'hidden' || oy === 'clip') && outY) return { by: a, box, axis: 'y', kind }
        if ((ox === 'auto' || ox === 'scroll') && outX) {
          // A vertical scroller that scrolls sideways too: text hidden off its side.
          if (a.scrollHeight > a.clientHeight + 1 && a.scrollWidth > a.clientWidth + 1) return { by: a, box, axis: 'x', kind: 'scrolls-sideways' }
          return { scrolled: true }
        }
        if ((oy === 'auto' || oy === 'scroll') && outY) return { scrolled: true }
      }
      if (s.position === 'fixed') escape = 'fixed'
      else if (s.position === 'absolute') escape = 'abs'
    }
    return null
  }

  const ellCache = new Map()
  /** Width of "…" in an element's font (what text-overflow: ellipsis draws). */
  function ellipsisWidth(e) {
    const s = S(e)
    const key = `${s.font}|${s.letterSpacing}`
    if (!ellCache.has(key)) {
      const probe = document.createElement('span')
      probe.textContent = '…'
      probe.style.cssText = `position:fixed;left:-9999px;top:0;white-space:pre;font:${s.font};letter-spacing:${s.letterSpacing};text-transform:${s.textTransform}`
      document.body.append(probe)
      ellCache.set(key, probe.getBoundingClientRect().width)
      probe.remove()
    }
    return ellCache.get(key)
  }

  /**
   * Characters of the text that are cut off by `box` — their centre is outside it; with
   * `edge`, any part more than TOLX outside (text spilling off a button); with `ell`, the
   * ones an ellipsis replaces — and whether all of them are data.
   */
  function cutChars(nodes, raw, mask, box, axis = 'xy', { edge = false, ell = 0 } = {}) {
    let count = 0
    let allData = true
    let cut = ''
    let offset = 0
    for (const n of nodes) {
      const s = n.data
      for (let i = 0; i < s.length; i++) {
        let j = i + 1
        if (/[\ud800-\udbff]/.test(s[i]) && j < s.length) j++
        const ch = s.slice(i, j)
        if (!/\s/.test(ch)) {
          rg.setStart(n, i)
          rg.setEnd(n, j)
          const r = rg.getBoundingClientRect()
          if (r.width > 0 || r.height > 0) {
            const cx = (r.left + r.right) / 2
            const cy = (r.top + r.bottom) / 2
            const outX =
              axis !== 'y' &&
              (ell ? r.right > box.right - ell + 0.5 : edge ? r.right > box.right + TOLX || r.left < box.left - TOLX : cx > box.right || cx < box.left)
            const outY = axis !== 'x' && (cy > box.bottom || cy < box.top)
            if (outX || outY) {
              count++
              if (cut.length < 80) cut += ch
              if (!mask[offset + i]) allData = false
            }
          }
        }
        i = j - 1
      }
      offset += s.length
    }
    return { count, allData, text: cut }
  }

  /** Nearest "pill": a painted box as round as it is tall (badges, chips, pills). */
  function pillOf(el) {
    for (let e = el, i = 0; e && e.nodeType === 1 && i < 3; e = e.parentElement, i++) {
      const s = S(e)
      const r = rectOf(e)
      if (r.height < 10) continue
      const painted = s.backgroundColor !== 'rgba(0, 0, 0, 0)' || s.backgroundImage !== 'none' || parseFloat(s.borderTopWidth) > 0
      if (painted && parseFloat(s.borderTopLeftRadius) >= r.height / 2 - 1 && r.width >= r.height * 0.9) return e
    }
    return null
  }
  /** Line budget of a control's label: 1 for buttons / tabs / radios / pills, 2 for big CTAs; null = no budget. */
  function lineBudget(k) {
    if (!k) return null
    if (k.classList.contains('btn')) return k.classList.contains('btn-icon') ? null : k.classList.contains('btn-lg') || k.classList.contains('btn-xl') ? 2 : 1
    const role = k.getAttribute('role')
    if (role === 'tab' || role === 'radio') return 1
    return null
  }

  // ---- stable selector (no text: comparable across languages)
  const SEM = /^(rv|sb|hm|tb|btn|ushf|fp|rs|ss|ht|glass)(-[\w-]+)?$|^(eyebrow|display|display-skew|num|emoji|truncate)$/
  const ATTRS = ['data-screen', 'data-phase', 'data-round-view', 'data-seg', 'data-index', 'data-pos', 'data-stage', 'data-first-submit-banner', 'data-shell-hud', 'data-modal-body', 'data-rv-board']
  const sels = new Map()
  function selPath(el) {
    if (!el || el.nodeType !== 1) return null
    if (sels.has(el)) return sels.get(el)
    const parts = []
    for (let e = el; e && e.nodeType === 1 && e !== document.body && parts.length < 16; e = e.parentElement) {
      let p = e.tagName.toLowerCase()
      if (e.id && /^[a-z][\w-]*$/i.test(e.id) && !/\d{2,}/.test(e.id)) {
        parts.unshift(`${p}#${e.id}`)
        break
      }
      for (const a of ATTRS) if (e.hasAttribute(a)) p += e.getAttribute(a) ? `[${a}="${e.getAttribute(a)}"]` : `[${a}]`
      const role = e.getAttribute('role')
      if (role) p += `[role="${role}"]`
      const cls = [...e.classList].filter((c) => SEM.test(c))
      if (cls.length) p += `.${cls.join('.')}`
      const parent = e.parentElement
      if (parent) {
        const same = [...parent.children].filter((c) => c.tagName === e.tagName)
        if (same.length > 1) p += `:nth-of-type(${same.indexOf(e) + 1})`
      }
      parts.unshift(p)
      if (e.hasAttribute('data-screen') || role === 'dialog') break
    }
    const s = parts.join(' > ')
    sels.set(el, s)
    return s
  }

  // ---- scan
  const roots = scope ? [...document.querySelectorAll(scope)].filter((r) => shown(r)) : [document.body]
  const items = []
  const texts = []
  const textSeen = new Set()
  const addText = (text, kind, el, extra) => {
    const t = norm(text)
    if (!t || textSeen.has(`${kind}|${t}`)) return
    textSeen.add(`${kind}|${t}`)
    texts.push({ text: t, kind, sel: selPath(el), box: el && kind !== 'document.title' ? R(rectOf(el)) : null, ...extra })
  }
  let textEls = 0
  const layerOf = (c) => {
    for (let e = c.parentElement; e && e !== document.documentElement; e = e.parentElement) {
      const s = S(e)
      if (s.position === 'fixed' || s.position === 'sticky') return e
      if (/auto|scroll/.test(s.overflowX + s.overflowY) && (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1)) return e
    }
    return document.documentElement
  }
  /** The painted part of `el`: the viewport ∩ every clipping box from `el` up. */
  const visibleRegion = (el, self = false) => {
    let v = { left: 0, top: 0, right: vw, bottom: vh }
    for (let e = self ? el : el.parentElement; e && e !== document.documentElement && v; e = e.parentElement) {
      const s = S(e)
      if ((s.overflowX !== 'visible' || s.overflowY !== 'visible') && s.display !== 'inline' && s.display !== 'contents') v = intersect(v, paddingBox(e))
    }
    return v
  }
  const painted = []
  for (const root of roots) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const seen = new Set()
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.data.trim()) continue
      const el = n.parentElement
      if (!el || seen.has(el)) continue
      seen.add(el)
      if (el.closest('script, style, noscript, template, svg, #__i18n_overlay')) continue
      const sr = srOnly(el)
      if (!sr && !shown(el)) continue
      const nodes = [...el.childNodes].filter((c) => c.nodeType === 3 && c.data.trim())
      const raw = nodes.map((c) => c.data).join('')
      const text = norm(raw)
      const ariaHidden = !!el.closest('[aria-hidden="true"]')
      addText(text, sr ? 'sr' : 'text', el, { ariaHidden })
      if (el.childElementCount && el.textContent.length <= 400) addText(el.textContent, 'full', el, { ariaHidden })
      if (sr) continue
      textEls++
      const rects = textRects(nodes)
      if (!rects.length) continue
      const T = union(rects)
      if (T.right <= 0 || T.left >= vw) continue // parked off screen (carousels, exits)
      const mask = dataMask(raw)
      if (onlyData(raw, mask)) continue
      const s = S(el)
      const fs = parseFloat(s.fontSize) || 14
      const tolY = Math.max(2, fs * 0.35)
      const base = {
        sel: selPath(el),
        text,
        full: el.childElementCount ? norm(el.textContent).slice(0, 200) : undefined,
        ariaHidden,
        fontSize: Math.round(fs * 10) / 10,
        box: R(rectOf(el)),
        textBox: R(T),
      }
      // For text-over-text overlaps: the visible line boxes of this text.
      if (alpha(el) >= 0.35 && /[\p{L}\p{N}]/u.test(text)) {
        const v = visibleRegion(el, true)
        const lines = v ? rects.map((r) => intersect(r, v)).filter(Boolean) : []
        if (lines.length) painted.push({ el, lines, box: union(lines), layer: layerOf(el), control: el.closest(CONTROL), ariaHidden })
      }
      let reported = false
      const clip = clipWalk(el, T, tolY)
      if (clip && !clip.scrolled) {
        const cut = cutChars(nodes, raw, mask, clip.box, clip.axis, { ell: clip.axis === 'x' && T.right > clip.box.right ? clip.ell : 0 })
        if (cut.count > 0) {
          reported = true
          if (!cut.allData) {
            const atEdge = (clip.box.right >= vw - 1 && T.right > vw + TOLX) || (clip.box.left <= 1 && T.left < -TOLX)
            items.push({
              ...base,
              rule: atEdge ? 'OFFSCREEN' : 'CLIPPED',
              kind: clip.kind,
              detail: `${clip.kind} (${clip.axis}) by ${clip.by === el ? 'itself' : selPath(clip.by)}; hidden: “${cut.text}”${s.textOverflow === 'ellipsis' ? ' [ellipsis]' : ''}${s.webkitLineClamp && s.webkitLineClamp !== 'none' ? ` [line-clamp ${s.webkitLineClamp}]` : ''}`,
              clipBox: R(clip.box),
              hidden: cut.text,
            })
          }
        }
      }
      if (!reported && !clip?.scrolled && (T.right > vw + TOLX || T.left < -TOLX)) {
        const cut = cutChars(nodes, raw, mask, { left: 0, top: -1e6, right: vw, bottom: 1e6 }, 'x')
        if (cut.count > 0) {
          reported = true
          if (!cut.allData) items.push({ ...base, rule: 'OFFSCREEN', kind: 'viewport', detail: `crosses the viewport edge (0–${vw}px); off screen: “${cut.text}”`, clipBox: { x: 0, y: 0, w: vw, h: vh }, hidden: cut.text })
        }
      }
      // Controls / pills: the label must stay on the face, within its line budget.
      const k = el.closest(CONTROL)
      const pill = k ? null : pillOf(el)
      const face = k ?? pill
      if (face && !reported) {
        let free = false
        for (let e = el; e && e !== face; e = e.parentElement) if (/absolute|fixed/.test(S(e).position)) free = true
        const fb = rectOf(face)
        if (!free && (T.left < fb.left - TOLX || T.right > fb.right + TOLX || T.top < fb.top - tolY || T.bottom > fb.bottom + tolY)) {
          const cut = cutChars(nodes, raw, mask, { left: fb.left, top: fb.top - tolY, right: fb.right, bottom: fb.bottom + tolY }, 'xy', { edge: true })
          if (cut.count > 0 && !cut.allData) {
            reported = true
            items.push({ ...base, rule: 'CLIPPED', kind: 'spill', detail: `spills out of ${selPath(face)}; outside: “${cut.text}”`, clipBox: R(fb), hidden: cut.text })
          }
        }
      }
      const budget = k ? lineBudget(k) : pill ? 1 : null
      if (budget != null) {
        const lines = lineCount(rects)
        if (lines > budget) items.push({ ...base, rule: 'TOO-TALL', kind: 'wraps', detail: `${lines} lines in ${selPath(face)} (max ${budget})`, clipBox: R(rectOf(face)), lines, budget })
      }
    }

    // ---- text attributes (UNTRANSLATED / RAW-KEY)
    for (const el of root.querySelectorAll('[aria-label], [placeholder], [title], [alt], [aria-description], [aria-roledescription], [aria-valuetext]')) {
      if (el.closest('#__i18n_overlay')) continue
      if (!shown(el) && !srOnly(el)) continue
      for (const a of ['aria-label', 'placeholder', 'title', 'alt', 'aria-description', 'aria-roledescription', 'aria-valuetext']) {
        const v = el.getAttribute(a)
        if (v && v.trim()) addText(v, a, el, {})
      }
    }

    // ---- OVERLAP: the text of a control over another control, in the same layer
    const ctrls = []
    for (const c of root.querySelectorAll(CONTROL)) {
      if (!shown(c) || srOnly(c) || c.closest('[aria-hidden="true"]')) continue
      const b = rectOf(c)
      if (b.width < 2 || b.height < 2 || b.bottom <= 0 || b.top >= vh || b.right <= 0 || b.left >= vw) continue
      const vis = visibleRegion(c)
      if (!vis) continue
      const rects = []
      const w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT)
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (!n.data.trim()) continue
        const pe = n.parentElement
        if (!pe || !shown(pe) || srOnly(pe) || onlyData(n.data, dataMask(n.data))) continue
        // Only the painted part: a truncated label's layout box runs past its ellipsis.
        let region = { left: -1e6, top: -1e6, right: 1e6, bottom: 1e6 }
        for (let e = pe; e && e !== c && region; e = e.parentElement) {
          const s = S(e)
          if ((s.overflowX !== 'visible' || s.overflowY !== 'visible') && s.display !== 'inline') region = intersect(region, paddingBox(e))
        }
        if (!region) continue
        rg.selectNodeContents(n)
        for (const r of rg.getClientRects()) {
          const v = r.width > 0.5 ? intersect(r, region) : null
          if (v) rects.push(v)
        }
      }
      ctrls.push({ c, b: intersect(b, vis), tb: rects.length ? intersect(union(rects), vis) : null, layer: layerOf(c) })
    }
    for (const A of ctrls) {
      if (!A.tb) continue
      for (const B of ctrls) {
        if (A === B || !B.b || A.layer !== B.layer || A.c.contains(B.c) || B.c.contains(A.c)) continue
        const I = intersect(A.tb, B.b)
        if (!I || I.right - I.left <= 3 || I.bottom - I.top <= 3) continue
        const top = document.elementFromPoint((I.left + I.right) / 2, (I.top + I.bottom) / 2)
        if (!top || !(A.c.contains(top) || B.c.contains(top))) continue
        items.push({
          rule: 'OVERLAP',
          kind: 'overlap',
          sel: selPath(A.c),
          text: norm(A.c.textContent).slice(0, 120),
          other: selPath(B.c),
          otherText: norm(B.c.textContent || B.c.getAttribute('aria-label') || '').slice(0, 120),
          detail: `text of ${selPath(A.c)} over ${selPath(B.c)} (${Math.round(I.right - I.left)}×${Math.round(I.bottom - I.top)} px)`,
          textBox: R(A.tb),
          box: R(rectOf(A.c)),
          clipBox: R(B.b),
          overlapBox: R(I),
        })
      }
    }
  }

  // ---- OVERLAP: two texts painted on top of each other (same layer, same line height band).
  // Hit-testing must see every element, pointer-events: none included.
  const hitStyle = document.createElement('style')
  hitStyle.textContent = '*{pointer-events:auto!important}'
  document.head.append(hitStyle)
  const opaque = (e) => {
    const s = S(e)
    const m = /rgba?\(([^)]+)\)/.exec(s.backgroundColor)
    const a = m ? (m[1].split(/[ ,/]+/).length > 3 ? parseFloat(m[1].split(/[ ,/]+/)[3]) : 1) : 0
    return a >= 0.6 || /gradient|url\(/.test(s.backgroundImage)
  }
  /** Does the element paint anything of its own (background, border, image, text)? */
  const paints = (e) => {
    const s = S(e)
    if (/^(IMG|CANVAS|SVG|VIDEO|svg)$/.test(e.tagName) || s.backgroundImage !== 'none' || parseFloat(s.borderTopWidth) + parseFloat(s.borderLeftWidth) > 0) return true
    const m = /rgba?\(([^)]+)\)/.exec(s.backgroundColor)
    if (m && (m[1].split(/[ ,/]+/).length < 4 || parseFloat(m[1].split(/[ ,/]+/)[3]) > 0.05)) return true
    return [...e.childNodes].some((c) => c.nodeType === 3 && c.data.trim())
  }
  for (let i = 0; i < painted.length; i++) {
    const A = painted[i]
    for (let j = i + 1; j < painted.length; j++) {
      const B = painted[j]
      // (texts of two different controls: the control check above)
      if (A.layer !== B.layer || (A.control && B.control && A.control !== B.control)) continue
      if (A.el.contains(B.el) || B.el.contains(A.el) || !intersect(A.box, B.box)) continue
      let hit = null
      for (const a of A.lines) {
        for (const b of B.lines) {
          const I = intersect(a, b)
          // (italic / skewed display glyphs of neighbouring spans overhang each other a little)
          const minW = Math.min(a.right - a.left, b.right - b.left)
          if (I && I.right - I.left > Math.max(4, 0.3 * minW) && I.bottom - I.top > 0.4 * Math.min(a.bottom - a.top, b.bottom - b.top)) hit = I
        }
      }
      if (!hit) continue
      // One of the two must be the topmost thing painted there, and must not hide the other
      // under an opaque background (a banner laid over the HUD labels on purpose).
      let upper = null
      for (const e of document.elementsFromPoint((hit.left + hit.right) / 2, (hit.top + hit.bottom) / 2)) {
        if (A.el.contains(e)) upper = A
        else if (B.el.contains(e)) upper = B
        else if (!paints(e)) continue // a transparent layer (hit area, positioning box)
        break
      }
      if (!upper) continue
      let common = A.el.parentElement
      while (common && !common.contains(B.el)) common = common.parentElement
      // An opaque layer that hides the other text completely is on purpose (a banner over the
      // HUD); one that covers part of it (a chip grown over a letter) is the bug.
      const lower = upper === A ? B : A
      let cover = null
      for (let e = upper.el; e && e !== common && !cover; e = e.parentElement) if (opaque(e)) cover = e
      if (cover) {
        const cb = rectOf(cover)
        if (lower.box.left >= cb.left - 1 && lower.box.right <= cb.right + 1 && lower.box.top >= cb.top - 1 && lower.box.bottom <= cb.bottom + 1) continue
      }
      items.push({
        rule: 'OVERLAP',
        kind: 'text',
        sel: selPath(A.el),
        text: norm(A.el.textContent).slice(0, 120),
        other: selPath(B.el),
        otherText: norm(B.el.textContent).slice(0, 120),
        ariaHidden: A.ariaHidden,
        otherAriaHidden: B.ariaHidden,
        detail: `text over text: ${selPath(B.el)} “${norm(B.el.textContent).slice(0, 60)}” (${Math.round(hit.right - hit.left)}×${Math.round(hit.bottom - hit.top)} px)`,
        textBox: R(A.box),
        box: R(rectOf(A.el)),
        clipBox: R(B.box),
        overlapBox: R(hit),
      })
    }
  }
  hitStyle.remove()

  // ---- the page itself must never scroll sideways
  const se = document.scrollingElement
  if (se.scrollWidth > se.clientWidth + 1) {
    const wide = [...document.body.querySelectorAll('*')].filter((e) => rectOf(e).right > se.clientWidth + 1 && shown(e)).slice(0, 3)
    items.push({
      rule: 'OFFSCREEN',
      kind: 'page',
      sel: 'html',
      text: '(the page scrolls sideways)',
      detail: `document scrollWidth ${se.scrollWidth} > ${se.clientWidth}; widest: ${wide.map((e) => selPath(e)).join(' | ')}`,
      box: { x: 0, y: 0, w: se.scrollWidth, h: vh },
      textBox: null,
      clipBox: { x: 0, y: 0, w: vw, h: vh },
    })
  }
  addText(document.title, 'document.title', null, {})
  return { items, texts, stats: { textEls, vw, vh, lang: document.documentElement.lang } }
}

/**
 * Findings from a detector sample: drops data / decorative / one-letter text, attaches the
 * catalog key, and adds UNTRANSLATED / RAW-KEY from the texts and text attributes.
 * env: { isItalian, catalog (the locale's), matchLoc, matchIt, isDataText(text, key) }.
 */
export function classify(sample, ctx, { isItalian, catalog, matchLoc, matchIt, isDataText }) {
  const out = []
  for (const f of sample.items) {
    const key = f.rule === 'OVERLAP' ? matchLoc(f.text) : (matchLoc(f.text) ?? (f.full ? matchLoc(f.full) : null))
    if (f.rule === 'OVERLAP' && f.kind === 'text') {
      // Two names (or two snippet letters) on top of each other: not a translation matter.
      const minor = (t) => isDataText(t, matchLoc(t)) || ((t.match(/\p{L}/gu) ?? []).length <= 1 && !/\d/.test(t) && !matchLoc(t))
      if (minor(f.text) && minor(f.otherText)) continue
      // Decorative (aria-hidden, not a catalog message) on both sides.
      if (f.ariaHidden && f.otherAriaHidden && !matchLoc(f.text) && !matchLoc(f.otherText)) continue
    }
    if (f.rule !== 'OVERLAP' && f.text !== '(the page scrolls sideways)') {
      if (isDataText(f.text, key)) continue
      if (f.ariaHidden && !key) continue // decorative
      if ((f.text.match(/\p{L}/gu) ?? []).length <= 1 && !/\d/.test(f.text) && !key) continue
    }
    out.push({ ...ctx, rule: f.rule, selector: f.sel, text: f.text, key, detail: f.detail, other: f.other, otherText: f.otherText, boxes: { element: f.box, text: f.textBox, clip: f.clipBox, overlap: f.overlapBox }, fontSize: f.fontSize })
  }
  const seen = new Set()
  for (const x of sample.texts) {
    const t = x.text
    if (!/\p{L}/u.test(t) || seen.has(t)) continue
    seen.add(t)
    // RAW-KEY: a key, a {param} or a <tag> left in what the user sees / hears.
    const first = t.split('.')[0]
    let raw = null
    if (x.kind === 'full') raw = null
    else if (/^[a-z]+(\.[a-zA-Z0-9]+)+$/.test(t) && (NAMESPACES.includes(first) || lookup(IT, t) !== undefined)) raw = 'catalog key'
    else if (/\{[a-zA-Z_]\w*\}/.test(t)) raw = '{param} left in the text'
    else if (/<\/?[a-z][a-z0-9]*>/i.test(t)) raw = '<tag> left in the text'
    if (raw) {
      out.push({ ...ctx, rule: 'RAW-KEY', selector: x.sel, text: t, key: null, detail: `${raw} (${x.kind})`, boxes: { element: x.box } })
      continue
    }
    if (isItalian || matchLoc(t)) continue
    const itKey = matchIt(t)
    if (!itKey || isDataText(t, itKey)) continue
    const locForms = formsOf(lookup(catalog, itKey))
    const itForms = formsOf(lookup(IT, itKey))
    const same = locForms.length > 0 && itForms.every((f) => locForms.includes(f))
    if (same) continue
    out.push({
      ...ctx,
      rule: 'UNTRANSLATED',
      selector: x.sel,
      text: t,
      key: itKey,
      detail: `${x.kind}: Italian text of ${itKey}${locForms.length ? `, the locale says “${normalize(locForms[0].replace(TAGS, '')).slice(0, 80)}”` : ' (missing in the locale: Italian fallback)'}`,
      boxes: { element: x.box },
    })
  }
  return out
}

// ---------------------------------------------------------------- one locale

async function runLocale(code, { headful }) {
  const meta = localeMeta(code)
  if (!meta) throw new Error(`unknown locale "${code}" (LOCALES: ${LOCALES.join(', ')}, or pseudo)`)
  const started = Date.now()
  const isPseudo = code === 'pseudo'
  const isItalian = code === 'it'
  const catalog = isPseudo ? pseudoCatalog(IT) : isItalian ? IT : await loadCatalog(code)
  if (!catalog) throw new Error(`no catalog folder src/i18n/locales/${code}`)
  const L = makeTranslator(catalog, isPseudo ? catalog : IT, meta.tag)
  const P = (key, params) => L.plain(key, params)
  const matchLoc = buildMatcher(catalog)
  const matchIt = buildMatcher(IT)
  const log = (...a) => console.log(stamp(), `[${code}]`, ...a)

  mkdirSync(SHOTS, { recursive: true })
  mkdirSync(REPORTS, { recursive: true })
  const cropDir = `${CROPS}${code}/`
  rmSync(cropDir, { recursive: true, force: true })
  mkdirSync(cropDir, { recursive: true })
  for (const f of readdirSync(SHOTS)) if (f.startsWith(`i18n-${code}-`)) rmSync(`${SHOTS}${f}`, { force: true })

  const report = {
    locale: code,
    tag: meta.tag,
    baseUrl: BASE,
    startedAt: new Date(started).toISOString(),
    durationMs: 0,
    htmlLang: null,
    states: [],
    findings: [],
    counts: Object.fromEntries(RULES.map((r) => [r, 0])),
    errors: [],
    console: [],
  }

  // Strings that are never translated: player names, Deezer titles / names, the room code, links.
  const data = new Set(['UNSHUFFLE', 'BPM', 'Deezer'])
  const addData = (s) => {
    const t = normalize(s)
    if (t.length < 2) return
    data.add(t)
    const bare = normalize(t.replace(/\s*[([].*?[)\]]\s*/g, ' ').replace(/\s+[-–—]\s+.*$/, ''))
    if (bare.length >= 2) data.add(bare)
  }
  const harvest = (node, key) => {
    if (typeof node === 'string') {
      if (key === 'title' || key === 'title_short' || key === 'name' || key === 'title_version') addData(node)
    } else if (Array.isArray(node)) node.forEach((x) => harvest(x, key))
    else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) harvest(v, k)
  }
  /** Text that is only names / titles / codes / links / emoji (a catalog message is never data, unless it IS a title). */
  const isDataText = (t, uiKey = null) => {
    if (data.has(t)) return true
    if (uiKey) return false
    const low = t.toLowerCase()
    if (low.length >= 3) for (const d of data) if (d.toLowerCase().includes(low)) return true
    let rest = low
    for (const d of [...data].sort((a, b) => b.length - a.length)) rest = rest.split(d.toLowerCase()).join(' ')
    rest = rest.replace(/(?:https?:\/\/|www\.)\S+|\S*#\/r\/\S+/g, ' ').replace(/\p{Extended_Pictographic}|\p{Regional_Indicator}/gu, ' ')
    return !/\p{L}/u.test(rest)
  }

  const browser = await chromium.launch({ channel: 'chrome', headless: !headful, args: ['--autoplay-policy=no-user-gesture-required'] })
  async function openPlayer(who, device) {
    const ctx = await browser.newContext({ locale: meta.tag, ...device })
    await ctx.addInitScript(
      ([locale]) => {
        try {
          localStorage.setItem('unshuffle:onboarded', String(Date.now()))
          localStorage.setItem('unshuffle:locale', locale)
        } catch {
          /* ignore */
        }
      },
      [meta.storage],
    )
    const page = await ctx.newPage()
    page.setDefaultTimeout(15_000)
    page.on('dialog', (d) => void d.accept().catch(() => {}))
    page.on('pageerror', (e) => report.errors.push(`[${who}] pageerror: ${e.message}`))
    page.on('console', (m) => {
      if (m.type() === 'error') report.console.push(`[${who}] ${m.text().slice(0, 300)}`)
    })
    page.on('response', async (res) => {
      if (!/api\.deezer\.com/.test(res.url())) return
      try {
        const body = (await res.text()).trim()
        const json = /^[[{]/.test(body) ? JSON.parse(body) : JSON.parse(body.slice(body.indexOf('(') + 1, body.lastIndexOf(')')))
        harvest(json)
      } catch {
        /* not JSON(P) */
      }
    })
    return page
  }
  const host = await openPlayer('host', { viewport: VIEWPORTS.desktop })
  const guest = await openPlayer('guest', { viewport: VIEWPORTS.phone, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const vpOf = (page) => (page === guest ? (page.viewportSize().width <= 360 ? 'phone-sm' : 'phone') : page.viewportSize().width < 1024 ? 'phone' : 'desktop')
  const whoOf = (page) => (page === host ? 'host' : 'guest')

  // -------------------------------------------------------------- checking a state
  const kept = new Map()
  async function settle(page, ms = 250) {
    await page.waitForTimeout(ms)
    await page
      .evaluate(async () => {
        await document.fonts.ready
        const t0 = performance.now()
        while (performance.now() - t0 < 1500) {
          const busy = document.getAnimations().some((a) => {
            if (a.playState !== 'running') return false
            const t = a.effect?.getComputedTiming?.()
            return t && Number.isFinite(t.endTime) && t.activeDuration < 4000
          })
          if (!busy) return
          await new Promise((r) => setTimeout(r, 80))
        }
      })
      .catch(() => {})
  }



  /** Detects, screenshots and records one state of one page. `group` merges scroll steps. */
  async function check(page, state, { scope = null, group = state, wait = 250 } = {}) {
    const viewport = vpOf(page)
    const who = whoOf(page)
    const name = `${state}${who === 'host' && viewport !== 'desktop' ? '-host' : ''}`
    const shot = `${SHOTS}i18n-${code}-${viewport}-${name}.png`
    try {
      // No hover effects / tooltips from wherever the last click left the mouse.
      if (page === host) await page.mouse.move(page.viewportSize().width / 2, 1)
      await settle(page, wait)
      const args = { scope, data: [...data], pseudo: isPseudo }
      const t0 = Date.now()
      const a = await page.evaluate(pageDetect, args)
      const t1 = Date.now()
      await page.waitForTimeout(STABLE_MS)
      const b = await page.evaluate(pageDetect, args)
      const t2 = Date.now()
      // Same finding, same place: something still moving (a slide, a scale-in) is not kept.
      const at = (b) => (b ? `${Math.round(b.x / 3)},${Math.round(b.y / 3)},${Math.round(b.w / 3)}` : '')
      const id = (f) => `${f.rule}|${f.sel}|${f.text}|${at(f.textBox)}`
      const inA = new Set(a.items.map(id))
      const stable = { items: b.items.filter((f) => inA.has(id(f))), texts: [...a.texts, ...b.texts] }
      if (!report.htmlLang) report.htmlLang = b.stats.lang
      await page.screenshot({ path: shot })
      const found = classify(stable, { locale: code, viewport, who, state: name }, { isItalian, catalog, matchLoc, matchIt, isDataText })
      const fresh = []
      for (const f of found) {
        const k = `${viewport}|${who}|${group}|${f.rule}|${f.selector}|${f.text}`
        if (kept.has(k)) continue
        kept.set(k, f)
        fresh.push(f)
      }
      const t3 = Date.now()
      await crop(page, fresh, `${viewport}-${name}`)
      const ms = { detect: t1 - t0 + (t2 - t1 - STABLE_MS), shot: t3 - t2, crops: Date.now() - t3 }
      report.findings.push(...fresh)
      report.states.push({ state: name, viewport, who, shot: rel(shot), textElements: b.stats.textEls, findings: fresh.length, ms })
      const counts = RULES.map((r) => [r, fresh.filter((f) => f.rule === r).length]).filter(([, n]) => n)
      const timing = process.env.I18N_TIMING ? `  (${ms.detect}+${ms.shot}+${ms.crops} ms)` : ''
      log(`${viewport.padEnd(8)} ${who.padEnd(5)} ${name.padEnd(24)} ${counts.length ? counts.map(([r, n]) => `${r} ${n}`).join(' · ') : 'clean'}${timing}`)
    } catch (err) {
      report.errors.push(`${viewport}/${who}/${name}: ${err.message.split('\n')[0]}`)
      log(`!! ${viewport} ${who} ${name}: ${err.message.split('\n')[0]}`)
    }
  }

  /** One cropped screenshot per finding (distinct messages first), its text boxed in magenta, the box that cuts it in cyan. */
  async function crop(page, findings, prefix) {
    const vp = page.viewportSize()
    const seen = new Set()
    const order = [...findings.filter((f) => !seen.has(`${f.rule}|${f.key ?? f.text}`) && seen.add(`${f.rule}|${f.key ?? f.text}`)), ...findings]
    const picked = [...new Set(order)].filter((f) => f.boxes.text ?? f.boxes.element).slice(0, MAX_CROPS)
    let n = 0
    for (const f of picked) {
      const t = f.boxes.text ?? f.boxes.element
      const c = f.boxes.clip
      if (t.y + t.h <= 0 || t.y >= vp.height || t.x + t.w <= 0 || t.x >= vp.width) continue // scrolled out of view
      // The cutting box only when it is about the size of the text (not a whole screen).
      const boxes = c && c.w * c.h <= Math.max(8 * t.w * t.h, 160 * 160) ? [t, c] : [t]
      const x0 = Math.max(0, Math.min(...boxes.map((b) => b.x)) - 24)
      const y0 = Math.max(0, Math.min(...boxes.map((b) => b.y)) - 24)
      const x1 = Math.min(vp.width, Math.max(...boxes.map((b) => b.x + b.w)) + 24)
      const y1 = Math.min(vp.height, Math.max(...boxes.map((b) => b.y + b.h)) + 24)
      if (x1 - x0 < 8 || y1 - y0 < 8) continue
      await page.evaluate(
        ([t, c]) => {
          let layer = document.getElementById('__i18n_overlay')
          if (!layer) {
            layer = document.createElement('div')
            layer.id = '__i18n_overlay'
            layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647'
            document.documentElement.append(layer)
          }
          const mark = (b, style) => (b ? `<div style="position:fixed;left:${b.x - 1}px;top:${b.y - 1}px;width:${b.w + 2}px;height:${b.h + 2}px;outline:${style}"></div>` : '')
          layer.innerHTML = mark(c, '2px dashed #2ee6ff') + mark(t, '2px solid #ff00aa')
        },
        [t, c ?? null],
      )
      const file = `${cropDir}${prefix}-${String(++n).padStart(2, '0')}-${f.rule}.png`
      try {
        await page.screenshot({ path: file, clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } })
        f.crop = rel(file)
      } catch {
        /* element went away */
      }
    }
    await page.evaluate(() => document.getElementById('__i18n_overlay')?.remove())
  }

  async function onSmallPhone(fn) {
    await guest.setViewportSize(VIEWPORTS['phone-sm'])
    try {
      await fn()
    } finally {
      await guest.setViewportSize(VIEWPORTS.phone)
      await guest.waitForTimeout(250)
    }
  }
  async function atPhoneWidth(page, fn) {
    await page.setViewportSize(VIEWPORTS.phone)
    try {
      await fn()
    } finally {
      await page.setViewportSize(VIEWPORTS.desktop)
      await page.waitForTimeout(300)
    }
  }
  /** Scroll the page's main scroller step by step and check every step (below-the-fold content animates in). */
  async function checkScrolled(page, state, steps = 3) {
    const n = await page.evaluate(() => {
      const f = document.querySelector('[data-screen-frame]:not([inert])')
      const all = [f, ...(f?.querySelectorAll('*') ?? [])].filter((e) => e && /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 40)
      const sc = all.sort((a, b) => b.clientHeight - a.clientHeight)[0]
      if (!sc) return 0
      sc.setAttribute('data-i18n-scroller', '')
      return Math.ceil((sc.scrollHeight - sc.clientHeight) / (sc.clientHeight * 0.8))
    })
    if (!n) return check(page, `${state}-bottom`, { group: state })
    const count = Math.min(steps, n)
    for (let i = 1; i <= count; i++) {
      await page.evaluate(
        ([i, count]) => {
          const sc = document.querySelector('[data-i18n-scroller]')
          sc?.scrollTo({ top: ((sc.scrollHeight - sc.clientHeight) * i) / count, behavior: 'instant' })
        },
        [i, count],
      )
      await check(page, `${state}-scroll${i}`, { group: state, wait: 700 })
    }
    await page.evaluate(() => {
      const sc = document.querySelector('[data-i18n-scroller]')
      sc?.scrollTo({ top: 0, behavior: 'instant' })
      sc?.removeAttribute('data-i18n-scroller')
    })
  }

  // -------------------------------------------------------------- driving the game
  const frame = (page, screen) => page.locator(`[data-screen-frame][data-screen="${screen}"]:not([inert])`)
  const waitScreen = (page, screen, timeout = 30_000) => frame(page, screen).waitFor({ state: 'visible', timeout })
  const waitPhase = (page, kind, timeout = 90_000) =>
    page.waitForFunction((k) => document.querySelector(`[data-screen-frame]:not([inert]) [data-phase="${k}"]`) !== null, kind, { timeout, polling: 100 })
  const dialog = (page) => page.locator('[role="dialog"][aria-modal="true"]').last()
  const DIALOG = '[role="dialog"][aria-modal="true"]'
  const tap = (page, locator) => (page === guest ? locator.tap() : locator.click())
  async function closeDialog(page) {
    await page.keyboard.press('Escape')
    await dialog(page).waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(250)
  }
  async function openDialog(page, locator) {
    await tap(page, locator)
    await dialog(page).waitFor({ state: 'visible', timeout: 8000 })
    await page.waitForTimeout(450)
  }
  const confirmButton = (page) => page.locator('[data-screen-frame]:not([inert]) [data-round-view="playing"] button[aria-keyshortcuts]').first()
  async function confirm(page) {
    const btn = confirmButton(page)
    await btn.waitFor({ state: 'visible', timeout: 10_000 })
    await tap(page, btn)
    await page.waitForTimeout(250)
    if ((await btn.count()) && (await btn.getAttribute('data-armed').catch(() => null)) !== null) await tap(page, btn)
  }
  /** Drag a board block from one position to another: CDP touch events (a finger), else the mouse. */
  async function touchDrag(page, from, to, steps = 16) {
    const center = async (pos) => {
      const box = await page.locator(`[data-screen-frame]:not([inert]) [data-round-view="playing"] .sb-item[data-pos="${pos}"]`).boundingBox()
      if (!box) throw new Error(`no block at position ${pos}`)
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    }
    const a = await center(from)
    const b = await center(to)
    const at = (i) => ({ x: a.x + ((b.x - a.x) * i) / steps, y: a.y + ((b.y - a.y) * i) / steps })
    let cdp = null
    for (let attempt = 0; attempt < 2 && !cdp; attempt++) cdp = await page.context().newCDPSession(page).catch(() => null)
    if (cdp) {
      const pt = ({ x, y }) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }]
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(a) })
      for (let i = 1; i <= steps; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(at(i)) })
        await page.waitForTimeout(16)
      }
      await page.waitForTimeout(120)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await cdp.detach().catch(() => {})
    } else {
      await page.mouse.move(a.x, a.y)
      await page.mouse.down()
      for (let i = 1; i <= steps; i++) {
        await page.mouse.move(at(i).x, at(i).y)
        await page.waitForTimeout(16)
      }
      await page.waitForTimeout(120)
      await page.mouse.up()
    }
    await page.waitForTimeout(450)
  }
  async function setRadio(page, group, index) {
    const g = page.getByRole('radiogroup', { name: P(group), exact: true }).first()
    await g.locator(`[role="radio"][data-seg="${index}"]`).first().click()
    await page.waitForTimeout(150)
  }

  try {
    // ------------------------------------------------------------ home
    await Promise.all([host.goto(BASE, { waitUntil: 'load' }), guest.goto(BASE, { waitUntil: 'load' })])
    await Promise.all([waitScreen(host, 'home'), waitScreen(guest, 'home')])
    const lang = await guest.evaluate(() => document.documentElement.lang)
    report.htmlLang = lang
    if (lang !== meta.tag) throw new Error(`the app is not in ${code}: <html lang="${lang}"> (expected ${meta.tag}): not offered by ${BASE}`)
    const create = host.getByRole('button', { name: P('home.create.button'), exact: true })
    if (!(await create.count())) throw new Error(`no “${P('home.create.button')}” button: the page does not show the ${code} catalog${isPseudo ? ' (is this the pseudo server?)' : ''}`)
    // Long names (16 = MAX_NAME_LENGTH) stress every row that shows one.
    const NAMES = { host: 'Bartolomeo Rossi', guest: 'Mariagrazia Neri' }
    for (const [who, page] of [
      ['host', host],
      ['guest', guest],
    ]) {
      await page.locator('[data-screen-frame]:not([inert]) input[maxlength="16"]').first().fill(NAMES[who])
      addData(NAMES[who])
    }
    for (const page of [host, guest]) await page.evaluate(() => document.activeElement?.blur())
    await host.waitForTimeout(900)
    await Promise.all([check(host, 'home'), check(guest, 'home')])
    await onSmallPhone(() => check(guest, 'home'))

    // how to play
    await Promise.all([openDialog(host, host.getByRole('button', { name: P('home.help'), exact: true })), openDialog(guest, guest.getByRole('button', { name: P('home.help'), exact: true }))])
    await Promise.all([check(host, 'home-howto', { scope: DIALOG }), check(guest, 'home-howto', { scope: DIALOG })])
    await onSmallPhone(() => check(guest, 'home-howto', { scope: DIALOG }))
    await Promise.all([closeDialog(host), closeDialog(guest)])

    // avatar picker
    await Promise.all([openDialog(host, host.getByRole('button', { name: P('home.profile.changeAvatar'), exact: true })), openDialog(guest, guest.getByRole('button', { name: P('home.profile.changeAvatar'), exact: true }))])
    await Promise.all([check(host, 'home-avatar', { scope: DIALOG }), check(guest, 'home-avatar', { scope: DIALOG })])
    await onSmallPhone(() => check(guest, 'home-avatar', { scope: DIALOG }))
    await Promise.all([closeDialog(host), closeDialog(guest)])

    // language picker: the sheet, and the picker itself (current language checked, options by their own names)
    const langButton = (page) => page.getByRole('button', { name: P('ui.language.button', { language: meta.name }), exact: true }).first()
    await Promise.all([openDialog(host, langButton(host)), openDialog(guest, langButton(guest))])
    const picker = await guest.evaluate(() => {
      const radios = [...document.querySelectorAll('[role="dialog"] [role="radio"]')]
      return radios.map((r) => ({ name: r.textContent.trim(), lang: r.querySelector('[lang]')?.getAttribute('lang'), checked: r.getAttribute('aria-checked') === 'true' }))
    })
    const checked = picker.filter((o) => o.checked)
    if (checked.length !== 1 || checked[0].name !== meta.name || checked[0].lang !== meta.tag)
      report.errors.push(`language picker: expected exactly “${meta.name}” (${meta.tag}) checked, got ${JSON.stringify(picker)}`)
    report.languagePicker = picker
    await Promise.all([check(host, 'home-language', { scope: DIALOG }), check(guest, 'home-language', { scope: DIALOG })])
    await onSmallPhone(() => check(guest, 'home-language', { scope: DIALOG }))
    // Picking the current language just closes the sheet.
    await guest.locator(`${DIALOG} [role="radio"][aria-checked="true"]`).tap()
    await dialog(guest).waitFor({ state: 'hidden', timeout: 5000 }).catch(() => report.errors.push('language picker: picking the current language did not close the sheet'))
    await closeDialog(host)

    // invalid code: incomplete (both), then a code no room has (phone)
    const codeBox = (page) => page.getByRole('textbox', { name: P('ui.codeInput.letter', { label: P('ui.codeInput.label'), index: 1, count: 5 }), exact: true })
    const joinButton = (page) => page.getByRole('button', { name: P('home.join.button'), exact: true })
    for (const page of [host, guest]) {
      await tap(page, codeBox(page))
      await page.keyboard.type('ab', { delay: 40 })
      await tap(page, joinButton(page))
    }
    await Promise.all([host, guest].map((p) => p.getByText(P('home.join.incomplete', { count: 5 })).first().waitFor({ timeout: 5000 })))
    await Promise.all([check(host, 'home-code-incomplete'), check(guest, 'home-code-incomplete')])
    await onSmallPhone(() => check(guest, 'home-code-incomplete'))
    await Promise.all([host, guest].map((p) => p.goto(BASE, { waitUntil: 'load' })))
    await Promise.all([waitScreen(host, 'home'), waitScreen(guest, 'home')])
    await tap(guest, codeBox(guest))
    await guest.keyboard.type('zqzqz', { delay: 40 })
    await guest.waitForTimeout(200)
    await tap(guest, joinButton(guest))
    const notFound = await guest
      .locator('[data-screen-frame]:not([inert]) [role="alert"]')
      .first()
      .waitFor({ timeout: 25_000 })
      .then(() => true)
      .catch(() => false)
    if (notFound) {
      await check(guest, 'home-room-not-found')
      await onSmallPhone(() => check(guest, 'home-room-not-found'))
    } else report.errors.push('home: joining an unknown room showed no error within 25 s')
    await guest.goto(BASE, { waitUntil: 'load' })
    await waitScreen(guest, 'home')

    // ------------------------------------------------------------ lobby
    await create.click()
    await waitScreen(host, 'lobby', 30_000)
    const code5 = await host.evaluate(() => /#\/r\/([A-Z]{5})/.exec(location.hash)?.[1] ?? null)
    if (!code5) throw new Error('host: no room code after “create”')
    addData(code5)
    addData(await host.evaluate(() => location.href))
    log('room', code5)
    await tap(guest, codeBox(guest))
    await guest.keyboard.type(code5.toLowerCase(), { delay: 50 })
    await guest.waitForTimeout(250)
    await tap(guest, joinButton(guest))
    await waitScreen(guest, 'lobby', 30_000)

    const pickerSection = host.locator('section').filter({ has: host.getByRole('searchbox') }).first()
    const results = pickerSection.locator('ul:not([aria-hidden]) li button[aria-pressed]')
    await results.first().waitFor({ timeout: 20_000 }).catch(() => report.errors.push('lobby: the featured shelf did not load'))
    await host.waitForTimeout(800)
    await Promise.all([check(host, 'lobby'), check(guest, 'lobby-players')])
    await onSmallPhone(() => check(guest, 'lobby-players'))
    await checkScrolled(guest, 'lobby-players-scrolled', 2)
    // The host's lobby at phone width: tabs, chips row, featured shelf.
    await atPhoneWidth(host, () => check(host, 'lobby-picker'))

    // search results
    const search = host.getByRole('searchbox', { name: P('lobby.picker.searchLabel'), exact: true })
    await search.fill(QUERY)
    await host.getByText(P('lobby.picker.resultsFor', { query: QUERY })).first().waitFor({ timeout: 20_000 })
    await results.first().waitFor({ timeout: 20_000 })
    await host.waitForTimeout(900)
    await check(host, 'lobby-search')
    await atPhoneWidth(host, async () => {
      // A chip picked on the phone layout: selected chip + its results.
      const chip = host.getByRole('group', { name: P('lobby.picker.chips'), exact: true }).locator('button[aria-pressed]').nth(2)
      await search.fill('')
      await chip.click()
      await host.waitForTimeout(1500)
      await check(host, 'lobby-chip')
    })
    // (the picker re-mounts with the layout: search again)
    await search.fill(QUERY)
    await host.getByText(P('lobby.picker.resultsFor', { query: QUERY })).first().waitFor({ timeout: 20_000 })
    const first = results.first()
    await first.waitFor({ timeout: 20_000 })
    addData((await first.getAttribute('title')) ?? '')
    await first.click()
    await host.waitForFunction(() => document.querySelector('li button[aria-pressed="true"]') !== null, null, { timeout: 5000 })

    // settings: 3 rounds, 6 snippets, the cleaver (its own texts in every round screen), 60 s, 10 s final timer
    await setRadio(host, 'lobby.rules.rounds.title', 0)
    await setRadio(host, 'lobby.rules.snippets.title', 0)
    await setRadio(host, 'lobby.rules.cuts.title', 1)
    await setRadio(host, 'lobby.rules.roundTime.title', 0)
    await setRadio(host, 'lobby.rules.finalTimer.title', 0)
    await host.waitForTimeout(700)
    await check(host, 'lobby-ready')
    await atPhoneWidth(host, () => check(host, 'lobby-ready'))
    await check(guest, 'lobby-players-ready', { group: 'lobby-players' })
    for (const tab of ['playlist', 'rules']) {
      await guest.locator(`#lobby-tab-${tab}`).tap()
      await guest.waitForTimeout(500)
      await check(guest, `lobby-${tab}`)
      await onSmallPhone(() => check(guest, `lobby-${tab}`))
    }
    await guest.locator('#lobby-tab-players').tap()

    // QR / share sheet
    await Promise.all([
      openDialog(host, host.getByRole('button', { name: P('lobby.code.enlargeQr'), exact: true }).first()),
      openDialog(guest, guest.getByRole('button', { name: P('lobby.code.showQr'), exact: true }).first()),
    ])
    await Promise.all([check(host, 'lobby-qr', { scope: DIALOG }), check(guest, 'lobby-qr', { scope: DIALOG })])
    await onSmallPhone(() => check(guest, 'lobby-qr', { scope: DIALOG }))
    await Promise.all([closeDialog(host), closeDialog(guest)])

    // ------------------------------------------------------------ game 1: 3 rounds, 6 snippets
    await host.getByRole('button', { name: P('lobby.start') }).first().click()
    await Promise.all([waitScreen(host, 'round', 30_000), waitScreen(guest, 'round', 30_000)])
    const prep = await Promise.all([host, guest].map((p) => p.locator('[data-round-view="preparing"]').first().waitFor({ timeout: 4000 }).then(() => true, () => false)))
    if (prep.every(Boolean)) await Promise.all([check(host, 'preparing', { wait: 500 }), check(guest, 'preparing', { wait: 500 })])

    for (let r = 0; r < 3; r++) {
      const last = r === 2
      const intro = await Promise.all([waitPhase(host, 'intro', 60_000), waitPhase(guest, 'intro', 60_000)]).then(() => true, () => false)
      if (intro && (r === 0 || last)) await Promise.all([check(host, last ? 'intro-last' : 'intro', { wait: 300 }), check(guest, last ? 'intro-last' : 'intro', { wait: 300 })])
      await Promise.all([waitPhase(host, 'playing', 60_000), waitPhase(guest, 'playing', 60_000)])
      await Promise.all([host, guest].map((p) => p.locator('[data-round-view="playing"] .sb-item').first().waitFor({ timeout: 15_000 })))
      await host.waitForTimeout(1800) // the "VIA!" burst clears
      if (r === 0) {
        await Promise.all([check(host, 'playing'), check(guest, 'playing')])
        // Untouched board: the first tap arms CONFERMA ("Non hai spostato nulla").
        const btn = confirmButton(guest)
        await btn.tap()
        await guest.waitForTimeout(400)
        if ((await btn.getAttribute('data-armed').catch(() => null)) !== null) await check(guest, 'playing-armed')
        // An untouched board doesn't start the final timer: move a block, then confirm.
        await touchDrag(guest, 0, 3)
        await confirm(guest)
        await host.locator('[data-first-submit-banner]').first().waitFor({ timeout: 8000 }).catch(() => report.errors.push('round 1: the host saw no final-timer banner'))
        await host.waitForTimeout(500)
        await Promise.all([check(host, 'final-timer'), check(guest, 'waiting')])
        // The host lets the final timer run out (timed-out scoring).
      } else {
        await confirm(guest)
        await host.waitForTimeout(600)
        await confirm(host)
      }

      // ---------------------------------------------------------- reveal
      await Promise.all([waitPhase(host, 'reveal', 45_000), waitPhase(guest, 'reveal', 45_000)])
      if (r === 0) {
        await host.waitForTimeout(1500)
        await Promise.all([check(host, 'reveal-mid', { wait: 0 }), check(guest, 'reveal-mid', { wait: 0 })])
      }
      await Promise.all([host, guest].map((p) => p.waitForSelector('.rv-root[data-stage="done"]', { timeout: 25_000 })))
      if (r === 0 || last) {
        const tag = last ? 'reveal-last' : 'reveal-done'
        const toggle = async (page) => {
          try {
            await toggleView(page)
          } catch (err) {
            report.errors.push(`${whoOf(page)} reveal toggle: ${err.message.split('\n')[0]}`)
          }
        }
        const toggleView = async (page) => {
          const group = page.getByRole('radiogroup', { name: P('reveal.board.toggle.label'), exact: true }).first()
          const view = async () => ((await group.locator('[role="radio"][aria-checked="true"]').getAttribute('aria-label').catch(() => null)) === P('reveal.board.titleCorrect') ? 'correct' : 'mine')
          const v1 = await view()
          await check(page, `${tag}-${v1}`, { wait: 500 })
          if (last) return
          const other = v1 === 'correct' ? 'reveal.board.titleMine' : 'reveal.board.titleCorrect'
          const radio = group.getByRole('radio', { name: P(other), exact: true })
          await (page === guest ? radio.tap({ timeout: 5000 }) : radio.click({ timeout: 5000 }))
          await check(page, `${tag}-${await view()}`, { wait: 600 })
        }
        await Promise.all([toggle(host), toggle(guest)])
        if (!last) await checkScrolled(guest, 'reveal-scrolled', 2)
      }
      // (the reveal also advances on its own after 25 s)
      await host
        .getByRole('button', { name: P(last ? 'reveal.footer.final' : 'reveal.footer.next') })
        .first()
        .click({ timeout: 8000 })
        .catch(() => log('(the reveal advanced on its own)'))
      if (!last)
        await Promise.all([host, guest].map((p) => p.waitForFunction(() => !document.querySelector('[data-screen-frame]:not([inert]) [data-phase="reveal"]'), null, { timeout: 15_000 })))
    }

    // ------------------------------------------------------------ final
    await Promise.all([waitScreen(host, 'final', 20_000), waitScreen(guest, 'final', 20_000)])
    await host.waitForTimeout(3500)
    await Promise.all([check(host, 'final'), check(guest, 'final')])
    await onSmallPhone(() => check(guest, 'final'))
    await Promise.all([checkScrolled(host, 'final-scrolled', 2), checkScrolled(guest, 'final-scrolled', 4)])
    await onSmallPhone(() => checkScrolled(guest, 'final-scrolled', 4))
    // A guest asks for a rematch: "Richiesta inviata" / the host's rematch notice.
    const rematch = guest.getByRole('button', { name: P('final.dock.rematch'), exact: true }).first()
    if (await rematch.count()) {
      await rematch.tap()
      await host.getByText(P('final.dock.rematchNamed', { count: 1, names: NAMES.guest })).first().waitFor({ timeout: 8000 }).catch(() => {})
      await Promise.all([check(host, 'final-rematch'), check(guest, 'final-rematch')])
    }

    // ------------------------------------------------------------ game 2: 16 snippets on the phone, the scalpel
    await host.getByRole('button', { name: P('final.dock.playAgain'), exact: true }).click()
    await Promise.all([waitScreen(host, 'lobby', 20_000), waitScreen(guest, 'lobby', 20_000)])
    await host.waitForTimeout(800)
    await setRadio(host, 'lobby.rules.snippets.title', 3)
    await setRadio(host, 'lobby.rules.cuts.title', 0)
    await host.waitForTimeout(500)
    await host.getByRole('button', { name: P('lobby.start') }).first().click()
    await Promise.all([waitPhase(host, 'playing', 90_000), waitPhase(guest, 'playing', 90_000)])
    await Promise.all([host, guest].map((p) => p.locator('[data-round-view="playing"] .sb-item').nth(15).waitFor({ timeout: 15_000 })))
    await host.waitForTimeout(1800)
    await Promise.all([check(host, 'playing-16'), check(guest, 'playing-16')])
    await onSmallPhone(() => check(guest, 'playing-16'))

    // ------------------------------------------------------------ the host leaves: connection lost
    // Closing the tab (its pagehide says goodbye): the guest is told at once.
    await host.close({ runBeforeUnload: true }).catch(() => {})
    await host.waitForEvent('close', { timeout: 5000 }).catch(() => {})
    await host.context().close().catch(() => {})
    let banner = false
    const deadline = Date.now() + 45_000
    while (Date.now() < deadline) {
      if (await guest.locator(DIALOG).count()) break
      if (!banner && (await guest.getByText(P('shell.banner.lost'), { exact: true }).count())) {
        banner = true
        await check(guest, 'connection-banner', { wait: 300 })
      }
      await guest.waitForTimeout(400)
    }
    if (await guest.locator(DIALOG).count()) {
      await guest.waitForTimeout(600)
      await check(guest, 'connection-lost', { scope: DIALOG })
      await onSmallPhone(() => check(guest, 'connection-lost', { scope: DIALOG }))
    } else report.errors.push('the guest saw no connection-lost dialog within 45 s of the host leaving')
  } catch (err) {
    report.errors.push(`FATAL: ${err.message.split('\n')[0]}`)
    log('💥', err.message.split('\n')[0])
    for (const [who, page] of [
      ['host', host],
      ['guest', guest],
    ])
      await page.screenshot({ path: `${SHOTS}i18n-${code}-failure-${who}.png` }).catch(() => {})
  } finally {
    await browser.close().catch(() => {})
  }

  for (const f of report.findings) report.counts[f.rule]++
  report.durationMs = Date.now() - started
  writeFileSync(`${REPORTS}${code}.json`, `${JSON.stringify(report, null, 2)}\n`)
  log(`done in ${fmtTime(report.durationMs)}: ${report.findings.length} findings, ${report.errors.length} errors → ${rel(`${REPORTS}${code}.json`)}`)
  return report
}

// ---------------------------------------------------------------- self-test (no server)

/**
 * The detector against a synthetic page with one case per rule (and look-alikes that must
 * stay quiet), with the pseudo catalog as "the locale": `node tests/e2e/i18n-bounds.mjs --selftest`.
 */
async function selfTest() {
  const pseudo = pseudoCatalog(IT)
  const L = makeTranslator(pseudo, pseudo, 'it-IT').plain
  const I = makeTranslator(IT, IT, 'it-IT').plain
  const name = 'Bartolomeo Rossi Bianchi'
  const html = `<!doctype html><html lang="it-IT"><head><style>
    body { margin: 0; font: 15px/1.3 sans-serif; background: #111; color: #eee; width: 360px }
    .truncate { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
    .btn { display: inline-flex; justify-content: center; align-items: center; height: 36px; padding: 0 12px; border: 0; border-radius: 999px; background: #7b5cff; color: #fff; white-space: nowrap; font: inherit }
    .pill { display: inline-block; border-radius: 999px; background: #333; padding: 2px 8px }
    section { position: relative; margin: 8px; }
  </style></head><body>
    <section id="case-trunc" style="width:70px"><span class="truncate">${L('lobby.start')}</span></section>
    <section id="case-spill" style="margin-left:90px"><button class="btn" style="width:70px">${L('lobby.leave.closeRoom')}</button></section>
    <section id="case-tall"><div role="tablist"><button role="tab" style="width:52px;font:inherit">${L('lobby.tabs.players')}</button></div></section>
    <section id="case-overlap" style="height:40px">
      <button class="btn" id="case-ov1" style="position:absolute;left:0">${L('home.help')}</button>
      <button class="btn" id="case-ov2" style="position:absolute;left:40px">${L('home.join.button')}</button>
    </section>
    <section id="case-text" style="height:24px">
      <span style="position:absolute;left:0">${L('reveal.verdict.none')}</span><span style="position:absolute;left:60px">${L('reveal.score.total')}</span>
    </section>
    <section id="case-off" style="height:24px"><span style="position:absolute;left:250px;white-space:nowrap">${L('home.footer.noAccount')}</span></section>
    <p id="case-it">${I('home.hero.eyebrow')}</p>
    <button id="case-itlabel" class="btn" aria-label="${I('home.profile.randomName')}">🎲</button>
    <p id="case-key">lobby.start</p>
    <p id="case-param">${L('lobby.hero.by').replace('{creator}', '')}{creator}</p>
    <p id="case-tag">&lt;b&gt;${L('home.help')}&lt;/b&gt;</p>
    <!-- must stay quiet: a name cut by design, a label that fits, decorative text, a fitting pill -->
    <section id="quiet-name" style="width:90px"><span class="truncate">${name}</span></section>
    <section id="quiet-fits"><button class="btn">${L('shell.action.ok')}</button> <span class="pill">${L('lobby.roster.you')}</span></section>
    <section id="quiet-deco" style="height:30px"><span aria-hidden="true" style="position:absolute;font-size:40px;opacity:.5">UNSHUFFLE</span><span aria-hidden="true" style="position:absolute">UNSHUFFLE</span></section>
  </body></html>`
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const failures = []
  try {
    const page = await browser.newPage({ viewport: { width: 360, height: 900 } })
    await page.setContent(html)
    const args = { scope: null, data: [name], pseudo: true }
    const a = await page.evaluate(pageDetect, args)
    const matchLoc = buildMatcher(pseudo)
    const matchIt = buildMatcher(IT)
    const env = { isItalian: false, catalog: pseudo, matchLoc, matchIt, isDataText: (t) => t === name }
    const found = classify(a, { locale: 'pseudo', viewport: 'selftest', who: 'none', state: 'selftest' }, env)
    const has = (rule, id) => found.some((f) => f.rule === rule && (f.selector ?? '').includes(`#${id}`))
    const expect = [
      ['CLIPPED', 'case-trunc'],
      ['CLIPPED', 'case-spill'],
      ['TOO-TALL', 'case-tall'],
      ['OVERLAP', 'case-ov1'],
      ['OVERLAP', 'case-text'],
      ['OFFSCREEN', 'case-off'],
      ['UNTRANSLATED', 'case-it'],
      ['UNTRANSLATED', 'case-itlabel'],
      ['RAW-KEY', 'case-key'],
      ['RAW-KEY', 'case-param'],
      ['RAW-KEY', 'case-tag'],
    ]
    for (const [rule, id] of expect) {
      const ok = has(rule, id)
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${rule.padEnd(12)} #${id}`)
      if (!ok) failures.push(`${rule} not reported for #${id}`)
    }
    if (process.env.I18N_SELFTEST_DUMP) for (const f of [...a.items, ...found]) console.log('  ·', f.rule, f.sel ?? f.selector, JSON.stringify(f.text).slice(0, 40), f.detail?.slice(0, 100))
    const noisy = found.filter((f) => /#quiet-/.test(f.selector ?? ''))
    console.log(`${noisy.length ? 'FAIL' : 'ok  '} quiet cases (a name cut by design, fitting labels, decorative text): ${noisy.length} findings`)
    for (const f of noisy) failures.push(`false positive: ${f.rule} ${f.selector} “${f.text}”`)
  } finally {
    await browser.close()
  }
  if (failures.length) console.log(`\nSELFTEST FAIL\n  ${failures.join('\n  ')}`)
  else console.log('\nSELFTEST PASS')
  return failures.length ? 1 : 0
}

// ---------------------------------------------------------------- which locales the app offers

async function offeredLocales() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const offered = []
  try {
    const probe = async (code) => {
      const meta = localeMeta(code)
      const ctx = await browser.newContext({ locale: meta.tag })
      await ctx.addInitScript((l) => {
        try {
          localStorage.setItem('unshuffle:locale', l)
          localStorage.setItem('unshuffle:onboarded', String(Date.now()))
        } catch {
          /* ignore */
        }
      }, meta.storage)
      const page = await ctx.newPage()
      await page.goto(BASE, { waitUntil: 'load' })
      await page.locator('[data-screen-frame][data-screen="home"]').waitFor({ timeout: 20_000 })
      const out = await page.evaluate(() => ({ lang: document.documentElement.lang, buttons: [...document.querySelectorAll('button')].map((b) => b.textContent.trim()) }))
      await ctx.close()
      return { code, ...out }
    }
    const res = await Promise.all(LOCALES.map(probe))
    for (const { code, lang, buttons } of res) {
      if (lang !== LOCALE_INFO[code].tag) continue
      // The pseudo server shows pseudo-Italian under <html lang="it-IT">.
      if (code === 'it' && buttons.includes(makeTranslator(pseudoCatalog(IT), IT, 'it-IT').plain('home.create.button'))) offered.push('pseudo')
      else offered.push(code)
    }
  } finally {
    await browser.close()
  }
  return offered
}

// ---------------------------------------------------------------- summary

function fmtTime(ms) {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`
}

function summarize(reports) {
  const cols = ['locale', ...RULES, 'total', 'errors', 'time']
  const rows = reports.map((r) =>
    r.missing
      ? [r.locale, ...RULES.map(() => '·'), '·', 'no run', '']
      : [r.locale, ...RULES.map((rule) => (rule === 'UNTRANSLATED' && r.locale === 'it' ? '–' : String(r.counts[rule]))), String(r.findings.length), String(r.errors.length), fmtTime(r.durationMs)],
  )
  const w = cols.map((c, i) => Math.max(c.length, ...rows.map((row) => row[i].length)))
  const line = (cells) => cells.map((c, i) => (i === 0 ? c.padEnd(w[i]) : c.padStart(w[i]))).join('  ')
  console.log(`\n${line(cols)}\n${w.map((n) => '─'.repeat(n)).join('  ')}`)
  for (const row of rows) console.log(line(row))
  for (const r of reports) {
    if (r.missing) continue
    if (r.errors.length) console.log(`\n[${r.locale}] errors:\n  ${r.errors.slice(0, 12).join('\n  ')}`)
    const top = r.findings.slice(0, 8)
    if (top.length) {
      console.log(`\n[${r.locale}] first findings (of ${r.findings.length}; all in tests/e2e/i18n-report/${r.locale}.json):`)
      for (const f of top) console.log(`  ${f.rule.padEnd(12)} ${f.viewport}/${f.state}  “${f.text.slice(0, 60)}”${f.key ? ` (${f.key})` : ''}  ${f.detail?.slice(0, 110) ?? ''}`)
    }
  }
}

// ---------------------------------------------------------------- main

async function runChild(code) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), BASE, code, '--child', ...(opts.headful ? ['--headful'] : [])], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env })
    const relay = (stream, out) => {
      let buf = ''
      stream.on('data', (d) => {
        buf += d
        const lines = buf.split('\n')
        buf = lines.pop()
        for (const l of lines) if (l.trim()) out.write(`${l}\n`)
      })
    }
    relay(child.stdout, process.stdout)
    relay(child.stderr, process.stderr)
    child.on('close', (status) => resolve(status))
  })
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
let exitCode = 0
if (!isMain) {
  // imported (tools, debugging): nothing runs
} else if (opts.selftest) {
  process.exit(await selfTest())
} else if (opts.child) {
  const [code] = requested
  const r = await runLocale(code, opts).catch((err) => {
    console.error(`[${code}] ${err.message}`)
    return null
  })
  process.exit(!r || r.findings.length || r.errors.length ? 1 : 0)
} else {
  let locales = requested
  if (!locales.length) {
    locales = await offeredLocales()
    console.log(stamp(), `offered by ${BASE}: ${locales.join(', ') || '(none)'}`)
  }
  const unknown = locales.filter((l) => !localeMeta(l))
  if (unknown.length) {
    console.error(`unknown locale(s): ${unknown.join(', ')} (LOCALES: ${LOCALES.join(', ')}, or pseudo)`)
    process.exit(2)
  }
  const reports = []
  if (opts.jobs > 1 && locales.length > 1) {
    for (const l of locales) rmSync(`${REPORTS}${l}.json`, { force: true })
    const queue = [...locales]
    await Promise.all(
      Array.from({ length: Math.min(opts.jobs, locales.length) }, async () => {
        while (queue.length) await runChild(queue.shift())
      }),
    )
    for (const l of locales) {
      const file = `${REPORTS}${l}.json`
      reports.push(existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { locale: l, missing: true })
    }
  } else {
    for (const l of locales) {
      const r = await runLocale(l, opts).catch((err) => {
        console.error(`[${l}] ${err.message}`)
        return { locale: l, missing: true }
      })
      reports.push(r)
    }
  }
  summarize(reports)
  exitCode = reports.some((r) => r.missing || r.findings.length || r.errors.length) ? 1 : 0
  process.exit(exitCode)
}
