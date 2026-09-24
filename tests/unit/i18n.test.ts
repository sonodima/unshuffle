// The i18n core (src/i18n): lookup, {params}, plurals, number formatting, rich(),
// language detection / switching, Msg helpers. Run: bun test ./tests/unit/i18n.test.ts
//
// Fake catalogs (a tiny English / French / Russian built on the Italian one) are
// installed with registerCatalog(), so these tests never depend on the real
// translations being present or finished.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import it from '../../src/i18n/locales/it'
import {
  AppError,
  LOCALE_INFO,
  LOCALES,
  SOURCE_LOCALE,
  availableLocales,
  currentLocale,
  detectLocale,
  formatList,
  formatNumber,
  formatOrdinal,
  isMessageKey,
  msgKey,
  msgOf,
  registerCatalog,
  setLocale,
  t,
  td,
  tl,
  tm,
  useI18n,
} from '../../src/i18n'
import type { Catalog, DataKey, ListKey, Locale, MessageKey } from '../../src/i18n'
import { matchLocale } from '../../src/i18n/locales'
import { rich, useT } from '../../src/i18n/react'

// ---- browser shims --------------------------------------------------------------

class MemoryStorage {
  map = new Map<string, string>()
  blocked = false
  getItem(k: string): string | null {
    if (this.blocked) throw new Error('SecurityError')
    return this.map.get(k) ?? null
  }
  setItem(k: string, v: string): void {
    if (this.blocked) throw new Error('SecurityError')
    this.map.set(k, String(v))
  }
  removeItem(k: string): void {
    this.map.delete(k)
  }
}

const storage = new MemoryStorage()
const html = { lang: 'it' }
const saved = {
  localStorage: Object.getOwnPropertyDescriptor(globalThis, 'localStorage'),
  document: Object.getOwnPropertyDescriptor(globalThis, 'document'),
  navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'),
}

function setBrowserLanguages(languages: readonly string[]): void {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    writable: true,
    value: { language: languages[0] ?? '', languages },
  })
}

function restore(name: keyof typeof saved): void {
  const d = saved[name]
  if (d) Object.defineProperty(globalThis, name, d)
  else delete (globalThis as Record<string, unknown>)[name]
}

// ---- fake catalogs -------------------------------------------------------------------

/** Keys that only exist in the fake catalogs below (tests aren't type-checked against them). */
const K = {
  apples: 'test.apples' as MessageKey,
  nested: 'test.nested' as MessageKey,
  twice: 'test.twice' as MessageKey,
  words: 'test.words' as ListKey,
  data: 'test.data' as DataKey,
}

/** The Italian catalog plus extra entries, with `drop` keys removed (to test the fallback). */
function fake(extra: Record<string, unknown>, drop: string[] = []): Catalog {
  const copy = structuredClone(it) as unknown as Record<string, Record<string, unknown>>
  for (const key of drop) {
    const path = key.split('.')
    let node: Record<string, unknown> = copy
    for (const part of path.slice(0, -1)) node = node[part] as Record<string, unknown>
    delete node[path[path.length - 1]]
  }
  return { ...copy, test: extra } as unknown as Catalog
}

const EN = fake(
  {
    apples: { one: '{count} apple', other: '{count} apples' },
    twice: '{n} and {n} again, {missing} stays',
    words: ['one', 'two'],
    data: [{ label: 'Rap', query: 'rap' }],
  },
  ['game.store.cancelled', 'names.titles'],
)
EN.game.store.hostLost = 'Lost the connection to the host.'
EN.game.host.notEnoughTracks = 'This playlist needs at least {count} tracks with a preview.'
EN.ui.ordinal = { one: '{n}st', two: '{n}nd', few: '{n}rd', other: '{n}th' }

const FR = fake({ apples: { one: '{count} pomme', other: '{count} pommes' } })
FR.game.host.notEnoughTracks = 'Il faut au moins {count} titres.'
FR.ui.ordinal = { one: '{n}er', other: '{n}e' }

// Russian: one (1, 21), few (2–4, 22), many (0, 5–20, 25); fractions are "other".
const RU = fake({ apples: { one: '{count} яблоко', few: '{count} яблока', many: '{count} яблок', other: '{count} яблока' } })
RU.game.host.notEnoughTracks = 'Нужно минимум {count} треков.'

// Japanese: a single "other" form.
const JA = fake({ apples: { other: 'りんご{count}個' } }, ['ui.ordinal'])

