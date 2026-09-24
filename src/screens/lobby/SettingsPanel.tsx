import { useId } from 'react'
import { Icon, Panel, Segmented, cn, type IconName, type SegmentedTone } from '../../components/ui'
import { SETTINGS_OPTIONS, SNIPPET_DIFFICULTY } from '../../game/constants'
import type { GameSettings } from '../../game/types'
import { formatNumber, t, type MessageKey } from '../../i18n'
import { useT } from '../../i18n/react'
import { withNum } from './num'
import { estimateMinutes } from './rules'

interface SettingsPanelProps {
  settings: GameSettings
  /** Host: true. Everyone else sees the same controls read-only. */
  editable: boolean
  onChange(patch: Partial<GameSettings>): void
  /** compact = slimmer pickers and gaps, for short desktop screens (≤ 800px tall). Default regular. */
  density?: 'regular' | 'compact'
  className?: string
}

type NumericKey = keyof typeof SETTINGS_OPTIONS

interface Row {
  key: NumericKey
  title: MessageKey
  hint: MessageKey
  icon: IconName
  tone: SegmentedTone
  /** Called at render (translated). */
  label(v: number): string
  sublabel?(v: number): string
}

const seconds = (v: number) => t('lobby.rules.seconds', { seconds: v })

const ROWS: Row[] = [
  { key: 'rounds', title: 'lobby.rules.rounds.title', hint: 'lobby.rules.rounds.hint', icon: 'flag', tone: 'violet', label: (v) => formatNumber(v) },
  {
    key: 'snippets',
    title: 'lobby.rules.snippets.title',
    hint: 'lobby.rules.snippets.hint',
    icon: 'scissors',
    tone: 'magenta',
    label: (v) => formatNumber(v),
    sublabel: (v) => (SNIPPET_DIFFICULTY[v] ? t(SNIPPET_DIFFICULTY[v]) : ''),
  },
  { key: 'roundTime', title: 'lobby.rules.roundTime.title', hint: 'lobby.rules.roundTime.hint', icon: 'clock', tone: 'cyan', label: seconds },
  {
    key: 'finalTimer',
    title: 'lobby.rules.finalTimer.title',
    hint: 'lobby.rules.finalTimer.hint',
    icon: 'bolt',
    tone: 'violet',
    label: seconds,
  },
]

/** Game rules: four segmented pickers. Read-only for guests. */
export function SettingsPanel({ settings, editable, onChange, density = 'regular', className }: SettingsPanelProps) {
  const t = useT()
  const titleId = useId()
  const compact = density === 'compact'
  return (
    <Panel as="section" aria-labelledby={titleId} padding="lg" className={cn('flex flex-col', className)}>
      <header className="flex items-center justify-between gap-3">
        <h2 id={titleId} className="display display-skew text-lg text-ink-50 sm:text-xl">
          {t('lobby.rules.title')}
        </h2>
        {editable ? (
          <span className="text-xs font-semibold text-ink-400">
            {withNum(t('lobby.rules.duration', { minutes: estimateMinutes(settings) }), 'font-bold text-ink-200')}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-bold text-ink-300">
            <Icon name="lock" size={12} strokeWidth={2.6} />
            {t('lobby.rules.hostDecides')}
          </span>
        )}
      </header>

      <div className={cn('flex flex-col', compact ? 'mt-4 gap-3.5' : 'mt-5 gap-5')}>
        {ROWS.map((row) => (
          <div key={row.key} className={cn('flex flex-col', compact ? 'gap-1.5' : 'gap-2')}>
            <div className="flex items-baseline justify-between gap-3 px-1">
              <span className="flex shrink-0 items-center gap-2 text-sm font-extrabold whitespace-nowrap text-ink-100">
                <Icon name={row.icon} size={16} strokeWidth={2.4} className="shrink-0 self-center text-ink-300" />
                {t(row.title)}
              </span>
              <span className="min-w-0 truncate text-right text-[11px] font-medium text-ink-400">{t(row.hint)}</span>
            </div>
            <Segmented<number>
              label={t(row.title)}
              value={settings[row.key]}
              readOnly={!editable}
              size={compact ? 'sm' : 'md'}
              tone={row.tone}
              onChange={(v) => onChange({ [row.key]: v })}
              options={SETTINGS_OPTIONS[row.key].map((v) => ({
                value: v,
                label: row.label(v),
                sublabel: row.sublabel?.(v),
                ariaLabel: row.sublabel ? t('lobby.rules.snippetsOption', { snippets: v, difficulty: row.sublabel(v) }) : undefined,
              }))}
            />
          </div>
        ))}
      </div>
    </Panel>
  )
}
