// Bottom CTA: host advances (with the auto-advance countdown), guests wait.
import { memo, useEffect, useState } from 'react'
import { Button, Spinner, cn, useMediaQuery } from '../../../components/ui'
import { REVEAL_AUTO_ADVANCE_MS } from '../../../game/constants'
import { rich, useT } from '../../../i18n/react'

interface RevealFooterProps {
  isHost: boolean
  isLast: boolean
  /** Whole seconds until auto-advance, null = the host decides. */
  secondsLeft: number | null
  onNext?: () => void
  className?: string
}

export const RevealFooter = memo(function RevealFooter({ isHost, isLast, secondsLeft, onNext, className }: RevealFooterProps) {
  const t = useT()
  const next = t(isLast ? 'reveal.footer.final' : 'reveal.footer.next')
  const total = Math.round(REVEAL_AUTO_ADVANCE_MS / 1000)
  const frac = secondsLeft == null ? 0 : Math.max(0, Math.min(1, secondsLeft / total))
  const wide = useMediaQuery('(min-width: 768px)')
  // The docked bar is compact on landscape phones and desktop scrolling layouts;
  // the one-screen desktop layout (≥ 1440 × 800) has room for the big button.
  const phoneLandscape = useMediaQuery('(max-height: 500px)')
  const desktop = useMediaQuery('(min-width: 1280px)')
  const roomy = useMediaQuery('(min-width: 1440px) and (min-height: 800px)')
  const compact = phoneLandscape || (desktop && !roomy)
  const size = phoneLandscape ? 'md' : compact || !wide ? 'lg' : 'xl'
  // One press is enough: show progress until the phase changes (re-arm if nothing happens).
  const [pressed, setPressed] = useState(false)
  useEffect(() => {
    if (!pressed) return
    const timer = setTimeout(() => setPressed(false), 4000)
    return () => clearTimeout(timer)
  }, [pressed])

  return (
    <div className={cn('rv-footer flex flex-col items-stretch gap-2 md:flex-row md:items-center md:justify-center md:gap-5', className)}>
      {isHost ? (
        <>
          <Button
            size={size}
            variant="primary"
            rightIcon={isLast ? 'trophy' : 'arrow-right'}
            onClick={() => {
              if (pressed || !onNext) return
              setPressed(true)
              onNext()
            }}
            loading={pressed}
            className="w-full md:w-auto md:min-w-[320px]"
            disabled={!onNext}
          >
            {next}
          </Button>
          {secondsLeft != null && (
            <p className="flex items-center justify-center gap-2.5 text-[13px] font-bold text-ink-200 md:text-sm" aria-live="off">
              <CountdownRing frac={frac} seconds={secondsLeft} />
              <span>
                {rich(t(isLast ? 'reveal.footer.finalIn' : 'reveal.footer.nextIn', { count: secondsLeft }), {
                  num: (c) => <span className="rv-tnum text-white">{c}</span>,
                })}
              </span>
            </p>
          )}
        </>
      ) : (
        <div
          className={cn(
            'rv-wait glass-flat flex items-center justify-center gap-3 rounded-full px-6 text-sm font-bold text-ink-100 md:min-w-[360px] md:text-[15px]',
            phoneLandscape ? 'h-11' : compact ? 'h-14' : 'h-14 md:h-16',
          )}
        >
          <Spinner size={18} label={null} />
          <span>
            {secondsLeft != null
              ? rich(t('reveal.footer.waitingIn', { count: secondsLeft }), { num: (c) => <span className="rv-tnum ml-1.5 text-ink-300">{c}</span> })
              : t('reveal.footer.waiting')}
          </span>
        </div>
      )}
    </div>
  )
})

function CountdownRing({ frac, seconds }: { frac: number; seconds: number }) {
  const r = 11
  const c = 2 * Math.PI * r
  return (
    <span className="relative grid size-7 shrink-0 place-items-center" aria-hidden>
      <svg viewBox="0 0 28 28" className="absolute inset-0 -rotate-90">
        <circle cx="14" cy="14" r={r} fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="3" />
        <circle
          cx="14"
          cy="14"
          r={r}
          fill="none"
          stroke="var(--color-lime)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ transition: 'stroke-dashoffset 0.95s linear' }}
        />
      </svg>
      <span className="rv-tnum relative text-[10px] font-extrabold text-white">{seconds}</span>
    </span>
  )
}