beforeAll(() => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: storage })
  Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: { documentElement: html } })
  setBrowserLanguages([])
  registerCatalog('en', EN)
  registerCatalog('fr', FR)
  registerCatalog('ru', RU)
  registerCatalog('ja', JA)
})

afterAll(async () => {
  await setLocale(SOURCE_LOCALE, false)
  restore('localStorage')
  restore('document')
  restore('navigator')
})

beforeEach(async () => {
  storage.map.clear()
  storage.blocked = false
  setBrowserLanguages([])
  await setLocale('it', false)
})

// ---- lookup & interpolation ----------------------------------------------------------

describe('t', () => {
  test('reads the current catalog', async () => {
    expect(t('game.store.hostLost')).toBe('Connessione con l’host persa.')
    await setLocale('en', false)
    expect(t('game.store.hostLost')).toBe('Lost the connection to the host.')
  })

  test('fills {params}; repeated params, unknown params stay as typed', async () => {
    expect(t('game.store.audioUnavailableTitled', { title: 'Volare' })).toBe('Audio di “Volare” non disponibile.')
    await setLocale('en', false)
    expect(t(K.twice, { n: 'A' })).toBe('A and A again, {missing} stays')
    expect(t(K.twice)).toBe('{n} and {n} again, {missing} stays')
  })

  test('number params are formatted for the language', async () => {
    expect(t('game.host.notEnoughTracks', { count: 5000 })).toBe(
      'Questa playlist non ha abbastanza brani con anteprima (servono almeno 5.000).',
    )
    await setLocale('en', false)
    expect(t('game.host.notEnoughTracks', { count: 5000 })).toBe('This playlist needs at least 5,000 tracks with a preview.')
    await setLocale('fr', false)
    // French groups with a narrow no-break space (U+202F).
    expect(t('game.host.notEnoughTracks', { count: 5000 })).toBe('Il faut au moins 5 000 titres.')
  })

  test('string params are never reformatted', () => {
    expect(t('game.host.untitledPlaylist', { id: '1234567' })).toBe('Playlist 1234567')
  })

  test('a key missing from the current language falls back to Italian, then to the key', async () => {
    await setLocale('en', false)
    expect(t('game.store.cancelled')).toBe('Operazione annullata.')
    expect(t('no.such.key' as MessageKey)).toBe('no.such.key')
    // A namespace or a list is not a message.
    expect(t('game.store' as MessageKey)).toBe('game.store')
    expect(t('names.nouns' as MessageKey)).toBe('names.nouns')
  })
})

describe('plurals (Intl.PluralRules)', () => {
  test('one / other (English)', async () => {
    await setLocale('en', false)
    expect(t(K.apples, { count: 1 })).toBe('1 apple')
    expect(t(K.apples, { count: 0 })).toBe('0 apples')
    expect(t(K.apples, { count: 2 })).toBe('2 apples')
    expect(t(K.apples, { count: 1200 })).toBe('1,200 apples')
  })

  test('French puts 0 and 1 in "one"', async () => {
    await setLocale('fr', false)
    expect(t(K.apples, { count: 0 })).toBe('0 pomme')
    expect(t(K.apples, { count: 1 })).toBe('1 pomme')
    expect(t(K.apples, { count: 2 })).toBe('2 pommes')
  })

  test('one / few / many / other (Russian)', async () => {
    await setLocale('ru', false)
    expect(t(K.apples, { count: 1 })).toBe('1 яблоко')
    expect(t(K.apples, { count: 3 })).toBe('3 яблока')
    expect(t(K.apples, { count: 5 })).toBe('5 яблок')
    expect(t(K.apples, { count: 11 })).toBe('11 яблок')
    expect(t(K.apples, { count: 21 })).toBe('21 яблоко')
    expect(t(K.apples, { count: 22 })).toBe('22 яблока')
    expect(t(K.apples, { count: 1.5 })).toBe('1,5 яблока')
    // Russian groups with a no-break space (U+00A0).
    expect(t(K.apples, { count: 5000 })).toBe('5 000 яблок')
  })

  test('languages with a single form, and a missing category, use "other"', async () => {
    await setLocale('ja', false)
    expect(t(K.apples, { count: 1 })).toBe('りんご1個')
    expect(t(K.apples, { count: 7 })).toBe('りんご7個')
    registerCatalog('ru', fake({ apples: { one: '{count} яблоко', other: '{count} яблока' } }))
    await setLocale('ru', false)
    expect(t(K.apples, { count: 5 })).toBe('5 яблока')
    registerCatalog('ru', RU)
  })

  test('an explicit zero form wins for exactly 0, in any language', async () => {
    registerCatalog('fr', fake({ apples: { zero: 'aucune pomme', one: '{count} pomme', other: '{count} pommes' } }))
    await setLocale('fr', false)
    expect(t(K.apples, { count: 0 })).toBe('aucune pomme')
    expect(t(K.apples, { count: 1 })).toBe('1 pomme')
    expect(t(K.apples, { count: 0.5 })).toBe('0,5 pomme')
    registerCatalog('fr', FR)
  })

  test('no count picks the plural of 0', async () => {
    await setLocale('en', false)
    expect(t(K.apples)).toBe('{count} apples')
  })
})

