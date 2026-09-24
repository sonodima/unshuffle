// Supported languages. Italian is the source catalog (always bundled); the others
// are loaded on demand. Right-to-left scripts are not supported by the layout.
//
// Adding a language: copy locales/en/ to locales/<code>/ and translate it (the type
// checker lists what's missing), add it below and a loader to LOADERS in index.ts,
// then check it with `bun tests/support/i18n-check.ts <code>`.

export const LOCALES = ['it', 'en', 'es', 'fr', 'de', 'pt', 'ru', 'ja', 'ko', 'zh'] as const
export type Locale = (typeof LOCALES)[number]

export interface LocaleInfo {
  /** Name in the language itself (shown in the picker). */
  name: string
  /** BCP 47 tag for Intl and <html lang>. */
  tag: string
}

export const LOCALE_INFO: Record<Locale, LocaleInfo> = {
  it: { name: 'Italiano', tag: 'it-IT' },
  en: { name: 'English', tag: 'en' },
  es: { name: 'Español', tag: 'es-ES' },
  fr: { name: 'Français', tag: 'fr-FR' },
  de: { name: 'Deutsch', tag: 'de-DE' },
  pt: { name: 'Português (Brasil)', tag: 'pt-BR' },
  ru: { name: 'Русский', tag: 'ru-RU' },
  ja: { name: '日本語', tag: 'ja-JP' },
  ko: { name: '한국어', tag: 'ko-KR' },
  zh: { name: '简体中文', tag: 'zh-CN' },
}

/** Catalog every other one is translated from (and the fallback). */
export const SOURCE_LOCALE: Locale = 'it'
/** For browsers whose languages we don't have. */
export const DEFAULT_LOCALE: Locale = 'en'

export function isLocale(x: unknown): x is Locale {
  return typeof x === 'string' && (LOCALES as readonly string[]).includes(x)
}

/** Best supported locale for a list of BCP 47 tags (navigator.languages order). */
export function matchLocale(tags: readonly string[]): Locale | null {
  for (const tag of tags) {
    const lang = tag.toLowerCase().split(/[-_]/)[0]
    if (isLocale(lang)) return lang
  }
  return null
}
