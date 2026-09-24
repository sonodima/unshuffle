// Home — presentational. Hero logo + tagline, profile, "Crea stanza" and the
// join box. Phones: stacked, CTAs at the bottom within thumb reach. Phones in
// landscape: hero on the left, action card on the right (CTA above the fold).
// Desktop: big centred logo over a live demo of a round next to the action card.
import { AnimatePresence, motion } from 'motion/react'
import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import { MAX_PLAYERS, ROOM_CODE_LENGTH } from '../../game/constants'
import type { PlayerProfile } from '../../game/types'
import { tm, type Msg } from '../../i18n'
import { rich, useT } from '../../i18n/react'
import { Button, CodeInput, Icon, LanguagePicker, Logo, Panel, cn, shakeElement, useCanHover, useMediaQuery, type IconName } from '../../components/ui'
import { HowToPlay } from './HowToPlay'
import { ProfileCard, type ProfilePatch } from './ProfileCard'
import { DemoStrip, ShuffleDemo } from './ShuffleDemo'
import { useUserIdle } from './useUserIdle'
import './home.css'

export type HomePending = 'create' | 'join' | null

interface HomeViewProps {
  profile: PlayerProfile
  onProfileChange(patch: ProfilePatch): void
  /** Join box content (letters only, up to 5). */
  code: string
  onCodeChange(code: string): void
  onCreate(): void
  /** Called with a complete 5-letter code. */
  onJoin(code: string): void
  /** Abort a pending create / join. Omit to hide "Annulla". */
  onCancel?(): void
  /** Which action is in flight (spinner on its button, the other one disabled). */
  pending: HomePending
  /** Inline error under the code boxes (boxes turn coral and shake). */
  joinError?: Msg | null
  /** Inline error under "Crea stanza". */
  createError?: Msg | null
  /** Problem not caused by a Home action (kicked, host gone…): dismissible banner. */
  notice?: Msg | null
  onDismissNotice?(): void
  /** Opened from an invite link: the join box leads and "Entra" is the primary CTA. */
  invited?: boolean
  offline?: boolean
  howToOpen: boolean
  onHowToOpenChange(open: boolean): void
  /**
   * The player is heading for "Crea stanza" / "Entra" (hover, focus, touch on
   * the action card): a good moment to warm up networking.
   */
  onIntent?(): void
}

const INCOMPLETE_CODE: Msg = { key: 'home.join.incomplete', params: { count: ROOM_CODE_LENGTH } }

/** Phone on its side: hero and action card side by side (same query as home.css). */
const LANDSCAPE_PHONE = '(orientation: landscape) and (max-height: 500px) and (max-width: 1023.98px)'

/** Staggered entrance (springy rise; with reduced motion only the fade remains). */
function rise(delay: number) {
  return {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { type: 'spring' as const, stiffness: 260, damping: 28, delay },
  }
}

