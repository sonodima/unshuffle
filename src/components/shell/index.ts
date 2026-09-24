// App shell: global chrome mounted once by App. Screens only ever need
// <SoundControls placement="inline" /> (and ReactionBar from components/reactions).
export { ScreenRouter, preloadScreens, type ScreenRouterProps } from './ScreenRouter'
export { selectScreen, screenTitle, type ScreenKey, type ScreenSelectInput } from './routing'
export { useCurrentScreen, floatingDock, type FloatingDock } from './shellState'
export { useHudBottom, useBannerBox, HUD_SELECTOR } from './hudInset'
export { stackTop, hudBottomFrom, nextScrolledAway, type BannerBox } from './layout'
export { useScrolledAway } from './screenScroll'
export {
  ConnectionOverlay,
  StatusBanner,
  ConnectionLostDialog,
  ExitNoticeDialog,
  exitReasonFor,
  type StatusBannerProps,
  type BannerTone,
  type ConnectionLostDialogProps,
  type ExitNoticeDialogProps,
  type ExitNotice,
  type ExitReason,
  type LostCause,
  type LostContext,
} from './ConnectionOverlay'
export { lostDialogCopy, exitNoticeCopy, lostContextFor, type DialogCopy } from './connectionCopy'
export { ToastLayer } from './ToastLayer'
export { toastForEvent, splitMessage, type ToastCopy, type ToastCopyContext, type ToastCopyTone } from './toastCopy'
export { FloatingReactions, FloatingReactionsView, makeFloater, type Floater, type FloatingReactionsViewProps } from './FloatingReactions'
export { SoundControls, SoundPanel, useSoundLevel, type SoundControlsProps, type SoundPanelProps } from './SoundControls'
export { ErrorBoundary, QuietBoundary, CrashScreen, type ErrorBoundaryProps, type ErrorFallbackProps, type CrashScreenProps } from './ErrorBoundary'
export { ResumeOverlay, ResumeCard, type ResumeCardProps } from './ResumeOverlay'
export { startResume, cancelResume, dismissResumeFailure, useResumeState, getResumeState, type ResumeState } from './resume'
export { useLeaveGuard, useBootResume, isHostingGame, LEAVE_WARNING } from './useShellEffects'
