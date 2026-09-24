// React bindings: useT() re-renders on a language change; rich() turns inline
// tags in a translated string into elements.

import { Fragment, type ReactNode } from 'react'
import { t, useI18n } from './index'
import type { Locale } from './locales'

/** The translate function; subscribing re-renders the component when the language changes. */
export function useT(): typeof t {
  useI18n((s) => s.catalog)
  return t
}

export function useLocale(): Locale {
  return useI18n((s) => s.locale)
}

/**
 * Inline markup in a message: rich(t('home.tagline'), { b: (c) => <strong>{c}</strong> }).
 * Tags are `<name>…</name>`, not nested; unknown tags are left as text.
 */
export function rich(text: string, tags: Record<string, (chunk: string) => ReactNode>): ReactNode {
  const out: ReactNode[] = []
  const re = /<(\w+)>([\s\S]*?)<\/\1>/g
  let last = 0
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const render = tags[m[1]]
    if (!render) continue
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(<Fragment key={out.length}>{render(m[2])}</Fragment>)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}
