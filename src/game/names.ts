// Fun default nicknames from the current language's catalog ("DJ Pinguino",
// "MC Lasagna"…) and nickname sanitizing. Every generated name fits MAX_NAME_LENGTH.

import { t, tl } from '../i18n'
import { MAX_NAME_LENGTH } from './constants'
import { randomInt } from './shuffle'

function pick<T>(list: readonly T[]): T {
  return list[randomInt(list.length)]
}

/** A random fun nickname in the current language, always ≤ MAX_NAME_LENGTH characters. */
export function randomPlayerName(): string {
  const titles = tl('names.titles')
  const nouns = tl('names.nouns')
  const compose = (title: string, noun: string) => t('names.pattern', { title, noun })
  for (let attempt = 0; attempt < 20 && titles.length && nouns.length; attempt++) {
    const title = pick(titles)
    const fitting = nouns.filter((n) => nameLength(compose(title, n)) <= MAX_NAME_LENGTH)
    if (fitting.length) return compose(title, pick(fitting))
  }
  return sanitizeName(titles.length && nouns.length ? compose(titles[0], nouns[0]) : 'DJ')
}

/** Length in user-perceived characters (code points), matching sanitizeName's cut. */
function nameLength(name: string): number {
  return Array.from(name).length
}

/**
 * Normalize a user-typed nickname: strip control / zero-width characters,
 * collapse whitespace, trim, cut to MAX_NAME_LENGTH code points (never splits
 * a surrogate pair). Returns '' when nothing usable is left.
 */
export function sanitizeName(input: unknown): string {
  if (typeof input !== 'string') return ''
  const cleaned = input
    .normalize('NFC')
    // Control characters are exactly what this strips.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b\u200c\u200e\u200f\u2028-\u202f\u2060-\u206f\ufeff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return Array.from(cleaned).slice(0, MAX_NAME_LENGTH).join('').trim()
}
