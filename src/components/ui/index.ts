// UNSHUFFLE design system. Import everything from here:
//   import { Button, Panel, Avatar, TimerRing, Icon } from '../components/ui'

export { cn } from './cn'
export { playSfx, type SfxName } from './sound'
export { useMediaQuery, useCanHover, useIsWide, formatNumber, formatClock, shakeElement } from './hooks'

export { Icon, ICON_NAMES, type IconName, type IconProps } from './Icon'
export { Button, IconButton, type ButtonProps, type IconButtonProps, type ButtonVariant, type ButtonSize } from './Button'
export { Panel, resolveColor, type PanelProps, type PanelVariant, type PanelPadding, type GlowColor } from './Panel'
export { Input, type InputProps } from './Input'
export { CodeInput, parseRoomCode, type CodeInputProps } from './CodeInput'
export {
  Avatar,
  AvatarGroup,
  AvatarPicker,
  avatarEmoji,
  playerColor,
  AVATAR_PX,
  type AvatarProps,
  type AvatarGroupProps,
  type AvatarPickerProps,
  type AvatarSize,
} from './Avatar'
export { Segmented, type SegmentedProps, type SegmentedOption, type SegmentedTone } from './Segmented'
export { Chip, Badge, Pill, type ChipProps, type BadgeProps, type Tone } from './Chip'
export { Modal, ResponsiveSheet, BottomSheet, type ModalProps } from './Modal'
export { ToastViewport, type ToastViewItem, type ToastViewportProps, type ToastTone } from './Toast'
export { TimerRing, TimerBar, type TimerRingProps, type TimerBarProps, type TimerPhase } from './Timer'
export { AnimatedNumber, type AnimatedNumberProps } from './AnimatedNumber'
export { ProgressDots, type ProgressDotsProps, type DotState } from './ProgressDots'
export { Kbd, type KbdProps } from './Kbd'
export { Tooltip, type TooltipProps } from './Tooltip'
export { Spinner, type SpinnerProps } from './Spinner'

// Brand pieces are re-exported for convenience.
export { Logo, LogoMark, Vinyl, Equalizer, type LogoProps, type LogoMarkProps, type LogoSize, type VinylProps, type EqualizerProps } from '../brand'
