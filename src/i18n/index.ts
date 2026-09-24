// Translations: current locale (zustand), message lookup with {param}
// interpolation and plurals, locale-aware number formatting.
//
//   t('lobby.start')                          → "Inizia partita"
//   t('lobby.players', { count: 3 })          → "3 giocatori" (plural by count)
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

/** Lazily loaded catalogs (Italian is bundled). */
const LOADERS: Partial<Record<Locale, () => Promise<{ default: Catalog }>>> = {}

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

const pluralRules = new Map<string, Intl.PluralRules>()
const numberFormats = new Map<string, Intl.NumberFormat>()

function rulesFor(tag: string): Intl.PluralRules {
  let rules = pluralRules.get(tag)
  if (!rules) pluralRules.set(tag, (rules = new Intl.PluralRules(tag)))
  return rules
}

/** Locale-aware number (thousands separators: 5.000 / 5,000 / 5 000). */
export function formatNumber(n: number, options?: Intl.NumberFormatOptions): string {
  const tag = localeTag()
  if (options) return new Intl.NumberFormat(tag, options).format(n)
  let fmt = numberFormats.get(tag)
  if (!fmt) numberFormats.set(tag, (fmt = new Intl.NumberFormat(tag)))
  return fmt.format(n)
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

/** Switch language (loads its catalog first) and remember the choice. */
export async function setLocale(locale: Locale, remember = true): Promise<void> {
  const catalog = await loadCatalog(locale)
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