describe('formatNumber', () => {
  test('always groups thousands, in the current language', async () => {
    // Plain it-IT would print 4428 ungrouped next to 18.571.
    expect(formatNumber(4428)).toBe('4.428')
    expect(formatNumber(18571)).toBe('18.571')
    expect(formatNumber(999)).toBe('999')
    await setLocale('en', false)
    expect(formatNumber(4428)).toBe('4,428')
    await setLocale('fr', false)
    expect(formatNumber(4428)).toBe('4 428')
  })

  test('accepts Intl options', async () => {
    expect(formatNumber(0.25, { style: 'percent' })).toBe('25%')
    // Cached per language and options: the same call again, then other options.
    expect(formatNumber(0.25, { style: 'percent' })).toBe('25%')
    expect(formatNumber(0.25, { style: 'percent', minimumFractionDigits: 1 })).toBe('25,0%')
    expect(formatNumber(12345.678, { maximumFractionDigits: 1 })).toBe('12.345,7')
    await setLocale('en', false)
    expect(formatNumber(12345.678, { maximumFractionDigits: 1 })).toBe('12,345.7')
  })
})

describe('formatOrdinal', () => {
  test('Italian: one form', () => {
    expect([1, 2, 11, 21, 100].map(formatOrdinal)).toEqual(['1º', '2º', '11º', '21º', '100º'])
  })

  test('English picks one / two / few / other with the ORDINAL rules', async () => {
    await setLocale('en', false)
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(formatOrdinal)).toEqual(
      ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th'],
    )
  })

  test('French: "one" is only 1 (cardinal rules would also take 0)', async () => {
    await setLocale('fr', false)
    expect([0, 1, 2, 21].map(formatOrdinal)).toEqual(['0e', '1er', '2e', '21e'])
  })

  test('a language without ui.ordinal falls back to Italian', async () => {
    await setLocale('ja', false)
    expect(formatOrdinal(3)).toBe('3º')
  })

  test('messages take it as a string param', async () => {
    expect(t('round.hud.rank', { rank: formatOrdinal(2) })).toBe('2º posto')
    await setLocale('en', false)
    expect(t('reveal.board.was', { pos: formatOrdinal(3) })).toBe('era 3rd') // message not translated in the fake
  })
})

describe('formatList', () => {
  test('conjunction in the current language', async () => {
    expect(formatList([])).toBe('')
    expect(formatList(['Giulia'])).toBe('Giulia')
    expect(formatList(['Giulia', 'Tommy', 'Marco'])).toBe('Giulia, Tommy e Marco')
    await setLocale('en', false)
    expect(formatList(['Giulia', 'Tommy', 'Marco'])).toBe('Giulia, Tommy, and Marco')
  })

  test('disjunction', () => {
    expect(formatList(['A', 'B'], 'disjunction')).toBe('A o B')
  })
})

describe('tm / tl / td', () => {
  test('tm shows a Msg (key or key + params) in the current language', async () => {
    expect(tm('game.store.hostLost')).toBe('Connessione con l’host persa.')
    expect(tm({ key: 'game.host.notEnoughTracks', params: { count: 3 } })).toBe(
      'Questa playlist non ha abbastanza brani con anteprima (servono almeno 3).',
    )
    expect(tm(null)).toBe('')
    expect(tm(undefined)).toBe('')
    await setLocale('en', false)
    expect(tm('game.store.hostLost')).toBe('Lost the connection to the host.')
  })

  test('tl returns lists, falling back to Italian', async () => {
    expect(tl('names.titles')).toContain('DJ')
    await setLocale('en', false)
    expect(tl(K.words)).toEqual(['one', 'two'])
    expect(tl('names.titles')).toEqual(it.names.titles) // dropped from the fake English catalog
    expect(tl('game.store.hostLost' as ListKey)).toEqual([]) // a message is not a list
  })

  test('td returns per-language data', async () => {
    await setLocale('en', false)
    expect(td(K.data)).toEqual([{ label: 'Rap', query: 'rap' }] as never)
  })
})

