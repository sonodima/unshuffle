// Finds user-facing text that bypasses the translation catalog (src/i18n/locales).
// Used by tests/unit/i18n-hardcoded.test.ts; also runs on its own:
//
//   bun tests/support/i18n-scan.ts          # grouped report, exit code 1 on findings
//
// It parses every production .ts / .tsx under src/ (not src/i18n/locales) with the
// TypeScript compiler API and reports:
//
//   jsx-text   letters in JSX text, or in a string written as a JSX child ({'Ciao'})
//   jsx-attr   a string in a text attribute: aria-label, title, alt, placeholder, label,
//              description…, any *Label / *Title / *Text… prop, dnd-kit accessibility props
//   text-prop  a string in an object property with such a name ({ label: 'Giocatori' })
//   toast      a string as the first argument of notify / toast / alert helpers
//   dom-text   a string written to document.title, textContent, setAttribute('aria-label')…,
//              or inside dnd-kit `announcements` / `screenReaderInstructions`
//   italian    any other string that reads as Italian prose (heuristic safety net:
//              Italian stopwords, elisions like l’host, accented vowels). Covers *Copy.ts
//              helpers and logs, which must be English.
//
// Always allowed: strings with no letters (emoji, punctuation, numbers), catalog keys,
// the brand (UNSHUFFLE) and BPM, a single capital letter (key caps), CSS class lists in
// props. Anything else that is deliberate gets a comment with a reason on the same line
// or the line above:  // i18n-ignore: room code sample   ·   {/* i18n-ignore: … */}

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'

export type Rule = 'jsx-text' | 'jsx-attr' | 'text-prop' | 'toast' | 'dom-text' | 'italian' | 'ignore-reason'

export interface Finding {
  file: string
  line: number
  col: number
  rule: Rule
  text: string
}

export interface ScanOptions {
  /** True for strings that are catalog keys (allowed anywhere). */
  isKey?: (s: string) => boolean
}

/** Words that may appear untranslated: the brand and "BPM". */
const ALLOWED_WORDS = ['UNSHUFFLE', 'BPM']

/** Attribute / property names whose value is shown or read to the user. */
const TEXT_NAME =
  /^(?:aria-(?:label|description|roledescription|valuetext|placeholder|braillelabel|brailleroledescription)|title|alt|placeholder|label|subtitle|description|hint|tooltip|caption|message|heading|ariaLabel|ariaDescription|[a-z][A-Za-z0-9]*(?:Label|Title|Text|Placeholder|Description|Hint|Message|Tooltip|Caption|Heading))$/
/** Names TEXT_NAME matches that hold enumerated values, not text. */
const NOT_TEXT_NAME = new Set(['enterKeyHint', 'latencyHint'])
/** dnd-kit screen-reader copy: every string inside counts. */
const DEEP_NAME = /^(?:accessibility|announcements|screenReaderInstructions)$/
/** Functions whose first argument is shown as a toast / dialog. */
const TOAST_FN = /^(?:notify|onNotify|toast|showToast|infoToast|errorToast|warnToast|successToast|addToast|announce|alert)$/
const WINDOW_DIALOG = /^(?:window|globalThis|self)\.(?:alert|confirm|prompt)$/
/** DOM properties that hold visible / announced text. */
const DOM_TEXT_PROP = /^(?:title|textContent|innerText|innerHTML|placeholder|ariaLabel|alt)$/
/** Calls whose arguments are keys and params, not text. */
const I18N_FN = /^(?:t|tm|tl|td|rich|formatNumber)$/