export function HomeView({
  profile,
  onProfileChange,
  code,
  onCodeChange,
  onCreate,
  onJoin,
  onCancel,
  pending,
  joinError = null,
  createError = null,
  notice = null,
  onDismissNotice,
  invited = false,
  offline = false,
  howToOpen,
  onHowToOpenChange,
  onIntent,
}: HomeViewProps) {
  const t = useT()
  const wide = useMediaQuery('(min-width: 1024px)')
  const landscape = useMediaQuery(LANDSCAPE_PHONE)
  // Nobody around: the decorative loops (demo, glows) come to rest; any input wakes them.
  const idle = useUserIdle()
  const intent = onIntent ? { onPointerEnter: onIntent, onPointerDown: onIntent, onFocus: onIntent } : undefined
  const [localError, setLocalError] = useState<Msg | null>(null)
  const joinRef = useRef<HTMLButtonElement>(null)
  const joinBoxRef = useRef<HTMLDivElement>(null)
  // Code that already moved focus to "Entra": a second completion (Enter) joins.
  const armed = useRef<string | null>(null)

  const complete = code.length === ROOM_CODE_LENGTH
  const busy = pending !== null
  const codeError = joinError ?? localError

  // Invite: on keyboard/mouse devices focus "Entra" so Enter joins (on touch it would only draw a ring).
  const canHover = useCanHover()
  useEffect(() => {
    if (!invited || !canHover) return
    const t = setTimeout(() => joinRef.current?.focus({ preventScroll: true }), 60)
    return () => clearTimeout(t)
  }, [invited, canHover])

  const join = () => {
    if (busy) return
    if (!complete) {
      setLocalError(INCOMPLETE_CODE)
      shakeElement(joinBoxRef.current)
      return
    }
    setLocalError(null)
    onJoin(code)
  }

  const joinSection = (
    <div
      ref={joinBoxRef}
      {...intent}
      className={cn('flex flex-col', invited && 'hm-invite -mx-2 bg-lime/[0.05] px-2 pt-3 pb-1 sm:-mx-3 sm:px-3')}
    >
      {invited ? (
        <SectionLabel icon="sparkles">{t('home.join.invited')}</SectionLabel>
      ) : (
        <LabelDivider>{t('home.join.divider')}</LabelDivider>
      )}
      <CodeInput
        value={code}
        size="md"
        invalid={!!codeError}
        disabled={busy}
        onChange={(next) => {
          setLocalError(null)
          armed.current = null
          onCodeChange(next)
        }}
        onComplete={(full) => {
          if (armed.current === full) {
            join()
            return
          }
          armed.current = full
          joinRef.current?.focus({ preventScroll: true })
        }}
        className="[&>div]:max-w-none"
      />
      <InlineError message={codeError} className="mt-2.5" />
      <Button
        ref={joinRef}
        variant={invited ? 'primary' : complete && !codeError ? 'secondary' : 'glass'}
        size={invited ? 'xl' : 'lg'}
        fullWidth
        rightIcon="arrow-right"
        loading={pending === 'join'}
        disabled={pending === 'create'}
        onClick={join}
        className="mt-3"
      >
        {invited && complete ? t('home.join.buttonCode', { code }) : t('home.join.button')}
      </Button>
      <PendingLine show={pending === 'join'} onCancel={onCancel}>
        {t('home.join.pending')}
      </PendingLine>
    </div>
  )

  const createSection = (
    <div className="flex flex-col" {...intent}>
      <Button
        variant={invited ? 'glass' : 'primary'}
        size={invited ? 'lg' : 'xl'}
        fullWidth
        leftIcon={invited ? 'plus' : undefined}
        loading={pending === 'create'}
        disabled={pending === 'join'}
        onClick={() => !busy && onCreate()}
      >
        {invited ? t('home.create.buttonInvited') : t('home.create.button')}
      </Button>
      <InlineError message={createError} className="mt-2" />
      <PendingLine show={pending === 'create'} onCancel={onCancel}>
        {t('home.create.pending')}
      </PendingLine>
      {!invited && pending !== 'create' && (
        <p className="mt-1 flex items-center justify-center gap-1.5 text-center text-xs text-ink-400">
          <Icon name="user" size={13} strokeWidth={2.4} className="shrink-0" />
          <span>{rich(t('home.create.solo'), { b: (c) => <strong className="font-bold text-ink-200">{c}</strong> })}</span>
        </p>
      )}
    </div>
  )

  const card = (
    <Panel as="section" aria-label={t('home.cardLabel')} padding="none" className="hm-card flex flex-1 flex-col p-4 sm:p-5 lg:p-6">
      <AnimatePresence initial={false}>
        {offline && (
          <Banner key="offline" icon="wifi-off" tone="gold">
            {t('home.offline')}
          </Banner>
        )}
        {notice && (
          <Banner key="notice" icon="alert" tone="coral" onDismiss={onDismissNotice}>
            {tm(notice)}
          </Banner>
        )}
      </AnimatePresence>
      <ProfileCard profile={profile} onChange={onProfileChange} disabled={busy} />
      <div className="hm-sep my-4 h-px bg-linear-to-r from-transparent via-white/10 to-transparent sm:my-5" />
      {invited ? (
        <>
          {joinSection}
          <LabelDivider>{t('home.or')}</LabelDivider>
          {createSection}
        </>
      ) : (
        <>
          {createSection}
          {joinSection}
        </>
      )}
    </Panel>
  )

  // Phones: a one-row demo under the hero (only when there's room for it).
  const demoStrip = (
    <motion.div
      {...rise(0.4)}
      className="hm-strip mx-auto mb-5 w-full max-w-[340px] sm:mb-7 sm:max-w-[440px] [@media(max-height:800px)]:hidden"
    >
      <DemoStrip paused={howToOpen} idle={idle} />
    </motion.div>
  )

  const helpButton = (
    <Button variant="glass" size="sm" leftIcon="help" onClick={() => onHowToOpenChange(true)}>
      {t('home.help')}
    </Button>
  )

  return (
    <div className="hm-root h-dvh overflow-x-hidden overflow-y-auto overscroll-contain" data-idle={idle || undefined}>
      <div className="relative mx-auto flex min-h-full w-full max-w-[1180px] flex-col px-safe-4 pt-safe-3 pb-safe-3 sm:px-safe-6 lg:px-safe-10 lg:pt-safe-6 lg:pb-safe-5">
        {/* Top left: the sound button floats in the top-right corner. */}
        <header className="flex h-11 shrink-0 items-center gap-2 lg:absolute lg:top-6 lg:left-10 lg:z-10">
          {helpButton}
          <LanguagePicker />
        </header>

        <main className="hm-main flex flex-1 flex-col sm:justify-center">
          <section
            aria-label="UNSHUFFLE"
            className="hm-hero flex flex-1 flex-col items-center justify-center pt-2 pb-6 text-center sm:flex-none sm:pb-8 lg:pt-2"
          >
            <motion.p
              {...rise(0.05)}
              className="hm-eyebrow eyebrow mb-3 flex items-center gap-2 text-ink-300 lg:mb-5 lg:[@media(max-height:780px)]:hidden"
            >
              <span className="h-px w-6 bg-linear-to-r from-transparent to-ink-400/60" />
              {t('home.hero.eyebrow')}
              <span className="h-px w-6 bg-linear-to-l from-transparent to-ink-400/60" />
            </motion.p>
            <div className="relative">
              <div aria-hidden className="hm-hero-glow" />
              <h1 className="relative m-0">
                <HeroLogo />
              </h1>
            </div>
            <motion.p
              {...rise(0.5)}
              className="hm-tagline mt-4 max-w-[22rem] text-[15px] leading-snug text-balance text-ink-200 sm:text-base lg:mt-5 lg:max-w-none lg:text-xl"
            >
              {rich(t('home.hero.tagline'), { b: (c) => <span className="font-bold text-white">{c}</span> })}
            </motion.p>
            {landscape && demoStrip}
          </section>

          {!wide && !landscape && demoStrip}

          <div className="hm-actions mx-auto w-full max-w-[440px] lg:grid lg:max-w-none lg:grid-cols-[minmax(0,1fr)_minmax(360px,408px)] lg:items-stretch lg:gap-7">
            {wide && (
              <motion.div {...rise(0.42)} className="flex min-w-0 flex-col">
                <Panel as="aside" aria-label={t('home.demoLabel')} padding="none" className="flex flex-1 flex-col p-6 xl:p-7">
                  <ShuffleDemo paused={howToOpen} idle={idle} className="flex-1" />
                </Panel>
              </motion.div>
            )}
            <motion.div {...rise(wide ? 0.3 : 0.25)} className="flex min-w-0 flex-col">
              {card}
            </motion.div>
          </div>
        </main>

        <footer className="flex shrink-0 items-center justify-center gap-x-5 pt-4 text-[11px] font-semibold text-ink-400 lg:pt-6">
          <FooterItem icon="users" desktopOnly>
            {t('home.footer.players', { count: MAX_PLAYERS })}
          </FooterItem>
          <FooterItem icon="bolt" desktopOnly>
            {t('home.footer.noAccount')}
          </FooterItem>
          <FooterItem icon="music">{t('home.footer.deezer')}</FooterItem>
        </footer>
      </div>

      <HowToPlay open={howToOpen} onClose={() => onHowToOpenChange(false)} />
    </div>
  )
}