// ---- rich() ----------------------------------------------------------------------

describe('rich', () => {
  const strong = (c: string) => createElement('strong', null, c)
  const em = (c: string) => createElement('em', null, c)
  const markup = (node: ReturnType<typeof rich>) => renderToStaticMarkup(createElement('p', null, node))

  test('turns tags into elements, keeping the text around them', () => {
    expect(markup(rich('Premi <b>Invio</b> per <em>ascoltare</em>.', { b: strong, em }))).toBe(
      '<p>Premi <strong>Invio</strong> per <em>ascoltare</em>.</p>',
    )
  })

  test('tags at the edges, repeated tags, text without tags', () => {
    expect(markup(rich('<b>A</b> e <b>B</b>', { b: strong }))).toBe('<p><strong>A</strong> e <strong>B</strong></p>')
    expect(markup(rich('<b>tutto</b>', { b: strong }))).toBe('<p><strong>tutto</strong></p>')
    expect(markup(rich('solo testo', { b: strong }))).toBe('<p>solo testo</p>')
    expect(markup(rich('', { b: strong }))).toBe('<p></p>')
  })

  test('unknown or mismatched tags stay as text', () => {
    expect(markup(rich('a <i>b</i> <b>c</b>', { b: strong }))).toBe('<p>a &lt;i&gt;b&lt;/i&gt; <strong>c</strong></p>')
    expect(markup(rich('a <b>b</em>', { b: strong, em }))).toBe('<p>a &lt;b&gt;b&lt;/em&gt;</p>')
  })

  test('a chunk may span lines and contain params already filled', () => {
    expect(markup(rich('<b>5.000\npunti</b>', { b: strong }))).toBe('<p><strong>5.000\npunti</strong></p>')
  })

  test('useT renders the current language', async () => {
    const Hello = () => createElement('span', null, useT()('game.store.hostLost'))
    expect(renderToStaticMarkup(createElement(Hello))).toBe('<span>Connessione con l’host persa.</span>')
    await setLocale('en', false)
    expect(renderToStaticMarkup(createElement(Hello))).toBe('<span>Lost the connection to the host.</span>')
  })
})

// ---- language choice ------------------------------------------------------------------

describe('detectLocale', () => {
  test('the saved choice wins', () => {
    storage.map.set('unshuffle:locale', 'fr')
    setBrowserLanguages(['ru-RU', 'en-US'])
    expect(detectLocale()).toBe('fr')
  })

  test('an invalid or unavailable saved choice is ignored', () => {
    setBrowserLanguages(['ru-RU'])
    storage.map.set('unshuffle:locale', 'klingon')
    expect(detectLocale()).toBe('ru')
    storage.map.set('unshuffle:locale', 'xx' as Locale)
    expect(detectLocale()).toBe('ru')
  })

  test('then the first browser language we have', () => {
    setBrowserLanguages(['sv-SE', 'fr-CA', 'en-US'])
    expect(detectLocale()).toBe('fr')
    setBrowserLanguages(['it-CH'])
    expect(detectLocale()).toBe('it')
  })

  test('navigator.language when languages is empty', () => {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, writable: true, value: { language: 'ja-JP', languages: [] } })
    expect(detectLocale()).toBe('ja')
  })

  test('then English', () => {
    setBrowserLanguages(['sv-SE', 'nl'])
    expect(detectLocale()).toBe('en')
    setBrowserLanguages([])
    expect(detectLocale()).toBe('en')
  })

  test('blocked storage is not an error', () => {
    storage.blocked = true
    setBrowserLanguages(['fr-FR'])
    expect(detectLocale()).toBe('fr')
  })

  test('matchLocale reads the language subtag of BCP 47 tags', () => {
    expect(matchLocale(['pt-PT'])).toBe('pt')
    expect(matchLocale(['zh-Hant-TW'])).toBe('zh')
    expect(matchLocale(['EN_us'])).toBe('en')
    expect(matchLocale(['xx', 'de-AT'])).toBe('de')
    expect(matchLocale(['xx'])).toBeNull()
    expect(matchLocale([])).toBeNull()
  })

  test('every locale has a name and a tag; registered ones are available', () => {
    for (const l of LOCALES) {
      expect(LOCALE_INFO[l].name.length).toBeGreaterThan(0)
      expect(() => new Intl.Locale(LOCALE_INFO[l].tag)).not.toThrow()
    }
    expect(availableLocales()).toEqual(expect.arrayContaining(['it', 'en', 'fr', 'ru', 'ja']))
  })
})

