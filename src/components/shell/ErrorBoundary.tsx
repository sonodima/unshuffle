// Error boundaries. React still needs a class for this (no hook equivalent).
// The crash screen uses plain markup + global CSS classes only (.btn, .glass…),
// never UI-kit components, so it still renders if the kit itself is what broke.

import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface ErrorFallbackProps {
  error: Error
  /** Re-mount the children (the store state survives, so this often just works). */
  reset(): void
}

interface ErrorBoundaryProps {
  children?: ReactNode
  /** Rendered instead of the children after a crash. Default: full-screen CrashScreen. `null` = render nothing. */
  fallback?: ReactNode | ((props: ErrorFallbackProps) => ReactNode)
  /** Changing any of these resets a crashed boundary (e.g. the current screen key). */
  resetKeys?: readonly unknown[]
  /** Label used in console logs. */
  name?: string
  onError?(error: Error, info: ErrorInfo): void
}

interface State {
  error: Error | null
}

function toError(value: unknown): Error {
  if (value instanceof Error) return value
  try {
    return new Error(typeof value === 'string' ? value : JSON.stringify(value))
  } catch {
    return new Error(String(value))
  }
}

function keysChanged(a: readonly unknown[] = [], b: readonly unknown[] = []): boolean {
  return a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]))
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { error: toError(error) }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    const err = toError(error)
    console.error(`[shell] ${this.props.name ?? 'app'} crashed`, err, info.componentStack)
    try {
      this.props.onError?.(err, info)
    } catch {
      // A failing error reporter must not take the fallback down with it.
    }
  }

  componentDidUpdate(prev: ErrorBoundaryProps): void {
    if (this.state.error && keysChanged(prev.resetKeys, this.props.resetKeys)) this.reset()
  }

  reset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    const { fallback } = this.props
    if (fallback === undefined) return <CrashScreen error={error} reset={this.reset} />
    return typeof fallback === 'function' ? fallback({ error, reset: this.reset }) : fallback
  }
}

/** Silent boundary for optional chrome (background, toasts…): on crash it renders nothing. */
export function QuietBoundary({ name, children }: { name: string; children?: ReactNode }) {
  return (
    <ErrorBoundary name={name} fallback={null}>
      {children}
    </ErrorBoundary>
  )
}

interface CrashScreenProps extends ErrorFallbackProps {
  /** Shows "Riprova" (re-render without reloading). Default false. */
  canRetry?: boolean
  /** "Torna alla home" handler (e.g. leave the room); hidden when absent. */
  onHome?(): void
  /** `screen` = fills its parent (inside the screen frame) instead of the viewport. */
  variant?: 'app' | 'screen'
}

function reload(): void {
  try {
    location.reload()
  } catch {
    // nothing sensible left to do
  }
}

/** Friendly Italian crash screen. */
export function CrashScreen({ error, reset, canRetry = false, onHome, variant = 'app' }: CrashScreenProps) {
  const detail = `${error.name}: ${error.message}`.trim()
  return (
    <div
      role="alert"
      className={
        (variant === 'app' ? 'fixed inset-0 z-[1000] bg-ink-950/60 ' : 'absolute inset-0 ') +
        'flex items-center justify-center overflow-y-auto px-4 pt-safe-6 pb-safe-6'
      }
    >
      <div className="glass-flat w-full max-w-[440px] rounded-panel p-6 text-center sm:p-8">
        <div aria-hidden className="relative mx-auto mb-6 grid size-24 place-items-center">
          <span className="absolute inset-0 rounded-full bg-coral/25 blur-2xl" />
          <span className="absolute inset-0 rounded-full border border-white/10 bg-[repeating-radial-gradient(circle_at_center,rgb(255_255_255/0.07)_0_1px,transparent_1px_5px)] bg-ink-900" />
          <span className="absolute inset-[34%] rounded-full bg-coral shadow-glow-coral" />
          <span className="absolute h-[140%] w-[3px] rotate-[28deg] rounded-full bg-ink-950 shadow-[0_0_0_1px_rgb(255_255_255/0.08)]" />
        </div>
        <p className="eyebrow mb-3 text-coral!">Errore imprevisto</p>
        <h1 className="display display-skew inline-block text-2xl text-balance sm:text-[28px]">Qualcosa è andato storto</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-pretty text-ink-300">
          La traccia si è inceppata. Ricarica la pagina: se eri in una stanza provo a riportarti dentro.
        </p>
        <div className="mt-7 flex flex-col gap-3">
          <button type="button" className="btn btn-primary btn-lg w-full" onClick={reload}>
            <span className="btn-label">Ricarica</span>
          </button>
          {(canRetry || onHome) && (
            <div className="flex flex-col gap-3 sm:flex-row">
              {canRetry && (
                <button type="button" className="btn btn-glass btn-md w-full sm:flex-1" onClick={reset}>
                  <span className="btn-label">Riprova</span>
                </button>
              )}
              {onHome && (
                <button type="button" className="btn btn-glass btn-md w-full sm:flex-1" onClick={onHome}>
                  <span className="btn-label">Torna alla home</span>
                </button>
              )}
            </div>
          )}
        </div>
        {detail && (
          <details className="group mt-6 text-left">
            <summary className="cursor-pointer list-none text-center text-xs font-bold text-ink-400 transition-colors hover:text-ink-200">
              <span className="group-open:hidden">Dettagli tecnici</span>
              <span className="hidden group-open:inline">Nascondi dettagli</span>
            </summary>
            <pre className="num mt-3 max-h-40 overflow-auto rounded-2xl bg-ink-950/70 p-3 text-[11px] leading-relaxed break-words whitespace-pre-wrap text-ink-300 shadow-well">
              {detail}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}
