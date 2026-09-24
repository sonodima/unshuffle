// The shape of the translation catalog (src/i18n/locales/it, the source every other
// locale mirrors), that every registered language mirrors it (the checks of
// tests/support/i18n-check.ts: params, tags, plural categories, list / data shapes)
// and that every key is read from the CURRENT language.
// Run: bun test ./tests/unit/i18n-catalog.test.ts
//
// Catalogs are pure data: strings, plurals (objects keyed by Intl.PluralRules
// categories), lists of strings and per-language data (lists of plain objects or
// numbers). No functions, no computed text: translators edit them by hand.

import { afterAll, describe, expect, test } from 'bun:test'
import { readdirSync } from 'node:fs'
import it from '../../src/i18n/locales/it'
import { LOCALE_INFO, SOURCE_LOCALE, availableLocales, registerCatalog, setLocale, t, td, tl, useI18n } from '../../src/i18n'
import type { Catalog, DataKey, ListKey, MessageKey } from '../../src/i18n'
import { checkCatalog } from '../support/i18n-validate'

const CATEGORIES = new Set(['zero', 'one', 'two', 'few', 'many', 'other'])

type Leaf =
  | { kind: 'message'; key: string; texts: string[] }
  | { kind: 'list'; key: string; items: string[] }
  | { kind: 'data'; key: string }

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const isPluralShape = (x: Record<string, unknown>) => 'other' in x

/** Every leaf of the catalog, and a description of anything that isn't one of the allowed shapes. */
function walk(node: unknown, key: string, leaves: Leaf[], problems: string[]): void {
  if (typeof node === 'string') {
    leaves.push({ kind: 'message', key, texts: [node] })
  } else if (Array.isArray(node)) {
    if (node.every((x) => typeof x === 'string')) leaves.push({ kind: 'list', key, items: node })
    else if (node.every((x) => typeof x === 'number' || (isRecord(x) && Object.values(x).every((v) => typeof v === 'string' || typeof v === 'number'))))
      leaves.push({ kind: 'data', key })
    else problems.push(`${key}: a list must hold only strings, or only numbers / flat objects of strings and numbers`)
  } else if (isRecord(node)) {
    if (isPluralShape(node)) {
      const bad = Object.entries(node).filter(([k, v]) => !CATEGORIES.has(k) || typeof v !== 'string')
      if (bad.length) problems.push(`${key}: a plural holds only string forms named ${[...CATEGORIES].join(' / ')} (got ${bad.map(([k]) => k).join(', ')})`)
      else leaves.push({ kind: 'message', key, texts: Object.values(node) as string[] })
      return
    }
    const entries = Object.entries(node)
    if (!entries.length) problems.push(`${key}: empty group`)
    for (const [k, v] of entries) walk(v, key ? `${key}.${k}` : k, leaves, problems)
  } else {
    problems.push(`${key}: ${typeof node} is not a catalog value (strings, plurals, lists only)`)
  }
}

const leaves: Leaf[] = []
const problems: string[] = []
walk(it, '', leaves, problems)
const messages = leaves.filter((l): l is Extract<Leaf, { kind: 'message' }> => l.kind === 'message')

