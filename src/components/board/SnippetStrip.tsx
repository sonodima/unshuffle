// Compact read-only row of snippets (results lists, recap). Mini waveforms appear
// when `trackKey` is given and its buffer is decoded.
import { memo, useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { Segment } from '../../game/types'
import type { SnippetMark } from './SnippetBlock'
import { Waveform } from './Waveform'
import { snippetLetters } from './layout'
import './board.css'

export interface SnippetStripProps {
  segments: Segment[]
  hues: number[]
  /** order[position] = segment index. */
  order: number[]
  /** Per POSITION. */
  marks?: readonly (SnippetMark | null)[] | null
  /** xs 18px · sm 28px (default) · md 42px (with letters). */
  size?: 'xs' | 'sm' | 'md'
  /** Enables mini waveforms. */
  trackKey?: string
  /** Show letters (default: only for size md). */
  letters?: boolean
  className?: string
}

export const SnippetStrip = memo(function SnippetStrip({
  segments,
  hues,
  order,
  marks = null,
  size = 'sm',
  trackKey,
  letters,
  className,
}: SnippetStripProps) {
  const labels = useMemo(() => snippetLetters(segments.map((_, i) => hues[i] ?? 0)), [segments, hues])
  const showLetters = letters ?? size === 'md'
  const correct = marks ? marks.filter((m) => m === 'correct').length : null
  const aria =
    `Ordine: ${order.map((s) => labels[s] ?? '?').join(', ')}` +
    (correct != null ? ` — ${correct} su ${order.length} al posto giusto` : '')
  return (
    <div className={className ? `ss ${className}` : 'ss'} data-size={size} role="img" aria-label={aria}>
      {order.map((seg, pos) => {
        const s = segments[seg]
        const mark = marks?.[pos] ?? null
        const style = { '--h': Math.round(hues[seg] ?? 0), '--i': pos } as CSSProperties
        return (
          <div key={pos} className="ss-cell" data-mark={mark ?? undefined} style={style}>
            {trackKey && s && size !== 'xs' && (
              <Waveform
                className="ss-wave"
                trackKey={trackKey}
                start={s.start}
                end={s.end}
                skeleton={false}
                barWidth={size === 'md' ? 1.5 : 1}
                barGap={1}
                scale={0.9}
              />
            )}
            {showLetters && <span className="ss-letter">{labels[seg]}</span>}
          </div>
        )
      })}
    </div>
  )
})
