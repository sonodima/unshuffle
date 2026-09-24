// Catalog helpers shared by the pseudo-locale generator (./generate.mjs, ./vite.config.ts)
// and the bounds suite (../i18n-bounds.mjs). Plain Node (>= 23.6: the .ts catalogs are
// imported with Node's built-in type stripping; they are pure data).
//
//   loadCatalog('it')        → the Italian catalog (namespaces of src/i18n/locales/it/index.ts)
//   loadCatalog('de')        → another locale, as far as it exists (a missing namespace = {})
//   pseudoCatalog(it)        → the pseudo-Italian catalog (see pseudoMessage)
//   makeTranslator(cat, tag) → t(key, params) with plurals and the Italian fallback, like the app

import { existsSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const ROOT = new URL('../../../', import.meta.url).pathname
export const LOCALES_DIR = `${ROOT}src/i18n/locales/`

/** Namespaces, in the order src/i18n/locales/it/index.ts imports them. */
export function namespaces() {
  const src = readFileSync(`${LOCALES_DIR}it/index.ts`, 'utf8')
  return [...src.matchAll(/^import\s+(\w+)\s+from\s+'\.\/(\w+)'/gm)].map((m) => m[2])
}

/**
 * A locale's catalog, namespace by namespace. `fresh` bypasses Node's module cache
 * (the dev server regenerates the pseudo catalog when the Italian one changes).
 * Returns null when the locale has no folder.
 */
export async function loadCatalog(code, { fresh = false } = {}) {
  const dir = `${LOCALES_DIR}${code}/`
  if (!existsSync(dir)) return null
  const out = {}
  for (const ns of namespaces()) {
    const file = `${dir}${ns}.ts`
    if (!existsSync(file)) {
      out[ns] = {}
      continue
    }
    const url = pathToFileURL(file).href + (fresh ? `?v=${Date.now()}` : '')
    try {
      out[ns] = (await import(url)).default ?? {}
    } catch (err) {
      // A translator may be mid-edit: treat the namespace as missing (Italian fallback).
      console.warn(`[catalogs] ${code}/${ns}.ts could not be loaded (${err?.message?.split('\n')[0]}): using {}`)
      out[ns] = {}
    }
  }
  return out
}

const CATEGORIES = new Set(['zero', 'one', 'two', 'few', 'many', 'other'])
export const isRecord = (x) => typeof x === 'object' && x !== null && !Array.isArray(x)
export const isPlural = (x) => isRecord(x) && typeof x.other === 'string' && Object.keys(x).every((k) => CATEGORIES.has(k))

/** Every message of a catalog: [{ key, forms: string[] }] (plurals give one entry with all forms). */
export function messages(catalog, prefix = '', out = []) {
  for (const [k, v] of Object.entries(catalog ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') out.push({ key, forms: [v] })
    else if (isPlural(v)) out.push({ key, forms: Object.values(v) })
    else if (isRecord(v)) messages(v, key, out)
    // Arrays: lists (nicknames) and data (chips, featured ids).
    else if (Array.isArray(v) && v.every((x) => isRecord(x) && typeof x.label === 'string'))
      v.forEach((x, i) => out.push({ key: `${key}.${i}.label`, forms: [x.label], data: true }))
  }
  return out
}

export function lookup(catalog, key) {
  let node = catalog
  for (const part of key.split('.')) {
    if (node == null || typeof node !== 'object') return undefined
    node = node[part]
  }
  return node
}

// ------------------------------------------------------------------ pseudo-localization

// ASCII letters → an accented look-alike from Latin-1 / Latin Extended-A (the fonts'
// latin / latin-ext subsets), so the pseudo text keeps the app's own font metrics. Letters
// without such a variant stay as they are.
const ACCENTS = {
  a: 'å', c: 'ç', d: 'ď', e: 'é', g: 'ğ', h: 'ĥ', i: 'î', j: 'ĵ', k: 'ķ', l: 'ľ', n: 'ñ', o: 'ö',
  r: 'ŕ', s: 'š', t: 'ť', u: 'û', w: 'ŵ', y: 'ý', z: 'ž',
  A: 'Å', C: 'Ç', D: 'Ď', E: 'É', G: 'Ğ', H: 'Ĥ', I: 'Î', J: 'Ĵ', K: 'Ķ', L: 'Ľ', N: 'Ñ', O: 'Ö',
  R: 'Ŕ', S: 'Š', T: 'Ť', U: 'Û', W: 'Ŵ', Y: 'Ý', Z: 'Ž',
}
/** Target growth of the visible text (German / Russian run ~30% longer than Italian). */
export const PSEUDO_GROWTH = 0.4
const TOKEN = /(<\/?\w+>|\{\w+\})/

const accent = (s) => s.replace(/[A-Za-z]/g, (c) => ACCENTS[c] ?? c)

/**
 * One message in pseudo-Italian: "Inizia partita" → "[Îñîžîå þåŕťîťå ~~~]".
 * - letters get accents (taller glyphs: catches vertical clipping too),
 * - the text grows by ~40% with "[" … " ~~~]" (brackets show where a string starts / ends,
 *   so a cut-off "]" is visible at a glance; long paddings come in words of 6: "~~~~~~ ~~~]"),
 * - {params} and <tags> are kept verbatim; when every visible text sits inside tags
 *   (e.g. '<wide>Confermato in</wide> <num>{time}</num>') the brackets go inside the
 *   first / last tag, so no text lands outside them,
 * - strings without letters ("{count}/{max}", ", ", "{n}º") are left alone.
 */
export function pseudoMessage(src) {
  const parts = src.split(TOKEN)
  let literal = 0
  let params = 0
  let depth = 0
  let outside = false
  for (const p of parts) {
    if (/^<\//.test(p)) depth--
    else if (/^<\w+>$/.test(p)) depth++
    else if (/^\{\w+\}$/.test(p)) params++
    else {
      literal += p.length
      if (depth === 0 && p.trim()) outside = true
    }
  }
  if (!/[A-Za-z]/.test(parts.filter((p) => !TOKEN.test(p)).join(''))) return src
  const base = literal + params * 2
  // Padding in words of up to 6 characters: real translations wrap between words, and a
  // 30-character run of "~" would be an unbreakable word no language has.
  const n = Math.max(1, Math.round(base * PSEUDO_GROWTH) - 3)
  const pad = Array.from({ length: Math.ceil(n / 7) }, (_, i) => '~'.repeat(Math.min(6, n - i * 7) || 1)).join(' ')
  const body = parts.map((p) => (TOKEN.test(p) ? p : accent(p)))
  if (outside) return `[${body.join('')} ${pad}]`
  // All text inside tags: open after the first opening tag, close before the last closing tag.
  const first = body.findIndex((p) => /^<\w+>$/.test(p))
  const last = body.findLastIndex((p) => /^<\/\w+>$/.test(p))
  if (first < 0 || last < 0) return `[${body.join('')} ${pad}]`
  body[first] += '['
  body[last] = ` ${pad}]${body[last]}`
  return body.join('')
}

/**
 * The pseudo catalog: every message (and every plural form) through pseudoMessage, same
 * keys and plural categories. Lists (nickname parts) and data stay as they are, except
 * the visible `label` of data objects (category chips; their `query` / `emoji` are kept,
 * so the chips still search Deezer).
 */
export function pseudoCatalog(node, key = '') {
  if (typeof node === 'string') return pseudoMessage(node)
  if (Array.isArray(node)) {
    if (key.startsWith('names')) return node
    return node.map((x) => (isRecord(x) && typeof x.label === 'string' ? { ...x, label: pseudoMessage(x.label) } : x))
  }
  if (isRecord(node)) {
    // The nickname namespace is data: its pattern and parts must fit the 16-character name field.
    if (key === 'names') return node
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, pseudoCatalog(v, key ? `${key}.${k}` : k)]))
  }
  return node
}

// ------------------------------------------------------------------ translator

/** t(key, params) over `catalog` (falling back to `fallback`), like src/i18n/index.ts. */
export function makeTranslator(catalog, fallback, tag) {
  const rules = new Intl.PluralRules(tag)
  const numbers = new Intl.NumberFormat(tag, { useGrouping: 'always' })
  const render = (value, params) => {
    let text
    if (typeof value === 'string') text = value
    else if (isPlural(value)) text = value[rules.select(Number(params?.count ?? 0))] ?? value.other
    else return undefined
    return text.replace(/\{(\w+)\}/g, (m, name) => {
      const v = params?.[name]
      return v === undefined ? m : typeof v === 'number' ? numbers.format(v) : String(v)
    })
  }
  const t = (key, params) => render(lookup(catalog, key), params) ?? render(lookup(fallback, key), params) ?? key
  /** The message without its <tags> (what an accessible name / textContent reads). */
  t.plain = (key, params) => t(key, params).replace(/<\/?\w+>/g, '')
  return t
}
