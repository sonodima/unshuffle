import { useId } from 'react'
import { Icon, Panel, Segmented, cn, type IconName, type SegmentedTone } from '../../components/ui'
import { SETTINGS_OPTIONS, SNIPPET_DIFFICULTY } from '../../game/constants'
import type { GameSettings } from '../../game/types'
import { estimateMinutes } from './rules'

export interface SettingsPanelProps {
  settings: GameSettings
  /** Host: true. Everyone else sees the same controls read-only. */
  editable: boolean
  onChange(patch: Partial<GameSettings>): void
  className?: string
}

type NumericKey = keyof typeof SETTINGS_OPTIONS

interface Row {
  key: NumericKey
  title: string
  hint: string
  icon: IconName
  tone: SegmentedTone
  label(v: number): string
  sublabel?(v: number): string
}

const ROWS: Row[] = [
  { key: 'rounds', title: 'Round', hint: 'Una canzone per round', icon: 'flag', tone: 'violet', label: (v) => String(v) },
  {
    key: 'snippets',
    title: 'Spezzoni',
    hint: 'Più pezzi, più difficile',
    icon: 'scissors',
    tone: 'magenta',
    label: (v) => String(v),
    sublabel: (v) => SNIPPET_DIFFICULTY[v] ?? '',
  },
  { key: 'roundTime', title: 'Tempo per round', hint: 'Per rimettere in ordine', icon: 'clock', tone: 'cyan', label: (v) => `${v}s` },
  {
    key: 'finalTimer',
    title: 'Timer finale',
    hint: 'Dopo la prima conferma',
    icon: 'bolt',
    tone: 'violet',
    label: (v) => `${v}s`,
  },
]

/** Game rules: four segmented pickers. Read-only for guests. */
export function SettingsPanel({ settings, editable, onChange, className }: SettingsPanelProps) {
  const titleId = useId()
  return (
    <Panel as="section" aria-labelledby={titleId} padding="lg" className={cn('flex flex-col', className)}>
      <header className="flex items-center justify-between gap-3">
        <h2 id={titleId} className="display display-skew text-lg text-ink-50 sm:text-xl">
          Regole
        </h2>
        {editable ? (
          <span className="text-xs font-semibold text-ink-400">
            Durata max <span className="num font-bold text-ink-200">~{estimateMinutes(settings)} min</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-bold text-ink-300">
            <Icon name="lock" size={12} strokeWidth={2.6} />
            Decide l’host
          </span>
        )}
      </header>

      <div className="mt-5 flex flex-col gap-5">
        {ROWS.map((row) => (
          <div key={row.key} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3 px-1">
              <span className="flex shrink-0 items-center gap-2 text-sm font-extrabold whitespace-nowrap text-ink-100">
                <Icon name={row.icon} size={16} strokeWidth={2.4} className="shrink-0 self-center text-ink-300" />
                {row.title}
              </span>
              <span className="min-w-0 truncate text-right text-[11px] font-medium text-ink-400">{row.hint}</span>
            </div>
            <Segmented<number>
              label={row.title}
              value={settings[row.key]}
              readOnly={!editable}
              tone={row.tone}
              onChange={(v) => onChange({ [row.key]: v })}
              options={SETTINGS_OPTIONS[row.key].map((v) => ({
                value: v,
                label: row.label(v),
                sublabel: row.sublabel?.(v),
                ariaLabel: row.sublabel ? `${v} · ${row.sublabel(v)}` : undefined,
              }))}
            />
          </div>
        ))}
      </div>
    </Panel>
  )
}
