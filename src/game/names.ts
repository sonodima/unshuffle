// Fun default nicknames ("DJ Pinguino", "MC Lasagna", "Lady Vinile"…) and
// nickname sanitizing. Every generated name fits MAX_NAME_LENGTH.

import { MAX_NAME_LENGTH } from './constants'
import { randomInt } from './shuffle'

const NAME_TITLES = [
  'DJ', 'MC', 'Lady', 'Mister', 'Miss', 'Capitan', 'Dottor', 'Maestro', 'Zio', 'Zia',
  'Baby', 'Lil', 'Big', 'King', 'Queen', 'Sir', 'Don', 'Mega', 'Super', 'Prof',
  'Conte', 'Duca', 'Madame', 'Signor', 'Nonna',
] as const

const NAME_NOUNS = [
  // cibo
  'Lasagna', 'Tortellino', 'Cannolo', 'Pistacchio', 'Arancino', 'Gnocco', 'Espresso',
  'Maritozzo', 'Carbonara', 'Panettone', 'Gorgonzola', 'Grissino', 'Tiramisù', 'Zucchina',
  'Melanzana', 'Cornetto', 'Babà', 'Bombolone', 'Carciofo', 'Lupino', 'Pomodoro',
  'Limone', 'Peperoncino', 'Basilico', 'Mozzarella', 'Frittata', 'Piadina', 'Cantucci',
  // animali
  'Pinguino', 'Bassotto', 'Fenicottero', 'Riccio', 'Polpo', 'Bradipo', 'Koala', 'Criceto',
  'Alpaca', 'Panda', 'Tucano', 'Geco', 'Castoro', 'Procione', 'Delfino', 'Capibara',
  'Orsetto', 'Gufo', 'Lama', 'Gattone', 'Fagiano', 'Lumaca', 'Axolotl',
  // musica
  'Vinile', 'Mandolino', 'Tamburello', 'Cassetta', 'Subwoofer', 'Giradischi', 'Ukulele',
  'Triangolo', 'Maracas', 'Theremin', 'Ottavino', 'Metronomo', 'Kazoo', 'Bongo',
  'Falsetto', 'Ritornello', 'Assolo', 'Bemolle', 'Diesis', 'Remix', 'Karaoke', 'Jukebox',
  'Cuffietta', 'Vocoder', 'Glitter', 'Stereo',
] as const

function pick<T>(list: readonly T[]): T {
  return list[randomInt(list.length)]
}

/** A random fun Italian nickname, always ≤ MAX_NAME_LENGTH characters. */
export function randomPlayerName(): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    const title = pick(NAME_TITLES)
    const fitting = NAME_NOUNS.filter((n) => nameLength(title) + 1 + nameLength(n) <= MAX_NAME_LENGTH)
    if (fitting.length) return `${title} ${pick(fitting)}`
  }
  return 'DJ Pinguino'
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
