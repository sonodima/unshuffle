// Checks a translated catalog against the Italian source, key by key. Shared by the
// CLI (tests/support/i18n-check.ts) and CI (tests/unit/i18n-catalog.test.ts):
// - same {params} and <tags> in every message (and in every plural form); tags are
//   closed and not nested, braces only around {param} names, no stray outer spaces,
// - plural objects use only categories Intl.PluralRules knows for the language
//   (ordinal rules for ui.ordinal) and always have `other`,
// - lists and data have the same kind of content (names, chips, featured ids),
// - nicknames: enough "title noun" combinations fit 16 characters,
// - with `strict`, messages identical to the Italian text are reported (a
//   translation left in Italian), except strings with no words of their own.
// The type checker already guarantees the key set.

export interface CheckOptions {
  /** Also report messages left identical to the Italian source. */
  strict?: boolean
}

const PARAM = /\{(\w+)\}/g
const TAG = /<(\/?)(\w+)>/g
/** Keys whose text is only whitespace / punctuation by design. */
const PADDED = new Set(['ui.listSeparator'])

const setOf = (re: RegExp, s: string, group: number) => new Set([...s.matchAll(re)].map((m) => m[group]))
const same = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x))
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const isPlural = (x: unknown): x is Record<string, string> => isObj(x) && typeof x.other === 'string'

function forms(x: unknown): string[] {
  return typeof x === 'string' ? [x] : isPlural(x) ? Object.values(x) : []
}

/** Tags closed in order and never nested; `{` / `}` only around a param name. */
function markupProblems(path: string, text: string): string[] {
  const out: string[] = []
  const stack: string[] = []
  for (const [, close, name] of text.matchAll(TAG)) {
    if (!close) {
      if (stack.length) out.push(`${path}: <${name}> nested in <${stack[0]}> in "${text}"`)
      stack.push(name)
    } else if (stack.pop() !== name) out.push(`${path}: </${name}> closes nothing in "${text}"`)
  }
  if (stack.length) out.push(`${path}: <${stack[0]}> never closed in "${text}"`)
  if (/[{}]/.test(text.replace(/\{\w+\}/g, ''))) out.push(`${path}: stray { or } in "${text}"`)
  return out
}

/** Letters of the message itself (param names and tag names don't count). */
const ownWords = (s: string) => s.replace(PARAM, '').replace(TAG, '')

/**
 * Every problem of `target` (a catalog for the BCP 47 `tag`) against the Italian
 * `source`, as "key: what's wrong" lines. Empty means OK.
 */
export function checkCatalog(source: unknown, target: unknown, tag: string, options: CheckOptions = {}): string[] {
  const problems: string[] = []
  const cardinal = new Set<string>(new Intl.PluralRules(tag).resolvedOptions().pluralCategories)
  const ordinal = new Set<string>(new Intl.PluralRules(tag, { type: 'ordinal' }).resolvedOptions().pluralCategories)

  function checkMessage(path: string, src: unknown, dst: unknown): void {
    const srcForms = forms(src)
    const dstForms = forms(dst)
    if (!dstForms.length) return void problems.push(`${path}: not a string / plural`)
    if (isObj(dst) && !isPlural(dst)) return void problems.push(`${path}: a plural needs an "other" form`)
    if (isPlural(dst) && Object.values(dst).some((f) => typeof f !== 'string')) problems.push(`${path}: every plural form must be a string`)
    const params = setOf(PARAM, srcForms.join(' '), 1)
    const tags = setOf(TAG, srcForms.join(' '), 2)
    for (const f of dstForms) {
      if (typeof f !== 'string') continue
      // A plural form may omit {count} (e.g. "one" written as a word), never add unknown params.
      const p = setOf(PARAM, f, 1)
      for (const name of p) if (!params.has(name)) problems.push(`${path}: unknown param {${name}} in "${f}"`)
      if (!isPlural(src)) for (const name of params) if (!p.has(name)) problems.push(`${path}: missing param {${name}} in "${f}"`)
      if (!same(setOf(TAG, f, 2), tags)) problems.push(`${path}: tags differ from the source (${[...tags].join(', ') || 'none'}) in "${f}"`)
      problems.push(...markupProblems(path, f))
      if (f !== f.trim() && !PADDED.has(path)) problems.push(`${path}: leading / trailing whitespace in "${f}"`)
      if (!f.trim() && !PADDED.has(path)) problems.push(`${path}: empty text`)
    }
    if (isPlural(src) !== isPlural(dst)) problems.push(`${path}: the source is ${isPlural(src) ? 'a plural' : 'a plain string'}, the translation is not`)
    if (isPlural(dst)) {
      const rules = path === 'ui.ordinal' ? ordinal : cardinal
      for (const k of Object.keys(dst)) if (!rules.has(k)) problems.push(`${path}: plural category "${k}" does not exist in ${tag}`)
    }
    if (options.strict && typeof src === 'string' && src === dst && /[a-zà-ù]{4,}/i.test(ownWords(src))) problems.push(`${path}: identical to Italian: "${src}"`)
  }

  function walk(path: string, src: unknown, dst: unknown): void {
    if (typeof src === 'string' || isPlural(src)) return checkMessage(path, src, dst)
    if (Array.isArray(src)) {
      if (!Array.isArray(dst) || dst.length === 0) return void problems.push(`${path}: expected a non-empty list`)
      // Item shape: a string, a number, or an object with the same keys and value types as the source's.
      const kind = (x: unknown) =>
        isObj(x)
          ? JSON.stringify(Object.keys(x).sort().map((k) => [k, typeof x[k]]))
          : typeof x
      if (src.length && dst.some((x) => kind(x) !== kind(src[0]))) problems.push(`${path}: list items differ in shape from the source (${kind(src[0])})`)
      if (dst.some((x) => typeof x === 'string' && !x.trim())) problems.push(`${path}: empty string in the list`)
      if (dst.every((x) => typeof x === 'string') && new Set(dst).size !== dst.length) problems.push(`${path}: duplicate items in the list`)
      return
    }
    if (isObj(src)) {
      if (!isObj(dst)) return void problems.push(`${path}: expected an object`)
      for (const k of Object.keys(src)) {
        const key = path ? `${path}.${k}` : k
        if (!(k in dst)) problems.push(`${key}: missing`)
        else walk(key, src[k], dst[k])
      }
      for (const k of Object.keys(dst)) if (!(k in src)) problems.push(`${path ? path + '.' : ''}${k}: not in the source`)
    }
  }

  walk('', source, target)

  // Nicknames: the generator keeps only "title noun" combinations that fit 16 code points.
  const names = isObj(target) ? (target.names as { pattern?: unknown; titles?: unknown; nouns?: unknown } | undefined) : undefined
  if (names && typeof names.pattern === 'string' && Array.isArray(names.titles) && Array.isArray(names.nouns)) {
    let fit = 0
    for (const title of names.titles as string[]) {
      for (const noun of names.nouns as string[]) {
        const name = names.pattern.replace('{title}', title).replace('{noun}', noun)
        if (Array.from(name).length <= 16) fit++
      }
    }
    if (fit < 200) problems.push(`names: only ${fit} nickname combinations fit 16 characters (want ≥ 200)`)
  }

  return problems
}
