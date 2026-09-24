import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Badge, Button, Icon, Panel, Vinyl, cn } from '../../components/ui'
import type { PlaylistRef } from '../../game/types'
import { useT } from '../../i18n/react'
import { withNum } from './num'
import { Cover } from './PlaylistPicker'

interface PlaylistHeroProps {
  playlist: PlaylistRef | null
  isHost: boolean
  /** Host: "Cambia" pressed (focus the picker). Omit to hide the button. */
  onChange?: () => void
  /** row = sleeve left, text right (phones, narrow columns) · column = big centred showcase. */
  layout?: 'row' | 'column'
  /** Sleeve size in px (default: 212 column, 100 row). */
  size?: number
  className?: string
}

/** The chosen playlist, shown to everyone as a record sleeve with the vinyl sliding out. */
export function PlaylistHero({ playlist, isHost, onChange, layout = 'row', size, className }: PlaylistHeroProps) {
  const t = useT()
  const column = layout === 'column'
  const sleeve = size ?? (column ? 212 : 100)
  return (
    <Panel
      as="section"
      aria-label={t('lobby.hero.label')}
      padding="lg"
      glow={playlist ? 'violet' : undefined}
      className={cn('flex overflow-hidden', column ? 'flex-col items-center text-center' : 'items-center gap-4 sm:gap-5', className)}
    >
      <PlaylistRecord playlist={playlist} sleeve={sleeve} />
      <div className={cn('min-w-0', column ? 'mt-7 flex w-full flex-col items-center' : 'flex-1')}>
        <span className="eyebrow">{t(playlist ? 'lobby.hero.eyebrow' : isHost ? 'lobby.hero.none' : 'lobby.hero.incoming')}</span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={playlist?.id ?? 'none'}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
            className={cn('min-w-0', column && 'flex w-full flex-col items-center')}
          >
            {playlist ? (
              <>
                <h2
                  className={cn(
                    'display display-skew mt-1.5 line-clamp-2 pr-1 text-ink-50 [overflow-wrap:anywhere]',
                    column ? cn('max-w-[18ch] leading-[1.05]', sleeve >= 180 ? 'text-[26px]' : 'text-[22px]') : 'text-[17px] leading-[1.1] sm:text-xl',
                  )}
                  title={playlist.title}
                >
                  {playlist.title}
                </h2>
                <div className={cn('mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5', column && 'justify-center')}>
                  <Badge tone="violet" size="md" icon="music">
                    {withNum(t('lobby.tracks', { count: playlist.nbTracks }))}
                  </Badge>
                  {playlist.creator && <span className="truncate text-xs font-semibold text-ink-300">{t('lobby.hero.by', { creator: playlist.creator })}</span>}
                </div>
              </>
            ) : (
              <p className={cn('mt-1.5 text-sm leading-relaxed text-ink-300', column && 'max-w-[30ch]')}>
                {/* Guests: the start bar already says "L’host sta scegliendo la playlist…"; don't repeat it word for word. */}
                {t(isHost ? 'lobby.hero.hostEmpty' : 'lobby.hero.guestEmpty')}
              </p>
            )}
          </motion.div>
        </AnimatePresence>
        {isHost && onChange && playlist && (
          <Button variant="glass" size="sm" leftIcon="refresh" onClick={onChange} className={cn(column ? 'mt-5' : 'mt-3.5')}>
            {t('lobby.hero.change')}
          </Button>
        )}
      </div>
    </Panel>
  )
}

interface PlaylistRecordProps {
  playlist: PlaylistRef | null
  /** Sleeve (cover) size in px. */
  sleeve: number
  /** Spin the record once a playlist is in (default true). */
  spin?: boolean
  /** Magenta halo under the record once a playlist is in (default true). */
  glow?: boolean
  /** Always reserve the "record out" width, so text next to it never shifts (default false). */
  reserve?: boolean
  className?: string
}

/** Record sleeve (the playlist cover) with the vinyl sliding out once a playlist is chosen. */
export function PlaylistRecord({ playlist, sleeve, spin = true, glow = true, reserve = false, className }: PlaylistRecordProps) {
  const reduce = useReducedMotion()
  const disc = Math.round(sleeve * 0.94)
  const full = Math.round(sleeve * 0.4)
  const small = sleeve < 80
  // Small empty sleeves hide the record entirely: a sliver of black disc at 44px reads as a smudge, not a record.
  const out = playlist ? full : small ? 0 : Math.round(sleeve * 0.16)
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: sleeve + (reserve ? full : out), height: sleeve }}>
      <motion.div
        className="absolute top-1/2 left-0"
        style={{ marginTop: -disc / 2, marginLeft: (sleeve - disc) / 2 }}
        initial={false}
        animate={{ x: out, rotate: 0, opacity: playlist || !small ? 1 : 0 }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 140, damping: 18, delay: 0.12 }}
      >
        <Vinyl cover={playlist?.picture} size={disc} spin={spin && !!playlist} period={3.2} glow={glow && playlist ? 'var(--color-magenta)' : undefined} />
      </motion.div>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={playlist?.id ?? 'empty'}
          className="absolute inset-y-0 left-0"
          style={{ width: sleeve }}
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: -18, rotate: -6, scale: 0.92 }}
          animate={{ opacity: 1, x: 0, rotate: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, x: 14, rotate: 4, scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        >
          {playlist ? (
            <Cover
              src={playlist.picture}
              rounded={small ? 'rounded-[10px]' : 'rounded-[12px]'}
              className={
                small
                  ? 'shadow-[0_0_0_1px_rgb(255_255_255/0.12),4px_0_12px_-4px_rgb(0_0_0/0.8)]'
                  : 'shadow-[0_0_0_1px_rgb(255_255_255/0.12),8px_0_24px_-6px_rgb(0_0_0/0.8),0_24px_48px_-16px_rgb(0_0_0/0.9)]'
              }
            />
          ) : (
            <div
              className={cn(
                'grid size-full place-items-center border-dashed bg-ink-900/90',
                small ? 'rounded-[10px] border-[1.5px] border-white/20' : 'rounded-[12px] border-2 border-white/15',
              )}
            >
              <Icon name="music" size={Math.max(16, Math.round(sleeve * 0.26))} className="text-ink-500" />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/** Text with a softly bouncing ellipsis (reduced motion: static). */
export function WaitingText({ children, className }: { children: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-baseline', className)}>
      {children}
      <span aria-hidden className="inline-flex">
        {[0, 1, 2].map((i) => (
          <span key={i} className="animate-blink" style={{ animationDelay: `${i * 0.2}s` }}>
            .
          </span>
        ))}
      </span>
    </span>
  )
}
