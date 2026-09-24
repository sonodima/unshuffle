// Catalog types. The Italian catalog (./locales/it) is the source of truth: every
// other locale must have exactly its shape (`satisfies Catalog`), and message keys
// are checked at compile time.

import type it from './locales/it'

/**
 * Plural forms, chosen with Intl.PluralRules for `params.count`. Each locale lists
 * the categories its language uses (Italian one/other, Russian one/few/many/other,
 * Japanese other only…). Avoid naming a catalog key `other` elsewhere.
 */
export interface Plural {
  zero?: string
  one?: string
  two?: string
  few?: string
  many?: string
  other: string
}

export type Params = Record<string, string | number>

type Widen<T> = T extends string
  ? string
  : T extends Plural
    ? Plural
    : T extends readonly (infer U)[]
      ? readonly Widen<U>[]
      : T extends object
        ? { readonly [K in keyof T]: Widen<T[K]> }
        : T

export type Catalog = Widen<typeof it>

type Leaf = string | Plural

type MessageKeysOf<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends Leaf
    ? `${P}${K}`
    : T[K] extends readonly unknown[]
      ? never
      : T[K] extends object
        ? MessageKeysOf<T[K], `${P}${K}.`>
        : never
}[keyof T & string]

type ListKeysOf<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends readonly string[]
    ? `${P}${K}`
    : T[K] extends Leaf | readonly unknown[]
      ? never
      : T[K] extends object
        ? ListKeysOf<T[K], `${P}${K}.`>
        : never
}[keyof T & string]

type DataKeysOf<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends readonly (object | number)[]
    ? `${P}${K}`
    : T[K] extends Leaf | readonly unknown[]
      ? never
      : T[K] extends object
        ? DataKeysOf<T[K], `${P}${K}.`>
        : never
}[keyof T & string]

export type PathValue<T, K extends string> = K extends `${infer H}.${infer R}`
  ? H extends keyof T
    ? PathValue<T[H], R>
    : never
  : K extends keyof T
    ? T[K]
    : never

/** A translatable string (text or plural), e.g. 'home.createRoom'. */
export type MessageKey = MessageKeysOf<Catalog>
/** A list of strings, e.g. 'names.nouns'. */
export type ListKey = ListKeysOf<Catalog>
/** Per-language data: a list of objects or numbers, e.g. 'lobby.chips'. */
export type DataKey = DataKeysOf<Catalog>

/**
 * A message produced away from the UI (host, network, store) and translated where
 * it is shown, in the viewer's language.
 */
export type Msg = MessageKey | { key: MessageKey; params?: Params }