// Italian heuristic. Stopwords that don't collide with English or code words
// (no "per", "solo", "dove", "ma", "ci", "ai"…); hyphenated words ("non-null") are one token.
const IT_STOPWORDS = new Set(
  (
    'il lo gli la le di del dello della dei degli delle un una uno non che con sono nel nello nella nei negli nelle ' +
    'al allo alla agli alle dal dallo dalla dai dagli dalle sul sulla sui tra ti tuo tua tuoi tue questo questa ' +
    'questi queste ancora anche sei hai puoi qui oppure quando ogni senza tutti tutto dopo prima poi ora già più può ' +
    'perché cosa niente nessun nessuno ecco'
  ).split(' '),
)
const IT_ELISION = /(?:^|[^\p{L}])(?:l|un|dell|all|nell|dall|sull|quest|c|d|anch|com|dov|po)[’'](?=\p{L})/iu
const IT_ACCENT = /[àèìòù]/i

const ENTITY = /&(?:[a-z]+|#\d+|#x[0-9a-f]+);/gi
const KEYCAP = /^[A-Z]$/
/** Tailwind / CSS class lists: every token has -, :, / or [ or is a bare utility. */
const CLASS_TOKEN =
  /^(?:[!-]?[a-z0-9]*[-:/[][^\s]*|flex|grid|block|inline|hidden|contents|relative|absolute|fixed|sticky|static|truncate|uppercase|lowercase|capitalize|italic|underline|border|rounded|shadow|transition|grow|shrink|isolate|visible|invisible|num|group|peer)$/

function stripAllowed(s: string): string {
  let out = s.replace(ENTITY, ' ')
  for (const w of ALLOWED_WORDS) out = out.replace(new RegExp(`\\b${w}\\b`, 'g'), ' ')
  return out
}

function isClassList(s: string): boolean {
  const tokens = s.trim().split(/\s+/)
  return tokens.length > 0 && tokens[0] !== '' && tokens.every((tok) => CLASS_TOKEN.test(tok))
}

/** Does `s` carry words a user would read? */
function hasText(s: string, opts: ScanOptions, inProp = false): boolean {
  const trimmed = s.trim()
  if (!trimmed || opts.isKey?.(trimmed)) return false
  if (KEYCAP.test(trimmed)) return false
  if (inProp && isClassList(trimmed)) return false
  return /\p{L}/u.test(stripAllowed(trimmed))
}

function looksItalian(s: string): boolean {
  if (IT_ELISION.test(s) || IT_ACCENT.test(s)) return /\p{L}{2}/u.test(s)
  const tokens = s.toLowerCase().match(/\p{L}+(?:-\p{L}+)*/gu) ?? []
  return tokens.length >= 2 && tokens.some((tok) => IT_STOPWORDS.has(tok))
}

type Lit = ts.StringLiteral | ts.NoSubstitutionTemplateLiteral | ts.TemplateExpression

function literalText(node: Lit): string {
  if (!ts.isTemplateExpression(node)) return node.text
  return [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(' ')
}

function isLit(node: ts.Node): node is Lit {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)
}

function calleeName(call: ts.CallExpression): string {
  const e = call.expression
  if (ts.isIdentifier(e)) return e.text
  if (ts.isPropertyAccessExpression(e)) return e.name.text
  return ''
}

/** Literals a value expression can evaluate to (through ?:, &&, ||, ??, +, parentheses, casts). */
function valueLiterals(node: ts.Expression | undefined): Lit[] {
  if (!node) return []
  if (isLit(node)) return [node]
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node))
    return valueLiterals(node.expression)
  if (ts.isConditionalExpression(node)) return [...valueLiterals(node.whenTrue), ...valueLiterals(node.whenFalse)]
  if (ts.isBinaryExpression(node)) {
    const op = node.operatorToken.kind
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) return valueLiterals(node.right)
    if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken || op === ts.SyntaxKind.PlusToken)
      return [...valueLiterals(node.left), ...valueLiterals(node.right)]
  }
  return []
}

/** Every literal under `node`, except the arguments of translation calls. */
function deepLiterals(node: ts.Node, out: Lit[] = []): Lit[] {
  if (ts.isCallExpression(node) && I18N_FN.test(calleeName(node))) return out
  if (isLit(node)) out.push(node)
  if (!ts.isStringLiteral(node) && !ts.isNoSubstitutionTemplateLiteral(node)) ts.forEachChild(node, (c) => void deepLiterals(c, out))
  return out
}

function propName(name: ts.PropertyName | ts.JsxAttributeName): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isPrivateIdentifier(name)) return name.text
  if (ts.isJsxNamespacedName(name)) return `${name.namespace.text}:${name.name.text}`
  return ''
}

const isTextName = (name: string) => TEXT_NAME.test(name) && !NOT_TEXT_NAME.has(name)

const IGNORE = /i18n-ignore\b(.*)$/

