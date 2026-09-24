// Guard: no user-facing text outside the translation catalog (src/i18n/locales).
// Run: bun test ./tests/unit/i18n-hardcoded.test.ts   ·   report only: bun tests/support/i18n-scan.ts
//
// The scanner (tests/support/i18n-scan.ts) parses every production .ts / .tsx under
// src/ with the TypeScript compiler API. The first block checks the scanner itself on
// small snippets; the last test scans the real sources and prints a report grouped by
// file. A deliberate exception takes `// i18n-ignore: <reason>` on its line or the one above.

import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { isMessageKey } from '../../src/i18n'
import { formatReport, scanSource, scanTree } from '../support/i18n-scan'
import type { Rule } from '../support/i18n-scan'

const opts = { isKey: isMessageKey }

/** "rule text" for every finding in a snippet. */
function scan(code: string, file = 'src/x.tsx'): string[] {
  return scanSource(file, code, opts).map((f) => `${f.rule} ${f.text}`)
}

function rules(code: string, file = 'src/x.tsx'): Rule[] {
  return scanSource(file, code, opts).map((f) => f.rule)
}

describe('scanner', () => {
  test('JSX text and string children', () => {
    expect(scan('const a = <p>Ciao mondo</p>')).toEqual(['jsx-text Ciao mondo'])
    expect(scan("const a = <p>{ok ? 'Sì' : 'No'}</p>")).toEqual(["jsx-text 'Sì'", "jsx-text 'No'"])
    expect(scan('const a = <p>{`${n} pt`}</p>')).toEqual(['jsx-text `${n} pt`'])
    expect(scan("const a = <p>{ready && 'Pronto'}</p>")).toEqual(["jsx-text 'Pronto'"])
  })

  test('attributes and props that hold text', () => {
    expect(scan('const a = <button aria-label="Chiudi" />')).toEqual(['jsx-attr "Chiudi"'])
    expect(scan('const a = <img alt="Copertina" title={`Round ${n}`} />')).toEqual(['jsx-attr "Copertina"', 'jsx-attr `Round ${n}`'])
    expect(scan("const a = <Modal confirmLabel={busy ? 'Attendi' : label} />")).toEqual(["jsx-attr 'Attendi'"])
    expect(scan('const a = <input placeholder="Nome" />')).toEqual(['jsx-attr "Nome"'])
    expect(scan("const TABS = [{ id: 'players', label: 'Giocatori' }]", 'src/x.ts')).toEqual(["text-prop 'Giocatori'"])
  })

  test('toasts, dialogs and DOM text', () => {
    expect(scan("notify('Link copiato!')", 'src/x.ts')).toEqual(["toast 'Link copiato!'"])
    expect(scan("window.confirm('Vuoi uscire?')", 'src/x.ts')).toEqual(["toast 'Vuoi uscire?'"])
    expect(scan("document.title = 'UNSHUFFLE · Classifica'", 'src/x.ts')).toEqual(["dom-text 'UNSHUFFLE · Classifica'"])
    expect(scan("el.setAttribute('aria-label', 'Chiudi')", 'src/x.ts')).toEqual(["dom-text 'Chiudi'"])
    expect(rules("const announcements = { onDragStart: ({ active }) => `Hai sollevato ${active.id}` }", 'src/x.ts')).toEqual([
      'dom-text',
    ])
    expect(rules("const a = <DndContext accessibility={{ screenReaderInstructions: { draggable: 'Premi Invio' } }} />")).toEqual([
      'jsx-attr',
    ])
  })

  test('Italian prose anywhere else', () => {
    expect(scan("throw new Error('Audio non disponibile')", 'src/x.ts')).toEqual(["italian 'Audio non disponibile'"])
    expect(scan("console.warn(`[audio] ${key} non è caricato`)", 'src/x.ts')).toEqual(['italian `[audio] ${key} non è caricato`'])
    expect(scan("const s = { body: 'Connessione con l’host persa' }", 'src/x.ts')).toEqual(["italian 'Connessione con l’host persa'"])
    // English diagnostics, hyphenated words and identifiers are fine.
    expect(scan("console.warn('[net] non-fatal error, retrying per request')", 'src/x.ts')).toEqual([])
    expect(scan("const u = 'https://www.deezer.com/track/1'", 'src/x.ts')).toEqual([])
  })

  test('allowed: keys, brand, symbols, key caps, classes, data, calls to t()', () => {
    const allowed = [
      "const a = <p>{t('game.store.cancelled')}</p>",
      "const a = <Button label=\"game.store.cancelled\" />",
      "const a = <button aria-label={t('game.host.notEnoughTracks', { count: 3 })} />",
      'const a = <h1>UNSHUFFLE</h1>',
      'const a = <span>{bpm} BPM</span>',
      'const a = <span>🔥 · — / ✓ ✗ 12 {"%"} &nbsp; &times;</span>',
      'const a = <Kbd>K</Kbd>',
      'const a = <div className="flex items-center gap-2" data-state="open" data-testid="board" />',
      "const a = <Chip label={cn('px-2 text-sm', on && 'bg-white')} />",
      "const a = <input enterKeyHint=\"done\" inputMode=\"text\" type=\"text\" />",
      "const TABS = [{ id: 'players', icon: 'users', label: 'game.store.cancelled' }]",
      "notify('game.store.cancelled')",
      'const a = <p>{name}</p>',
    ]
    for (const code of allowed) expect({ code, found: scan(code) }).toEqual({ code, found: [] })
  })

  test('i18n-ignore on the line or the line above, with a reason', () => {
    expect(scan('const a = <input placeholder="KXQPM" /> // i18n-ignore: room code sample')).toEqual([])
    expect(scan('// i18n-ignore: brand mark\nconst a = <span>UN</span>')).toEqual([])
    expect(scan('const a = (\n  <div>\n    {/* i18n-ignore: brand mark */}\n    <span>UN</span>\n  </div>\n)')).toEqual([])
    expect(rules('const a = <span>UN</span> // i18n-ignore')).toEqual(['ignore-reason'])
    // Only the covered line; a trailing comment covers its own line, not the next one.
    expect(scan('// i18n-ignore: brand mark\nconst a = <span>UN</span>\nconst b = <span>Ciao</span>')).toEqual(['jsx-text Ciao'])
    expect(scan('const a = <span>UN</span> // i18n-ignore: brand mark\nconst b = <span>Ciao</span>')).toEqual(['jsx-text Ciao'])
  })

  test('positions are 1-based and point at the text', () => {
    const [f] = scanSource('src/x.tsx', 'const a = (\n  <p>\n    Ciao\n  </p>\n)', opts)
    expect({ line: f.line, col: f.col }).toEqual({ line: 3, col: 5 })
  })

  test('the report groups findings by file', () => {
    const report = formatReport([
      { file: 'src/a.tsx', line: 3, col: 5, rule: 'jsx-text', text: 'Ciao' },
      { file: 'src/b.ts', line: 1, col: 1, rule: 'italian', text: "'non va'" },
      { file: 'src/a.tsx', line: 9, col: 2, rule: 'jsx-attr', text: '"Chiudi"' },
    ])
    expect(report.split('\n')[0]).toBe('3 hardcoded user-facing string(s) in 2 file(s): jsx-text 1, italian 1, jsx-attr 1')
    expect(report).toContain('\nsrc/a.tsx (2)\n  3:5      jsx-text      Ciao\n  9:2      jsx-attr      "Chiudi"\n')
    expect(report).toContain("\nsrc/b.ts (1)\n  1:1      italian       'non va'")
    expect(formatReport([])).toBe('')
  })
})

test('src/ has no user-facing text outside the catalog', () => {
  const started = performance.now()
  const findings = scanTree(join(import.meta.dir, '..', '..'), opts)
  expect(performance.now() - started).toBeLessThan(5000)
  if (findings.length) throw new Error(`\n${formatReport(findings)}\n`)
})
