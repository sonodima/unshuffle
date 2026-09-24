import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode, type Ref } from 'react'
import { useT } from '../../i18n/react'
import { cn } from './cn'
import { shakeElement } from './hooks'
import { Icon, type IconName } from './Icon'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  ref?: Ref<HTMLInputElement>
  label?: ReactNode
  /** Helper text under the field (hidden while `error` is shown). */
  hint?: ReactNode
  /** Error message: coral border + message + shake. */
  error?: ReactNode
  /** Leading icon. */
  icon?: IconName
  /** Trailing content inside the field (e.g. an IconButton size="sm"). */
  rightSlot?: ReactNode
  /** Show "n/max" when maxLength is set. Default true. */
  showCount?: boolean
  /** md 48px · lg 56px. Default md. */
  size?: 'md' | 'lg'
  containerClassName?: string
}

/**
 * Text field with label, hint, error and a character counter. Font-size is
 * 16px on mobile so iOS never zooms on focus.
 */
export function Input({
  ref,
  label,
  hint,
  error,
  icon,
  rightSlot,
  showCount = true,
  size = 'md',
  maxLength,
  className,
  containerClassName,
  id,
  value,
  defaultValue,
  onChange,
  disabled,
  ...rest
}: InputProps) {
  const t = useT()
  const autoId = useId()
  const inputId = id ?? autoId
  const hintId = `${inputId}-hint`
  const [uncontrolledLen, setUncontrolledLen] = useState(() => String(defaultValue ?? '').length)
  const length = value != null ? String(value).length : uncontrolledLen
  const hasCount = showCount && maxLength != null && maxLength > 0
  const describe = error || hint ? hintId : undefined
  const fieldRef = useRef<HTMLDivElement>(null)
  const errorKey = typeof error === 'string' ? error : error ? 'error' : ''
  useEffect(() => {
    if (errorKey) shakeElement(fieldRef.current)
  }, [errorKey])

  return (
    <div className={cn('flex flex-col gap-1.5', containerClassName)}>
      {(label || hasCount) && (
        <div className="flex items-end justify-between gap-3 px-1">
          {label && (
            <label htmlFor={inputId} className="eyebrow">
              {label}
            </label>
          )}
          {hasCount && (
            <span
              className={cn('num text-[11px] font-medium', length >= maxLength ? 'text-gold' : 'text-ink-400')}
              aria-hidden
            >
              {t('ui.input.counter', { count: length, max: maxLength })}
            </span>
          )}
        </div>
      )}
      <div
        ref={fieldRef}
        className={cn(
          'group relative flex items-center rounded-2xl border bg-ink-950/55 shadow-well transition-[border-color,box-shadow,background-color] duration-200',
          size === 'md' ? 'h-12' : 'h-14',
          error
            ? 'border-coral/80 shadow-[0_0_0_4px_rgb(255_84_112/0.16)]'
            : 'border-white/10 hover:border-white/20 focus-within:border-violet focus-within:bg-ink-950/75 focus-within:shadow-[0_0_0_4px_rgb(123_92_255/0.22),inset_0_2px_6px_rgb(0_0_0/0.4)]',
          disabled && 'opacity-50',
        )}
      >
        {icon && (
          <Icon
            name={icon}
            size={size === 'md' ? 18 : 20}
            className={cn(
              'pointer-events-none absolute left-4 transition-colors',
              error ? 'text-coral' : 'text-ink-400 group-focus-within:text-violet-bright',
            )}
          />
        )}
        <input
          ref={ref}
          id={inputId}
          value={value}
          defaultValue={defaultValue}
          maxLength={maxLength}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describe}
          onChange={(e) => {
            if (value == null) setUncontrolledLen(e.target.value.length)
            onChange?.(e)
          }}
          className={cn(
            'h-full w-full min-w-0 rounded-2xl bg-transparent text-base font-semibold text-ink-50 caret-lime outline-none placeholder:font-medium placeholder:text-ink-400 focus-visible:outline-none disabled:cursor-not-allowed',
            size === 'lg' && 'sm:text-lg',
            icon ? (size === 'md' ? 'pl-11' : 'pl-12') : 'pl-4',
            rightSlot ? 'pr-2' : 'pr-4',
            className,
          )}
          {...rest}
        />
        {rightSlot && <div className="flex shrink-0 items-center pr-1.5">{rightSlot}</div>}
      </div>
      {(error || hint) && (
        <p
          id={hintId}
          className={cn('flex items-start gap-1.5 px-1 text-xs leading-snug', error ? 'font-semibold text-coral' : 'text-ink-400')}
          role={error ? 'alert' : undefined}
        >
          {error && <Icon name="alert" size={14} className="mt-px" strokeWidth={2.4} />}
          <span>{error || hint}</span>
        </p>
      )}
    </div>
  )
}