export function scanSource(file: string, code: string, opts: ScanOptions = {}): Finding[] {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const src = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, kind)
  const lines = code.split('\n')
  const findings: Finding[] = []
  const seen = new Set<number>()
  const badIgnores = new Set<number>()

  /** 0-based line of the i18n-ignore comment covering `line` (on it, or alone on the line above), or -1. */
  const ignoreLine = (line: number): number => {
    if (IGNORE.test(lines[line] ?? '')) return line
    const above = lines[line - 1] ?? ''
    return /^\s*(?:\/\/|\/\*|\{\s*\/\*)/.test(above) && IGNORE.test(above) ? line - 1 : -1
  }

  const report = (node: ts.Node, rule: Rule, text: string, offset = 0) => {
    const pos = node.getStart(src) + offset
    if (seen.has(pos)) return
    seen.add(pos)
    const { line, character } = src.getLineAndCharacterOfPosition(pos)
    const il = ignoreLine(line)
    if (il >= 0) {
      const reason = (IGNORE.exec(lines[il])?.[1] ?? '').replace(/\*\/.*$|\}\s*$/, '').replace(/^[\s:—–-]+/, '').trim()
      if (reason) return
      if (badIgnores.has(il)) return
      badIgnores.add(il)
      findings.push({ file, line: il + 1, col: 1, rule: 'ignore-reason', text: 'i18n-ignore needs a reason: // i18n-ignore: <why>' })
      return
    }
    findings.push({ file, line: line + 1, col: character + 1, rule, text: text.replace(/\s+/g, ' ').trim().slice(0, 100) })
  }

  const check = (lits: Lit[], rule: Rule, inProp: boolean) => {
    for (const lit of lits) {
      const text = literalText(lit)
      if (hasText(text, opts, inProp)) report(lit, rule, lit.getText(src))
    }
  }

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isTypeNode(node)) return

    if (ts.isJsxText(node)) {
      const raw = node.getText(src)
      const text = raw.replace(ENTITY, ' ')
      if (hasText(text, opts)) report(node, 'jsx-text', raw, raw.search(/\S/))
    } else if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      check(valueLiterals(node.expression), 'jsx-text', false)
    } else if (ts.isJsxAttribute(node)) {
      const name = propName(node.name)
      const init = node.initializer
      if (init && DEEP_NAME.test(name)) check(deepLiterals(init), 'jsx-attr', false)
      else if (init && isTextName(name)) {
        if (ts.isStringLiteral(init)) check([init], 'jsx-attr', true)
        else if (ts.isJsxExpression(init)) check(valueLiterals(init.expression), 'jsx-attr', true)
      }
    } else if (ts.isPropertyAssignment(node)) {
      const name = propName(node.name)
      if (DEEP_NAME.test(name)) check(deepLiterals(node.initializer), 'dom-text', false)
      else if (isTextName(name)) check(valueLiterals(node.initializer), 'text-prop', true)
    } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && DEEP_NAME.test(node.name.text) && node.initializer) {
      check(deepLiterals(node.initializer), 'dom-text', false)
    } else if (ts.isCallExpression(node)) {
      const name = calleeName(node)
      const full = node.expression.getText(src)
      if (TOAST_FN.test(name) || WINDOW_DIALOG.test(full)) check(valueLiterals(node.arguments[0]), 'toast', false)
      if (name === 'setAttribute' && node.arguments.length >= 2) {
        const attr = node.arguments[0]
        if (ts.isStringLiteral(attr) && isTextName(attr.text)) check(valueLiterals(node.arguments[1]), 'dom-text', true)
      }
    } else if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      DOM_TEXT_PROP.test(node.left.name.text)
    ) {
      check(valueLiterals(node.right), 'dom-text', false)
    }
    ts.forEachChild(node, visit)
  }
  visit(src)

  // Safety net: Italian prose anywhere else (copy helpers, errors, logs).
  const italian = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isTypeNode(node)) return
    if (ts.isCallExpression(node) && I18N_FN.test(calleeName(node))) return
    if (isLit(node)) {
      const text = literalText(node)
      if (!opts.isKey?.(text.trim()) && looksItalian(text)) report(node, 'italian', node.getText(src))
    }
    ts.forEachChild(node, italian)
  }
  italian(src)

  return findings.sort((a, b) => a.line - b.line || a.col - b.col)
}

/** Production sources under `srcDir`: .ts / .tsx, no declarations, no catalogs. */
export function productionFiles(srcDir: string): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (path.split(sep).join('/').endsWith('src/i18n/locales')) continue
        walk(path)
      } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(path)
    }
  }
  walk(srcDir)
  return out.sort()
}

/** Scan every production file under `root`/src; paths in findings are relative to `root`. */
export function scanTree(root: string, opts: ScanOptions = {}): Finding[] {
  return productionFiles(join(root, 'src')).flatMap((path) =>
    scanSource(relative(root, path).split(sep).join('/'), readFileSync(path, 'utf8'), opts),
  )
}

/** Findings grouped by file, most affected first. */
export function formatReport(findings: Finding[]): string {
  if (!findings.length) return ''
  const byFile = new Map<string, Finding[]>()
  for (const f of findings) byFile.set(f.file, [...(byFile.get(f.file) ?? []), f])
  const byRule = new Map<Rule, number>()
  for (const f of findings) byRule.set(f.rule, (byRule.get(f.rule) ?? 0) + 1)
  const files = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
  const out = [
    `${findings.length} hardcoded user-facing string(s) in ${files.length} file(s): ` +
      [...byRule.entries()].map(([r, n]) => `${r} ${n}`).join(', '),
    'Move them to src/i18n/locales/it/<namespace>.ts and read them with t() / tm(),',
    'or, when deliberate, add `// i18n-ignore: <reason>` on the line or the line above.',
  ]
  for (const [file, list] of files) {
    out.push('', `${file} (${list.length})`)
    for (const f of list) out.push(`  ${`${f.line}:${f.col}`.padEnd(8)} ${f.rule.padEnd(13)} ${f.text}`)
  }
  return out.join('\n')
}

if (import.meta.main) {
  const root = join(import.meta.dir, '..', '..')
  const { isMessageKey } = await import('../../src/i18n')
  const report = formatReport(scanTree(root, { isKey: isMessageKey }))
  console.log(report || 'i18n guard: no hardcoded user-facing strings.')
  process.exit(report ? 1 : 0)
}
