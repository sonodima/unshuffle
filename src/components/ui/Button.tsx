import type { ButtonHTMLAttributes, MouseEvent, PointerEvent, ReactNode, Ref } from 'react'
import { useT } from '../../i18n/react'
import { cn } from './cn'
import { Icon, ICON_NAMES, type IconName } from './Icon'
import { playSfx, type SfxName } from './sound'
import { Spinner } from './Spinner'
import { Tooltip } from './Tooltip'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'glass'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl'

type NativeButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>

export interface ButtonProps extends NativeButtonProps {
  ref?: Ref<HTMLButtonElement>
  /** primary = lime CTA, secondary = violet, danger = coral, glass = translucent film, ghost = text-only. Default primary. */
  variant?: ButtonVariant
  /** sm 36px · md 44px · lg 56px · xl 68px (+ 3–6px 3D edge). Default md. */
  size?: ButtonSize
  /** Shows a spinner, keeps the width, blocks clicks, sets aria-busy. */
  loading?: boolean
  /** Icon name or any node, placed before / after the label. */
  leftIcon?: IconName | ReactNode
  rightIcon?: IconName | ReactNode
  fullWidth?: boolean
  /** UI sound on press. Default 'click'; false = silent. */
  sound?: SfxName | false
  children?: ReactNode
}

const ICON_PX: Record<ButtonSize, number> = { sm: 15, md: 17, lg: 20, xl: 24 }

const ICON_SET: ReadonlySet<string> = new Set(ICON_NAMES)

function renderIcon(icon: IconName | ReactNode, size: number) {
  if (typeof icon === 'string') {
    if (ICON_SET.has(icon)) return <Icon name={icon as IconName} size={size} strokeWidth={2.4} />
    return <span className="emoji" style={{ fontSize: size }}>{icon}</span>
  }
  return icon
}

/** Press sound: on pointer-down for instant feedback, on click for keyboard activation. */
function usePressSound(sound: SfxName | false, blocked: boolean) {
  return {
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      if (!blocked && sound && e.button === 0) playSfx(sound)
    },
    onClickSound: (e: MouseEvent<HTMLButtonElement>) => {
      if (!blocked && sound && e.detail === 0) playSfx(sound)
    },
  }
}

/** Chunky GeoGuessr-style 3D pill button. */
export function Button({
  ref,
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth,
  sound = 'click',
  disabled,
  className,
  children,
  type = 'button',
  onClick,
  onPointerDown,
  ...rest
}: ButtonProps) {
  const t = useT()
  const blocked = !!disabled || loading
  const press = usePressSound(sound, blocked)
  const iconPx = ICON_PX[size]

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      className={cn('btn', `btn-${variant}`, `btn-${size}`, fullWidth && 'w-full', className)}
      onPointerDown={(e) => {
        press.onPointerDown(e)
        onPointerDown?.(e)
      }}
      onClick={(e) => {
        if (loading) {
          e.preventDefault()
          return
        }
        press.onClickSound(e)
        onClick?.(e)
      }}
      {...rest}
    >
      <span className={cn('btn-label', loading && 'invisible')}>
        {leftIcon != null && renderIcon(leftIcon, iconPx)}
        {children != null && <span>{children}</span>}
        {rightIcon != null && renderIcon(rightIcon, iconPx)}
      </span>
      {loading && (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner size={iconPx + 2} label={t('ui.wait')} />
        </span>
      )}
    </button>
  )
}

export interface IconButtonProps extends NativeButtonProps {
  ref?: Ref<HTMLButtonElement>
  /** Icon name, or a custom node via `children`. */
  icon?: IconName
  /** Required accessible name; also the desktop tooltip text. */
  label: string
  variant?: ButtonVariant
  /** sm 36px · md 44px · lg 56px · xl 68px. Default md. */
  size?: ButtonSize
  /** Show `label` as a desktop tooltip (default true). Pass a string for custom text. */
  tooltip?: boolean | string
  tooltipSide?: 'top' | 'bottom'
  /** Keyboard hint shown in the tooltip, e.g. "Spazio". */
  shortcut?: string
  loading?: boolean
  /** Toggle state for on/off buttons (sets aria-pressed + highlighted style). */
  active?: boolean
  sound?: SfxName | false
  children?: ReactNode
}

const ICONBTN_ICON_PX: Record<ButtonSize, number> = { sm: 16, md: 20, lg: 24, xl: 28 }

/** Round icon-only button with an aria-label and an optional desktop tooltip. */
export function IconButton({
  ref,
  icon,
  label,
  variant = 'glass',
  size = 'md',
  tooltip = true,
  tooltipSide = 'top',
  shortcut,
  loading = false,
  active,
  sound = 'click',
  disabled,
  className,
  children,
  type = 'button',
  onClick,
  onPointerDown,
  ...rest
}: IconButtonProps) {
  const blocked = !!disabled || loading
  const press = usePressSound(sound, blocked)
  const px = ICONBTN_ICON_PX[size]

  const button = (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      aria-label={label}
      aria-busy={loading || undefined}
      aria-pressed={active}
      className={cn(
        'btn btn-icon',
        `btn-${variant}`,
        `btn-${size}`,
        active && variant === 'glass' && '[--btn-face-hi:rgb(123_92_255/0.55)] [--btn-face:rgb(90_61_240/0.45)] [--btn-glow:rgb(123_92_255/0.5)]',
        className,
      )}
      onPointerDown={(e) => {
        press.onPointerDown(e)
        onPointerDown?.(e)
      }}
      onClick={(e) => {
        if (loading) return
        press.onClickSound(e)
        onClick?.(e)
      }}
      {...rest}
    >
      <span className={cn('btn-label', loading && 'invisible')}>
        {children ?? (icon && <Icon name={icon} size={px} strokeWidth={2.3} />)}
      </span>
      {loading && (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner size={px - 2} label={null} />
        </span>
      )}
    </button>
  )

  if (!tooltip) return button
  return (
    <Tooltip content={typeof tooltip === 'string' ? tooltip : label} side={tooltipSide} shortcut={shortcut} disabled={disabled}>
      {button}
    </Tooltip>
  )
}
