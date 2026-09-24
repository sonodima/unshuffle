import { useEffect, useId, useRef, useState, type ClipboardEvent, type KeyboardEvent, type Ref } from 'react'
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '../../game/constants'
import { useT } from '../../i18n/react'
import { cn } from './cn'
import { shakeElement } from './hooks'
import { playSfx } from './sound'

/**
 * Extracts a room code from free text: a bare code ("kxqpm"), or any link /
 * hash containing `#/r/CODE`. Returns null if no valid code is found.
 */
function parseRoomCode(text: string): string | null {
  const fromLink = /#\/r\/([A-Za-z]{3,12})/.exec(text)
  const raw = (fromLink ? fromLink[1] : text).toUpperCase().replace(/[^A-Z]/g, '')
  if (raw.length < ROOM_CODE_LENGTH) return null
  const code = raw.slice(0, ROOM_CODE_LENGTH)
  return [...code].every((c) => ROOM_CODE_ALPHABET.includes(c)) ? code : null
}

/** Pasted/autofilled text that is clearly a URL must never be split into letters. */
function looksLikeLink(text: string): boolean {
  return /[/:#.]/.test(text)
}

function sanitize(text: string): string[] {
  return [...text.toUpperCase()].filter((c) => ROOM_CODE_ALPHABET.includes(c))
}

export interface CodeInputProps {
  ref?: Ref<HTMLDivElement>
  /** Compacted code (letters only, up to 5). */
  value: string
  onChange(code: string): void
  /** Called when all 5 boxes are filled (typing, paste, or Enter on a full code). */
  onComplete?(code: string): void
  /** Coral boxes + shake whenever it turns true (e.g. "stanza non trovata"). */
  invalid?: boolean
  disabled?: boolean
  autoFocus?: boolean
  /** md = 52–60px boxes, lg = up to 68px. Default lg. */
  size?: 'md' | 'lg'
  /** Accessible group label. Default "Codice stanza" (ui.codeInput.label). */
  label?: string
  className?: string
}

/**
 * 5-box room code field: auto-advance, uppercase, backspace/arrow navigation,
 * paste of a whole code or a share link. Unsupported letters (I, O, digits)
 * are rejected with a shake.
 */
export function CodeInput({
  ref,
  value,
  onChange,
  onComplete,
  invalid = false,
  disabled = false,
  autoFocus = false,
  size = 'lg',
  label,
  className,
}: CodeInputProps) {
  const t = useT()
  const name = label ?? t('ui.codeInput.label')
  const n = ROOM_CODE_LENGTH
  const groupId = useId()
  const inputs = useRef<Array<HTMLInputElement | null>>([])
  const rowRef = useRef<HTMLDivElement>(null)
  const [chars, setChars] = useState<string[]>(() => toSlots(value, n))
  const [focused, setFocused] = useState(-1)

  // Adopt external value changes (prefill from #/r/CODE, reset) without clobbering gaps we created.
  useEffect(() => {
    setChars((prev) => (prev.join('') === value ? prev : toSlots(value, n)))
  }, [value, n])

  useEffect(() => {
    if (invalid) shakeElement(rowRef.current)
  }, [invalid])

  // Mount only: focus the first empty box.
  useEffect(() => {
    if (!autoFocus) return
    const first = chars.findIndex((c) => !c)
    inputs.current[first === -1 ? n - 1 : first]?.focus()
  }, [])

  const commit = (next: string[], focusIndex?: number) => {
    setChars(next)
    const code = next.join('')
    if (code !== value) onChange(code)
    if (focusIndex != null) {
      const el = inputs.current[Math.max(0, Math.min(n - 1, focusIndex))]
      el?.focus()
      el?.select()
    }
    if (code.length === n && next.every(Boolean)) onComplete?.(code)
  }

  const reject = (i: number) => {
    shakeElement(inputs.current[i]?.parentElement)
  }

  const fillFrom = (start: number, letters: string[]) => {
    const next = [...chars]
    let i = start
    for (const c of letters) {
      if (i >= n) break
      next[i++] = c
    }
    playSfx('click', { pitch: 1.4 })
    commit(next, i >= n ? n - 1 : i)
  }

  const handleInput = (i: number, raw: string) => {
    if (!raw) {
      const next = [...chars]
      next[i] = ''
      commit(next)
      return
    }
    // A link / whole code typed or autofilled into one box.
    const parsed = raw.length >= n ? parseRoomCode(raw) : null
    if (parsed) {
      fillFrom(0, [...parsed])
      return
    }
    if (looksLikeLink(raw)) {
      reject(i)
      return
    }
    // Replace the box's old char with whatever is new in the raw value.
    const old = chars[i]
    const incoming = old && raw.length > 1 ? raw.replace(old, '') || raw : raw
    const letters = sanitize(incoming)
    if (letters.length === 0) {
      reject(i)
      return
    }
    fillFrom(i, letters)
  }

  const handlePaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text')
    e.preventDefault()
    const parsed = parseRoomCode(text)
    if (parsed) {
      fillFrom(0, [...parsed])
      return
    }
    const letters = looksLikeLink(text) ? [] : sanitize(text)
    if (letters.length) fillFrom(i, letters)
    else reject(i)
  }

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    const focusAt = (j: number) => {
      const el = inputs.current[Math.max(0, Math.min(n - 1, j))]
      el?.focus()
      el?.select()
    }
    switch (e.key) {
      case 'Backspace': {
        e.preventDefault()
        const next = [...chars]
        if (next[i]) {
          next[i] = ''
          commit(next)
        } else if (i > 0) {
          next[i - 1] = ''
          commit(next, i - 1)
        }
        break
      }
      case 'Delete': {
        e.preventDefault()
        const next = [...chars]
        next[i] = ''
        commit(next)
        break
      }
      case 'ArrowLeft':
        e.preventDefault()
        focusAt(i - 1)
        break
      case 'ArrowRight':
        e.preventDefault()
        focusAt(i + 1)
        break
      case 'Home':
        e.preventDefault()
        focusAt(0)
        break
      case 'End':
        e.preventDefault()
        focusAt(n - 1)
        break
      case 'Enter': {
        const code = chars.join('')
        if (code.length === n) onComplete?.(code)
        else reject(chars.findIndex((c) => !c))
        break
      }
      default:
        // Same letter typed over a selected box: onChange won't fire, so advance manually.
        if (e.key.length === 1 && e.key.toUpperCase() === chars[i] && !e.metaKey && !e.ctrlKey) {
          e.preventDefault()
          focusAt(i + 1)
        }
    }
  }

  const complete = chars.every(Boolean)

  return (
    <div
      ref={ref}
      role="group"
      aria-labelledby={groupId}
      className={cn('flex w-full flex-col items-center', className)}
    >
      <span id={groupId} className="sr-only">
        {name}
      </span>
      <div ref={rowRef} className={cn('grid w-full grid-cols-5', size === 'lg' ? 'max-w-[372px] gap-2 sm:gap-2.5' : 'max-w-[312px] gap-2')}>
        {chars.map((c, i) => {
          const isFocused = focused === i
          return (
            <div key={i} className="relative">
              <input
                ref={(el) => {
                  inputs.current[i] = el
                }}
                value={c}
                disabled={disabled}
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint={i === n - 1 ? 'go' : 'next'}
                aria-label={t('ui.codeInput.letter', { label: name, index: i + 1, count: n })}
                aria-invalid={invalid || undefined}
                onChange={(e) => handleInput(i, e.target.value)}
                onPaste={(e) => handlePaste(i, e)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onFocus={(e) => {
                  setFocused(i)
                  e.target.select()
                }}
                onBlur={() => setFocused((f) => (f === i ? -1 : f))}
                className={cn(
                  'display block w-full rounded-2xl border-2 text-center text-transparent caret-transparent shadow-well transition-[border-color,background-color,box-shadow,transform] duration-150 outline-none selection:bg-transparent focus-visible:outline-none disabled:opacity-50',
                  size === 'lg' ? 'aspect-[5/6] max-h-[80px] text-[clamp(1.5rem,7.5vw,2.25rem)]' : 'aspect-[5/6] max-h-[64px] text-2xl',
                  invalid
                    ? 'border-coral bg-coral/10'
                    : complete
                      ? 'border-lime/70 bg-lime/10 shadow-[0_0_24px_-6px_rgb(166_255_63/0.6)]'
                      : c
                        ? 'border-violet/70 bg-violet/15'
                        : 'border-white/10 bg-ink-950/55 hover:border-white/20',
                  isFocused && !invalid && 'border-cyan! bg-ink-950/80 shadow-[0_0_0_4px_rgb(46_230_255/0.18)]',
                )}
              />
              {/* Visible glyph (the native text is transparent so each letter can pop in). */}
              {c ? (
                <span
                  key={c}
                  aria-hidden
                  className={cn(
                    'display pointer-events-none absolute inset-0 grid animate-pop place-items-center',
                    size === 'lg' ? 'text-[clamp(1.5rem,7.5vw,2.25rem)]' : 'text-2xl',
                    invalid ? 'text-coral' : complete ? 'text-lime' : 'text-ink-50',
                  )}
                >
                  {c}
                </span>
              ) : (
                <span
                  aria-hidden
                  className={cn(
                    'pointer-events-none absolute inset-x-0 bottom-[24%] mx-auto h-[3px] w-[32%] rounded-full transition-colors',
                    isFocused ? 'animate-blink bg-cyan' : invalid ? 'bg-coral/50' : 'bg-white/12',
                  )}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function toSlots(value: string, n: number): string[] {
  const letters = sanitize(value).slice(0, n)
  return Array.from({ length: n }, (_, i) => letters[i] ?? '')
}
