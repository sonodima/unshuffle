// Locale-aware number and clock formatting for the UI (pure, no React), on top of
// the i18n core. Reads the current language at call time; components re-render on
// a language change through useT() / useLocale().
import { formatNumber as formatLocaleNumber, t } from '../../i18n'

/**
 * Scores and counts in the current language: 13840 → "13.840" (it) / "13,840" (en).
 * Rounded; thousands always grouped (the core's rule), so "4.428" sits well next to "18.571".
 */
export function formatNumber(n: number): string {
  return formatLocaleNumber(Math.round(n))
}

/** Whole seconds as m:ss in the current language's digits: 65 → "1:05", 9 → "0:09". */
export function formatSeconds(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const ss = formatLocaleNumber(total % 60).padStart(2, formatLocaleNumber(0))
  return `${formatLocaleNumber(Math.floor(total / 60))}:${ss}`
}

/** 65000 → "1:05", 9000 → "0:09". Ceil so a timer never shows 0 while time remains. */
export function formatClock(ms: number): string {
  return formatSeconds(Math.ceil(ms / 1000))
}

/** Joins separate facts of a screen-reader label ("Marco, host, disconnesso"); empty parts are skipped. */
export function joinFacts(parts: ReadonlyArray<string | false | null | undefined>): string {
  return parts.filter((p): p is string => !!p).join(t('ui.listSeparator'))
}
