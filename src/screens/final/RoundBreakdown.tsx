import { useEffect, useRef, useState } from 'react'
import { Avatar, Icon, Panel, cn } from '../../components/ui'
import type { PlayerId } from '../../game/types'
import { useT } from '../../i18n/react'
import { Cover } from './Cover'
import { SectionHeading } from './SectionHeading'
import { formatPoints, type FinalSummary } from './stats'

interface RoundBreakdownProps {
  summary: FinalSummary
  me: PlayerId
  className?: string
}

/** Rounds × players points matrix. Sticky song column; scrolls sideways when players don't fit. */
export function RoundBreakdown({ summary, me, className }: RoundBreakdownProps) {
  const t = useT()
  const { rounds, standings } = summary
  const scroller = useRef<HTMLDivElement>(null)
  const [moreRight, setMoreRight] = useState(false)
  const [scrollable, setScrollable] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const update = () => {
      setScrollable(el.scrollWidth > el.clientWidth + 1)
      setMoreRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
      setScrolled(el.scrollLeft > 2)
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    ro?.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro?.disconnect()
    }
  }, [rounds.length, standings.length])

  if (!rounds.length) return null

  return (
    <section className={className} aria-labelledby="fp-rounds">
      <SectionHeading
        id="fp-rounds"
        icon="music"
        title={t('final.rounds.title')}
        aside={t('final.roundCount', { count: rounds.length })}
      />
      <Panel variant="solid" padding="none" className="overflow-hidden">
        <div
          ref={scroller}
          className="fp-scroll overflow-x-auto"
          data-more-right={moreRight}
          data-scrolled={scrolled}
          tabIndex={scrollable ? 0 : undefined}
          role={scrollable ? 'region' : undefined}
          aria-label={scrollable ? t('final.rounds.scrollLabel') : undefined}
        >
          <table className="w-full border-separate border-spacing-0 text-left">
            <caption className="sr-only">{t('final.rounds.caption')}</caption>
            <thead>
              <tr>
                <th scope="col" className="fp-sticky sticky left-0 z-20 bg-ink-900 px-3 py-3 align-bottom sm:min-w-[300px] sm:px-5">
                  <span className="eyebrow">{t('final.rounds.song')}</span>
                </th>
                {standings.map((s) => (
                  <th
                    key={s.player.id}
                    scope="col"
                    className={cn('min-w-[76px] px-1.5 pt-3 pb-2.5 text-center align-bottom sm:min-w-[92px]', s.player.id === me && 'bg-violet/[0.12]')}
                  >
                    <div className="flex flex-col items-center gap-1.5">
                      <Avatar avatar={s.player.avatar} color={s.player.color} name={s.player.name} size="sm" connected={s.player.connected} />
                      <span
                        title={s.player.name}
                        className={cn('block max-w-[min(100%,140px)] truncate text-[12px] font-extrabold', s.player.id === me ? 'text-violet-bright' : 'text-ink-200')}
                      >
                        {s.player.id === me ? t('final.you') : s.player.name}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rounds.map((r) => (
                <tr key={r.index} className="group">
                  <th scope="row" className="fp-sticky sticky left-0 z-10 border-t border-white/[0.06] bg-ink-900 px-3 py-2.5 font-normal sm:px-5">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <span className="num hidden w-7 shrink-0 text-[12px] font-bold text-ink-400 sm:block">{t('final.roundShort', { round: r.index + 1 })}</span>
                      <span className="relative shrink-0">
                        <Cover src={r.track?.coverSmall || r.track?.cover} className="size-10 rounded-lg sm:size-11" />
                        <span className="num absolute -top-2 -left-2 rounded-full bg-ink-950 px-1.5 text-[11px] leading-[17px] font-bold whitespace-nowrap text-ink-200 ring-1 ring-white/15 sm:hidden">
                          {t('final.roundShort', { round: r.index + 1 })}
                        </span>
                      </span>
                      <div className="w-[92px] min-w-0 sm:w-auto sm:max-w-[260px]">
                        <div className="line-clamp-2 text-[12.5px] leading-[1.15] font-extrabold text-ink-50 sm:line-clamp-1 sm:text-[13px]">{r.track?.title ?? t('final.rounds.fallbackTitle', { round: r.index + 1 })}</div>
                        <div className="mt-0.5 truncate text-[12px] leading-tight font-semibold text-ink-300">{r.track?.artist ?? '—'}</div>
                      </div>
                    </div>
                  </th>
                  {standings.map((s) => {
                    const res = r.byPlayer[s.player.id]
                    const top = r.topIds.includes(s.player.id)
                    return (
                      <td
                        key={s.player.id}
                        className={cn(
                          'border-t border-white/[0.06] px-1.5 py-2.5 text-center',
                          s.player.id === me && 'bg-violet/[0.12]',
                        )}
                      >
                        {res ? (
                          <div className="flex flex-col items-center">
                            <span className={cn('num inline-flex items-center gap-1 text-[14px] font-bold', top ? 'text-gold' : res.points ? 'text-ink-50' : 'text-ink-400')}>
                              {top && <Icon name="crown" size={11} filled strokeWidth={2.4} label={t('final.rounds.best')} />}
                              {formatPoints(res.points)}
                            </span>
                            <span className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-bold">
                              {res.perfect ? (
                                <span className="inline-flex items-center gap-0.5 text-[11px] tracking-[0.04em] text-lime uppercase">
                                  <Icon name="star" size={10} filled strokeWidth={2.6} />
                                  {t('final.rounds.perfect')}
                                </span>
                              ) : (
                                <span className="num text-ink-400">
                                  {res.correct}/{r.snippets}
                                </span>
                              )}
                              {res.timedOut && <Icon name="clock" size={11} strokeWidth={2.6} className="text-coral" label={t('final.rounds.timedOut')} />}
                            </span>
                          </div>
                        ) : (
                          <span className="text-ink-500" aria-label={t('final.didNotPlay')}>
                            —
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" className="fp-sticky sticky left-0 z-10 border-t border-white/10 bg-ink-850 px-3 py-3 sm:px-5">
                  <span className="display display-skew text-[12px] text-ink-100">{t('final.rounds.total')}</span>
                </th>
                {standings.map((s) => (
                  <td key={s.player.id} className={cn('border-t border-white/10 px-1.5 py-3 text-center', s.player.id === me ? 'bg-violet/[0.16]' : 'bg-ink-850/60')}>
                    <span className={cn('num text-[15px] font-extrabold', s.rank === 1 ? 'text-gold' : 'text-ink-50')}>{formatPoints(s.score)}</span>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/[0.06] px-3 py-2.5 text-[12px] font-semibold text-ink-300 sm:px-5">
          <Legend icon="crown" className="text-gold" label={t('final.rounds.best')} />
          <Legend icon="star" className="text-lime" label={t('final.rounds.perfect')} />
          <Legend icon="clock" className="text-coral" label={t('final.rounds.timedOut')} />
        </div>
      </Panel>
    </section>
  )
}

function Legend({ icon, label, className }: { icon: 'crown' | 'star' | 'clock'; label: string; className: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Icon name={icon} size={12} filled={icon !== 'clock'} strokeWidth={2.4} className={className} />
      <span>{label}</span>
    </span>
  )
}
