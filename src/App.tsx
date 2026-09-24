// App shell: shader background, the current screen, and the global chrome
// (floating reactions, sound controls, connection overlays, toasts). Optional
// chrome sits behind quiet error boundaries so it can never take a game down.

import { MotionConfig } from 'motion/react'
import { ShaderBackground } from './components/background/ShaderBackground'
import { ConnectionOverlay } from './components/shell/ConnectionOverlay'
import { ErrorBoundary, QuietBoundary } from './components/shell/ErrorBoundary'
import { FloatingReactions } from './components/shell/FloatingReactions'
import { ResumeOverlay } from './components/shell/ResumeOverlay'
import { ScreenRouter } from './components/shell/ScreenRouter'
import { SoundControls } from './components/shell/SoundControls'
import { ToastLayer } from './components/shell/ToastLayer'
import { useBootResume, useInstallPromptGuard, useLeaveGuard } from './components/shell/useShellEffects'

function Shell() {
  useBootResume()
  useLeaveGuard()
  useInstallPromptGuard()
  return (
    <>
      <QuietBoundary name="background">
        <ShaderBackground />
      </QuietBoundary>
      <ScreenRouter />
      <QuietBoundary name="reactions">
        <FloatingReactions />
      </QuietBoundary>
      <QuietBoundary name="sound">
        <SoundControls />
      </QuietBoundary>
      <QuietBoundary name="connection">
        <ConnectionOverlay />
        <ResumeOverlay />
      </QuietBoundary>
      <QuietBoundary name="toasts">
        <ToastLayer />
      </QuietBoundary>
    </>
  )
}

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ErrorBoundary name="app">
        <Shell />
      </ErrorBoundary>
    </MotionConfig>
  )
}

export default App