// ---------------------------------------------------------------- bits

/**
 * The wordmark's letters use motion layout projection: re-rendering it measures
 * all of them (a forced layout). Memoized so typing a name or a code, or the
 * idle flag, doesn't re-render it.
 */
const HeroLogo = memo(function HeroLogo() {
  return <Logo size="hero" className="hm-logo lg:text-[length:clamp(3.5rem,min(8.2vw,12.5vh),7.5rem)]!" />
})

function SectionLabel({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <p className="eyebrow mb-3 flex items-center justify-center gap-1.5 text-lime!">
      <Icon name={icon} size={13} strokeWidth={2.6} />
      {children}
    </p>
  )
}

function LabelDivider({ children }: { children: ReactNode }) {
  return (
    <div className="hm-sep my-4 flex items-center gap-3 sm:my-5">
      <span aria-hidden className="h-px flex-1 bg-linear-to-r from-transparent to-white/12" />
      <span className="eyebrow text-ink-400">{children}</span>
      <span aria-hidden className="h-px flex-1 bg-linear-to-l from-transparent to-white/12" />
    </div>
  )
}

function FooterItem({ icon, desktopOnly = false, children }: { icon: IconName; desktopOnly?: boolean; children: ReactNode }) {
  return (
    <span className={cn('items-center gap-1.5', desktopOnly ? 'hidden lg:inline-flex' : 'inline-flex')}>
      <Icon name={icon} size={12} strokeWidth={2.4} className="shrink-0 opacity-80" />
      {children}
    </span>
  )
}

