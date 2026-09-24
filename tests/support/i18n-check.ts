// Checks a translated catalog against the Italian source, key by key:
//   bun tests/support/i18n-check.ts <locale> [--strict]
// The rules live in ./i18n-validate.ts (the unit test tests/unit/i18n-catalog.test.ts
// runs the same checks on every registered language):
// - same {params} and <tags> in every message (and in every plural form),
// - plural objects use only categories Intl.PluralRules knows for the language
//   (ordinal rules for ui.ordinal) and always have `other`,
// - lists and data have the same kind of content (names, chips, featured ids),
// - nicknames: enough "title noun" combinations fit 16 characters,
// - with --strict, messages identical to the Italian text are reported (a
//   translation left in Italian), except strings with no words of their own
//   ("{count}/{max}", "R{round}").
// Exit code 1 on problems. The type checker already guarantees the key set.

import it from '../../src/i18n/locales/it'
import { LOCALE_INFO, isLocale } from '../../src/i18n/locales'
import { checkCatalog } from './i18n-validate'

const [code, flag] = process.argv.slice(2)
if (!isLocale(code) || code === 'it') {
  console.error('usage: bun tests/support/i18n-check.ts <locale> [--strict]')
  process.exit(2)
}
const mod = (await import(`../../src/i18n/locales/${code}/index.ts`)) as { default: unknown }
const problems = checkCatalog(it, mod.default, LOCALE_INFO[code].tag, { strict: flag === '--strict' })

if (problems.length) {
  console.log(`${code}: ${problems.length} problem(s)\n` + problems.map((p) => '  - ' + p).join('\n'))
  process.exit(1)
}
console.log(`${code}: OK`)
