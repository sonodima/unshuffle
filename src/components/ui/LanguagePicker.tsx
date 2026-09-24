// Language switch for the headers: a glass pill (globe + "IT") or a round icon
// button that opens a sheet listing the available languages by their own names.
// Picking one loads its catalog (setLocale), then closes the sheet.
import { useRef, useState, type KeyboardEvent } from 'react'
import { LOCALE_INFO, availableLocales, setLocale, type Locale } from '../../i18n'
import { useLocale, useT } from '../../i18n/react'
import { Button, IconButton } from './Button'
import { cn } from './cn'
import { Icon } from './Icon'
import { Modal } from './Modal'
import { playSfx } from './sound'
import { Spinner } from './Spinner'

export interface LanguagePickerProps {
  /** Icon-only button (tight headers). */
  compact?: boolean
  className?: string
}

export function LanguagePicker({ compact = false, className }: LanguagePickerProps) {
  const t = useT()
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<Locale | null>(null)
  const [failed, setFailed] = useState(false)
  const [focusIndex, setFocusIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const checkedRef = useRef<HTMLButtonElement>(null)

  const locales = availableLocales()
  const label = t('ui.language.button', { language: LOCALE_INFO[locale].name })

  const show = () => {
    setFailed(false)
    setFocusIndex(Math.max(0, locales.indexOf(locale)))
    setOpen(true)
  }

  const pick = async (next: Locale) => {
    if (pending) return
    playSfx('click')
    if (next === locale) {
      setOpen(false)
      return
    }
    setPending(next)
    setFailed(false)
    try {
      await setLocale(next)
      setOpen(false)
    } catch {
      setFailed(true)
    } finally {
      setPending(null)
    }
  }

  // Arrows / Home / End move the focus (roving tabindex); Enter, Space or a tap picks.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = locales.length
    let next: number
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (focusIndex + 1) % n
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (focusIndex - 1 + n) % n
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = n - 1
    else return
    e.preventDefault()
    if (next === focusIndex) return
    setFocusIndex(next)
    playSfx('hover')
    listRef.current?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.focus()
  }

  const trigger = compact ? (
    <IconButton icon="globe" label={label} size="sm" aria-haspopup="dialog" onClick={show} className={className} />
  ) : (
    <Button variant="glass" size="sm" leftIcon="globe" aria-label={label} aria-haspopup="dialog" onClick={show} className={className}>
      {/* The code is shown uppercase by the button style ("IT"). */}
      {locale}
    </Button>
  )

  return (
    <>
      {trigger}
      <Modal open={open} onClose={() => setOpen(false)} title={t('ui.language.title')} size="sm" initialFocusRef={checkedRef}>
        <div ref={listRef} role="radiogroup" aria-label={t('ui.language.title')} className="flex flex-col gap-2" onKeyDown={onKeyDown}>
          {locales.map((l, i) => {
            const checked = l === locale
            const busy = l === pending
            const info = LOCALE_INFO[l]
            return (
              <button
                key={l}
                ref={checked ? checkedRef : undefined}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-busy={busy || undefined}
                data-index={i}
                tabIndex={i === focusIndex ? 0 : -1}
                onFocus={() => setFocusIndex(i)}
                onClick={() => void pick(l)}
                className={cn(
                  'flex h-13 w-full shrink-0 items-center gap-3 rounded-2xl border px-4 text-left transition-[background-color,border-color,box-shadow] duration-200 tap-none',
                  checked
                    ? 'border-violet/70 bg-violet/20 shadow-[0_0_0_1px_rgb(123_92_255/0.3),0_8px_22px_-10px_rgb(123_92_255/0.8)]'
                    : 'border-white/[0.07] bg-white/[0.04] hover:border-white/15 hover:bg-white/[0.08] active:bg-white/[0.1]',
                  pending && !busy && 'opacity-60',
                )}
              >
                <span lang={info.tag} className={cn('min-w-0 flex-1 truncate text-[15px] font-bold', checked ? 'text-white' : 'text-ink-100')}>
                  {info.name}
                </span>
                <span aria-hidden className="grid size-6 shrink-0 place-items-center">
                  {busy ? (
                    <Spinner size={18} label={null} className="text-violet-bright" />
                  ) : checked ? (
                    <span className="grid size-6 place-items-center rounded-full bg-lime text-ink-950 shadow-[0_0_12px_rgb(166_255_63/0.45)]">
                      <Icon name="check" size={14} strokeWidth={3.4} />
                    </span>
                  ) : (
                    <span className="size-5 rounded-full border-2 border-white/15" />
                  )}
                </span>
              </button>
            )
          })}
        </div>
        {failed && (
          <p role="alert" className="mt-3 flex items-start gap-1.5 px-1 text-xs leading-snug font-semibold text-coral">
            <Icon name="alert" size={14} strokeWidth={2.4} className="mt-px" />
            <span>{t('ui.language.failed')}</span>
          </p>
        )}
      </Modal>
    </>
  )
}