describe('the Italian catalog', () => {
  test('holds only strings, plurals, lists and flat data (no functions, no other values)', () => {
    expect(problems).toEqual([])
    expect(messages.length).toBeGreaterThan(500)
  })

  test('rich() tags are balanced and not nested; {params} are single words', () => {
    const bad: string[] = []
    for (const { key, texts } of messages) {
      for (const text of texts) {
        const stack: string[] = []
        for (const [, close, name] of text.matchAll(/<(\/?)(\w+)>/g)) {
          if (!close) {
            if (stack.length) bad.push(`${key}: <${name}> nested in <${stack[0]}>`)
            stack.push(name)
          } else if (stack.pop() !== name) bad.push(`${key}: </${name}> closes nothing`)
        }
        if (stack.length) bad.push(`${key}: <${stack[0]}> never closed`)
        const braces = text.replace(/\{\w+\}/g, '')
        if (/[{}]/.test(braces)) bad.push(`${key}: stray { or } in "${text}"`)
      }
    }
    expect(bad).toEqual([])
  })

  test('the forms of one plural use the same tags', () => {
    const bad: string[] = []
    for (const { key, texts } of messages) {
      const tags = texts.map((s) => [...s.matchAll(/<(\w+)>/g)].map((m) => m[1]).join(','))
      if (new Set(tags).size > 1) bad.push(`${key}: ${tags.join(' | ')}`)
    }
    expect(bad).toEqual([])
  })

  test('texts have no stray outer whitespace', () => {
    const bad = messages.flatMap(({ key, texts }) => texts.filter((s) => s !== s.trim() && key !== 'ui.listSeparator').map(() => key))
    expect(bad).toEqual([])
  })
})

// ---- every registered language mirrors the source -------------------------------------

// Before the switching test below: it installs a stand-in German catalog.
describe('every registered language', () => {
  const registered = availableLocales().filter((l) => l !== SOURCE_LOCALE)

  test('every locales/<code>/ folder has a loader, and every loader a folder', () => {
    const dirs = readdirSync(new URL('../../src/i18n/locales/', import.meta.url), { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== SOURCE_LOCALE)
      .map((d) => d.name)
      .sort()
    expect([...registered].sort()).toEqual(dirs)
  })

  for (const code of registered) {
    test(`${code}: loads through LOADERS and matches the Italian params, tags, plurals and data`, async () => {
      await setLocale(code, false)
      const { locale, catalog } = useI18n.getState()
      expect(locale).toBe(code)
      expect(catalog).not.toBe(it as unknown as Catalog)
      expect(checkCatalog(it, catalog, LOCALE_INFO[code].tag)).toEqual([])
      // Not a copy of Italian with a few strings changed: loanwords and key caps only.
      const identical = checkCatalog(it, catalog, LOCALE_INFO[code].tag, { strict: true }).filter((p) => p.includes('identical to Italian'))
      expect(identical.length).toBeLessThan(messages.length * 0.05)
    })
  }
})

// ---- every key goes through the current language -------------------------------------

/** A stand-in language: every text wrapped in ⟦…⟧ (tags and {params} kept), lists / data changed too. */
function stub(node: unknown): unknown {
  if (typeof node === 'string') return `⟦${node}⟧`
  if (Array.isArray(node)) return node.map((x) => (typeof x === 'string' ? `⟦${x}⟧` : typeof x === 'number' ? x + 1 : { ...(x as object), stub: true }))
  if (isRecord(node)) return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, stub(v)]))
  return node
}

afterAll(async () => {
  await setLocale(SOURCE_LOCALE, false)
})

describe('switching language', () => {
  test('t / tl / td read every key from the new catalog, and back', async () => {
    registerCatalog('de', stub(it) as Catalog)
    await setLocale('de', false)
    const stale: string[] = []
    for (const leaf of leaves) {
      if (leaf.kind === 'message') {
        // No params: plurals pick the form of 0 ("other" in German), placeholders stay as typed.
        const out = t(leaf.key as MessageKey)
        if (!out.startsWith('⟦') || !out.endsWith('⟧')) stale.push(`${leaf.key} → ${out}`)
      } else if (leaf.kind === 'list') {
        if (!tl(leaf.key as ListKey).every((s) => s.startsWith('⟦'))) stale.push(leaf.key)
      } else if (JSON.stringify(td(leaf.key as DataKey)) === JSON.stringify(leaf.key.split('.').reduce<unknown>((n, k) => (n as Record<string, unknown>)[k], it))) {
        stale.push(leaf.key)
      }
    }
    expect(stale).toEqual([])

    await setLocale('it', false)
    expect(t('lobby.start')).toBe('Inizia partita')
  })
})
