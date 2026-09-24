// The visual of one snippet: hue-coloured glossy block with its waveform, a
// hue-derived letter (never the correct position) and the slot number badge.
// Pure presentation — SnippetBoard wraps it with drag & playback behaviour.
import { memo } from 'react'
import type { CSSProperties } from 'react'
import type { Segment } from '../../game/types'
import { Waveform } from './Waveform'
import { CheckGlyph, CrossGlyph, LockGlyph, PlayGlyph, StopGlyph } from './icons'
import './board.css'

export type SnippetMark = 'correct' | 'wrong'

export interface SnippetBlockProps {
  trackKey: string
  segment: Segment
  /** 0..360 */
  hue: number
  /** Display label (see snippetLetters). */
  letter: string
  /** 1-based POSITION shown in the corner badge (omit to hide). */
  slot?: number
  /**
   * Small chip in the badge corner that replaces the slot number (e.g. the reveal's
   * "era 5º"). Stays readable on dimmed blocks and steps left of a ✓ / ✗ mark.
   */
  chip?: string | null
  playing?: boolean
  /** Per-frame progress reader for the waveform sweep while `playing`. */
  progress?: () => number | null
  locked?: boolean
  mark?: SnippetMark | null
  /** Delay of the mark pop-in, ms (for staggering). */
  markDelayMs?: number
  /** 'lifted' = drag overlay clone, 'ghost' = placeholder left in the grid while dragging. */
  variant?: 'default' | 'lifted' | 'ghost'
  className?: string
  style?: CSSProperties
}

export const SnippetBlock = memo(function SnippetBlock({
  trackKey,
  segment,
  hue,
  letter,
  slot,
  chip = null,
  playing = false,
  progress,
  locked = false,
  mark = null,
  markDelayMs = 0,
  variant = 'default',
  className,
  style,
}: SnippetBlockProps) {
  const h = Math.round(((hue % 360) + 360) % 360)
  const vars = { '--h': h, '--md': `${markDelayMs}ms`, ...style } as CSSProperties
  return (
    <div
      className={className ? `sb-block ${className}` : 'sb-block'}
      style={vars}
      data-variant={variant}
      data-playing={playing || undefined}
      data-locked={locked || undefined}
      data-mark={mark ?? undefined}
    >
      <div className="sb-glow" aria-hidden="true" />
      <div className="sb-face">
        <div className="sb-gloss" aria-hidden="true" />
        <Waveform
          className="sb-wave"
          trackKey={trackKey}
          start={segment.start}
          end={segment.end}
          active={playing}
          progress={progress}
          color={`hsl(${h} 100% 97%)`}
        />
        <span className="sb-letter" aria-hidden="true">
          {letter}
        </span>
        {slot != null && !chip && (
          <span className="sb-slot" aria-hidden="true">
            {locked && <LockGlyph className="sb-slot-lock" />}
            {slot}
          </span>
        )}
        <span className="sb-hint" aria-hidden="true">
          {playing ? <StopGlyph /> : <PlayGlyph />}
        </span>
      </div>
      {variant === 'ghost' && <div className="sb-ghost" aria-hidden="true" />}
      {chip && (
        <span key={chip} className="sb-chip" aria-hidden="true">
          {chip}
        </span>
      )}
      {mark && (
        <>
          <div key={`ring-${mark}`} className="sb-ring" aria-hidden="true" />
          <div key={`mark-${mark}`} className="sb-mark" aria-hidden="true">
            {mark === 'correct' ? <CheckGlyph /> : <CrossGlyph />}
          </div>
        </>
      )}
    </div>
  )
})