function InlineError({ message, className }: { message: Msg | null; className?: string }) {
  useT()
  const text = tm(message)
  return (
    <AnimatePresence initial={false}>
      {text ? (
        <motion.p
          key={text}
          role="alert"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <span className={cn('flex items-start justify-center gap-1.5 text-center text-[13px] leading-snug font-semibold text-coral', className)}>
            <Icon name="alert" size={15} strokeWidth={2.4} className="mt-px shrink-0" />
            <span>{text}</span>
          </span>
        </motion.p>
      ) : null}
    </AnimatePresence>
  )
}

function PendingLine({ show, onCancel, children }: { show: boolean; onCancel?: () => void; children: ReactNode }) {
  const t = useT()
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <p role="status" className="flex items-center justify-center gap-2 pt-1 text-xs text-ink-300">
            <span>{children}</span>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="-my-2 rounded-full px-2 py-2 font-bold text-ink-100 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white hover:decoration-white/60"
              >
                {t('home.cancel')}
              </button>
            )}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Banner({
  icon,
  tone,
  onDismiss,
  children,
}: {
  icon: IconName
  tone: 'coral' | 'gold'
  onDismiss?: () => void
  children: ReactNode
}) {
  const t = useT()
  return (
    <motion.div
      role={tone === 'coral' ? 'alert' : 'status'}
      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
      animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.22 }}
      className="overflow-hidden"
    >
      <div
        className={cn(
          'flex items-center gap-2.5 rounded-2xl border py-2.5 pr-1.5 pl-3 text-[13px] leading-snug font-semibold',
          tone === 'coral' ? 'border-coral/35 bg-coral/12 text-ink-50' : 'border-gold/35 bg-gold/10 text-ink-50',
        )}
      >
        <Icon name={icon} size={18} strokeWidth={2.4} className={cn('shrink-0', tone === 'coral' ? 'text-coral' : 'text-gold')} />
        <span className="min-w-0 flex-1">{children}</span>
        {onDismiss && (
          <button
            type="button"
            aria-label={t('home.dismissNotice')}
            onClick={onDismiss}
            className="grid size-9 shrink-0 place-items-center rounded-full text-ink-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Icon name="x" size={16} strokeWidth={2.6} />
          </button>
        )}
      </div>
    </motion.div>
  )
}
