// Translations: current locale (zustand), message lookup with {param}
// interpolation and plurals, locale-aware number / list / ordinal formatting.
//
//   t('lobby.start')                          → "Inizia partita"
//   t('ui.timer.secondsLeft', { count: 3 })   → "3 secondi rimasti" (plural by count)
//   tm(msg)                                   → a Msg from the host / store / network
//
// Components read strings through useT() (./react) so they re-render on a
// language change. Non-UI code never builds user-facing text: it passes Msg values.

import { create } from 'zustand'
import it from './locales/it'
import type { Catalog, DataKey, ListKey, MessageKey, Msg, Params, PathValue, Plural } from './catalog'
import { DEFAULT_LOCALE, LOCALE_INFO, LOCALES, SOURCE_LOCALE, isLocale, matchLocale } from './locales'
import type { Locale } from './locales'

export type { Catalog, DataKey, ListKey, MessageKey, Msg, Params, Plural } from './catalog'
export { LOCALE_INFO, LOCALES, SOURCE_LOCALE } from './locales'
export type { Locale } from './locales'

const STORAGE_KEY = 'unshuffle:locale'

/** Lazily loaded catalogs (Italian is bundled), one chunk per language. */
const LOADERS: Partial<Record<Locale, () => Promise<{ default: Catalog }>>> = {
  en: () => import('./locales/en'),
  es: () => import('./locales/es'),
  fr: () => import('./locales/fr'),
  de: () => import('./locales/de'),
  pt: () => import('./locales/pt'),
  ru: () => import('./locales/ru'),
  ja: () => import('./locales/ja'),
  ko: () => import('./locales/ko'),
  zh: () => import('./locales/zh'),
}

interface I18nState {
  locale: Locale
  catalog: Catalog
}

export const useI18n = create<I18nState>()(() => ({ locale: SOURCE_LOCALE, catalog: it }))

const loaded = new Map<Locale, Catalog>([[SOURCE_LOCALE, it]])

/** Locales that can be picked in this build. */
export function availableLocales(): Locale[] {
  return LOCALES.filter((l) => loaded.has(l) || LOADERS[l] !== undefined)
}

export function currentLocale(): Locale {
  return useI18n.getState().locale
}

/** BCP 47 tag of the current locale, for Intl APIs. */
export function localeTag(): string {
  return LOCALE_INFO[currentLocale()].tag
}

function lookup(catalog: unknown, key: string): unknown {
  let node: unknown = catalog
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return node
}

function isPlural(x: unknown): x is Plural {
  return typeof x === 'object' && x !== null && !Array.isArray(x) && typeof (x as Plural).other === 'string'
}

// Intl objects are costly to build and some callers format every animation frame:
// one per language (and options).
const pluralRules = new Map<string, Intl.PluralRules>()
const numberFormats = new Map<string, Intl.NumberFormat>()
const listFormats = new Map<string, Intl.ListFormat>()

function rulesFor(tag: string, type: Intl.PluralRuleType = 'cardinal'): Intl.PluralRules {
  const id = `${tag}|${type}`
  let rules = pluralRules.get(id)
  if (!rules) pluralRules.set(id, (rules = new Intl.PluralRules(tag, { type })))
  return rules
}

/**
 * Locale-aware number (thousands separators: 5.000 / 5,000 / 5 000). Grouping is
 * forced ('always'): plain it-IT and es-ES leave 4-digit numbers ungrouped, so a
 * "4428" would sit next to an "18.571".
 */
export function formatNumber(n: number, options?: Intl.NumberFormatOptions): string {
  const tag = localeTag()
  const id = options ? `${tag}|${JSON.stringify(options)}` : tag
  let fmt = numberFormats.get(id)
  if (!fmt) numberFormats.set(id, (fmt = new Intl.NumberFormat(tag, { useGrouping: 'always', ...options })))
  return fmt.format(n)
}

/** "Giulia, Tommy e Marco" / "Giulia, Tommy, and Marco" (Intl.ListFormat, current language). */
export function formatList(items: readonly string[], type: Intl.ListFormatType = 'conjunction'): string {
  const tag = localeTag()
  const id = `${tag}|${type}`
  let fmt = listFormats.get(id)
  if (!fmt) listFormats.set(id, (fmt = new Intl.ListFormat(tag, { type })))
  return fmt.format(items)
}

const ORDINAL_KEY: MessageKey = 'ui.ordinal'

/**
 * A position or rank as an ordinal: 1 → "1º" (it) / "1st" (en) / "1." (de). The
 * pattern is `ui.ordinal`, picked with the language's ordinal plural rules
 * (English one / two / few / other). Pass the result as a string param.
 */
export function formatOrdinal(n: number): string {
  const value = lookup(useI18n.getState().catalog, ORDINAL_KEY)
  const forms = isPlural(value) ? value : (lookup(it, ORDINAL_KEY) as Plural)
  const category = rulesFor(localeTag(), 'ordinal').select(n) as keyof Plural
  return interpolate(forms[category] ?? forms.other, { n })
}