describe('setLocale', () => {
  test('switches the language, remembers it and sets <html lang>', async () => {
    await setLocale('fr')
    expect(currentLocale()).toBe('fr')
    expect(useI18n.getState().catalog).toBe(FR)
    expect(storage.map.get('unshuffle:locale')).toBe('fr')
    expect(html.lang).toBe('fr-FR')
    expect(detectLocale()).toBe('fr')
  })

  test('remember = false leaves the saved choice alone', async () => {
    await setLocale('fr')
    await setLocale('ru', false)
    expect(currentLocale()).toBe('ru')
    expect(html.lang).toBe('ru-RU')
    expect(storage.map.get('unshuffle:locale')).toBe('fr')
  })

  test('blocked storage: the switch still happens', async () => {
    storage.blocked = true
    await setLocale('en')
    expect(currentLocale()).toBe('en')
    expect(html.lang).toBe('en')
  })

  test('a language without a catalog rejects and changes nothing', async () => {
    await setLocale('en', false)
    await expect(setLocale('xx' as Locale)).rejects.toThrow('No catalog for xx')
    expect(currentLocale()).toBe('en')
    expect(storage.map.has('unshuffle:locale')).toBe(false)
  })

  test('the last of two quick switches wins', async () => {
    await Promise.all([setLocale('ru', false), setLocale('fr', false)])
    expect(currentLocale()).toBe('fr')
  })
})

// ---- messages from non-UI code ------------------------------------------------------------

describe('Msg helpers', () => {
  test('isMessageKey accepts message keys of the source catalog only', () => {
    expect(isMessageKey('game.store.cancelled')).toBe(true)
    expect(isMessageKey('names.pattern')).toBe(true)
    expect(isMessageKey('game.store')).toBe(false) // a namespace
    expect(isMessageKey('names.titles')).toBe(false) // a list
    expect(isMessageKey('game.store.cancelled.length')).toBe(false)
    expect(isMessageKey('__proto__')).toBe(false)
    expect(isMessageKey('game.constructor')).toBe(false)
    expect(isMessageKey('Operazione annullata.')).toBe(false)
    expect(isMessageKey('')).toBe(false)
    expect(isMessageKey(42)).toBe(false)
    expect(isMessageKey(null)).toBe(false)
  })

  test('msgKey', () => {
    expect(msgKey('game.store.cancelled')).toBe('game.store.cancelled')
    expect(msgKey({ key: 'game.host.notEnoughTracks', params: { count: 3 } })).toBe('game.host.notEnoughTracks')
    expect(msgKey(null)).toBeNull()
    expect(msgKey(undefined)).toBeNull()
  })

  test('AppError carries its Msg; msgOf reads it back', async () => {
    const plain = new AppError('game.store.cancelled')
    expect(plain).toBeInstanceOf(Error)
    expect(plain.name).toBe('AppError')
    expect(plain.message).toBe('game.store.cancelled')
    expect(plain.msg).toBe('game.store.cancelled')

    const withParams = new AppError({ key: 'game.host.notEnoughTracks', params: { count: 4 } })
    expect(withParams.message).toBe('game.host.notEnoughTracks')
    expect(msgOf(withParams, 'game.store.actionFailed')).toEqual({ key: 'game.host.notEnoughTracks', params: { count: 4 } })
    await setLocale('en', false)
    expect(tm(msgOf(withParams, 'game.store.actionFailed'))).toBe('This playlist needs at least 4 tracks with a preview.')

    expect(msgOf(new Error('boom'), 'game.store.actionFailed')).toBe('game.store.actionFailed')
    expect(msgOf('game.store.cancelled', 'game.store.actionFailed')).toBe('game.store.actionFailed')
    expect(msgOf(undefined, 'game.store.actionFailed')).toBe('game.store.actionFailed')
  })
})