function interpolate(text: string, params?: Params): string {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name]
    if (value === undefined) return match
    return typeof value === 'number' ? formatNumber(value) : value
  })
}

function render(value: unknown, params?: Params): string | undefined {
  if (typeof value === 'string') return interpolate(value, params)
  if (isPlural(value)) {
    const count = Number(params?.count ?? 0)
    // `zero` is an explicit form for exactly 0 in every language (like ICU "=0"): some
    // languages' rules put 0 in "one" ("0 ponto" in Portuguese) where players expect otherwise.
    if (count === 0 && typeof value.zero === 'string') return interpolate(value.zero, params)
    const category = rulesFor(localeTag()).select(count) as keyof Plural
    return interpolate(value[category] ?? value.other, params)
  }
  return undefined
}

/** The message for `key` in the current language ({param} interpolation, plural by `count`). */
export function t(key: MessageKey, params?: Params): string {
  return render(lookup(useI18n.getState().catalog, key), params) ?? render(lookup(it, key), params) ?? key
}

/** A Msg (key, or key + params) in the current language. */
export function tm(msg: Msg | null | undefined): string {
  if (!msg) return ''
  return typeof msg === 'string' ? t(msg) : t(msg.key, msg.params)
}

/** A list of strings (e.g. nickname parts) in the current language. */
export function tl(key: ListKey): readonly string[] {
  const value = lookup(useI18n.getState().catalog, key) ?? lookup(it, key)
  return Array.isArray(value) ? (value as string[]) : []
}

/** Per-language data (e.g. playlist search chips) in the current language. */
export function td<K extends DataKey>(key: K): PathValue<Catalog, K> {
  return (lookup(useI18n.getState().catalog, key) ?? lookup(it, key)) as PathValue<Catalog, K>
}

/** The key of a Msg (to compare messages). */
export function msgKey(msg: Msg | null | undefined): MessageKey | null {
  return !msg ? null : typeof msg === 'string' ? msg : msg.key
}

export function isMessageKey(x: unknown): x is MessageKey {
  return typeof x === 'string' && render(lookup(it, x)) !== undefined
}

function storedLocale(): Locale | null {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    return isLocale(raw) ? raw : null
  } catch {
    return null
  }
}

function applyDocumentLang(locale: Locale): void {
  if (typeof document !== 'undefined') document.documentElement.lang = LOCALE_INFO[locale].tag
}

async function loadCatalog(locale: Locale): Promise<Catalog> {
  const ready = loaded.get(locale)
  if (ready) return ready
  const loader = LOADERS[locale]
  if (!loader) throw new Error(`No catalog for ${locale}`)
  const catalog = (await loader()).default
  loaded.set(locale, catalog)
  return catalog
}

/**
 * Install a catalog without a loader. For tests and tooling only (a fake catalog
 * for a locale whose real one isn't bundled); the app registers languages in LOADERS.
 */
export function registerCatalog(locale: Locale, catalog: Catalog): void {
  loaded.set(locale, catalog)
}

let switchSeq = 0

/** Switch language (loads its catalog first) and remember the choice. The last call wins. */
export async function setLocale(locale: Locale, remember = true): Promise<void> {
  const seq = ++switchSeq
  const catalog = await loadCatalog(locale)
  // A later call started while this catalog was downloading: it decides.
  if (seq !== switchSeq) return
  useI18n.setState({ locale, catalog })
  applyDocumentLang(locale)
  if (remember) {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, locale)
    } catch {
      // Blocked storage: the choice lasts for this visit.
    }
  }
}

/** The saved choice, else the browser's languages, else English (or the source catalog). */
export function detectLocale(): Locale {
  const available = availableLocales()
  const pick = (l: Locale | null) => (l && available.includes(l) ? l : null)
  const browser = typeof navigator === 'undefined' ? [] : (navigator.languages?.length ? navigator.languages : [navigator.language ?? ''])
  return pick(storedLocale()) ?? pick(matchLocale(browser)) ?? pick(DEFAULT_LOCALE) ?? SOURCE_LOCALE
}

/** Before the first render: load the detected language (falls back to the source catalog). */
export async function initI18n(): Promise<void> {
  const locale = detectLocale()
  try {
    await setLocale(locale, false)
  } catch {
    applyDocumentLang(SOURCE_LOCALE)
  }
}

/** An Error that carries a translatable message (thrown by the host / store). */
export class AppError extends Error {
  readonly msg: Msg
  constructor(msg: Msg) {
    super(typeof msg === 'string' ? msg : msg.key)
    this.name = 'AppError'
    this.msg = msg
  }
}

/** The Msg of an AppError, else `fallback`. */
export function msgOf(err: unknown, fallback: Msg): Msg {
  return err instanceof AppError ? err.msg : fallback
}
