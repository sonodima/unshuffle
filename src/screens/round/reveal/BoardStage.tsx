// My arrangement as a locked board. Sizes itself so the grid keeps the same
// shape as during play (6 → 3×2, 8 → 4×2, 12 → 4×3, 16 → 4×4) instead of
// letting a tall container reflow it into two columns.
//
// The reveal decorations are board props: per-position chips in the slot corner
// ("era 5º", "→ 3º"), a "now playing" highlight on the block the reveal song is in
// (glow + waveform sweep following the song), and taps that seek the song.
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { SnippetBoard } from '../../../components/board'
import type { BoardHighlight, SnippetMark } from '../../../components/board'
import { cn } from '../../../components/ui'
import type { Segment } from '../../../game/types'
import { boardHeightFor } from './model'

export interface BoardStageProps {
  trackKey: string
  segments: Segment[]
  hues: number[]
  order: number[]
  marks: readonly (SnippetMark | null)[] | null
  /** Per POSITION: a small chip in the block's corner (replaces the slot number). */
  labels?: readonly (string | null)[] | null
  /** Segment index the reveal song is playing (-1 = none). */
  nowPlaying?: number
  /** 0..1 progress of the song inside a segment (null = elsewhere), read every frame. */
  nowPlayingProgress?: (segment: number) => number | null
  /** Tap on a block (default: the board plays the lone snippet). */
  onTapSegment?: (segment: number) => void
  visible: boolean
  sorted: boolean
  className?: string
}

const NOOP = () => {}

export const BoardStage = memo(function BoardStage({
  trackKey,
  segments,
  hues,
  order,
  marks,
  labels,
  nowPlaying = -1,
  nowPlayingProgress,
  onTapSegment,
  visible,
  sorted,
  className,
}: BoardStageProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  // Width from the observer only: a synchronous clientWidth read right after mount
  // would force a layout of the whole fresh reveal tree in the same task.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[entries.length - 1]?.contentRect.width ?? 0)
      setWidth((prev) => (prev === w ? prev : w))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const height = width > 0 ? boardHeightFor(segments.length, width) : 0

  // Keep the reader in a ref: the highlight object only changes with the segment.
  const progressRef = useRef(nowPlayingProgress)
  useEffect(() => {
    progressRef.current = nowPlayingProgress
  })
  const highlight = useMemo<BoardHighlight | null>(
    () => (nowPlaying >= 0 ? { seg: nowPlaying, progress: () => progressRef.current?.(nowPlaying) ?? null } : null),
    [nowPlaying],
  )

  return (
    <div
      ref={ref}
      className={cn('rv-board-wrap relative w-full', className)}
      data-visible={visible || undefined}
      data-sorted={sorted || undefined}
      data-rv-board=""
      data-now-playing={nowPlaying >= 0 ? nowPlaying : undefined}
    >
      {height > 0 && (
        <div className="rv-board relative mx-auto w-full" style={{ height, maxHeight: '100%' }}>
          <SnippetBoard
            trackKey={trackKey}
            segments={segments}
            hues={hues}
            order={order}
            onOrderChange={NOOP}
            locked
            marks={marks}
            labels={labels}
            highlight={highlight}
            onTapSegment={onTapSegment}
          />
          <div aria-hidden className="rv-sweep" />
        </div>
      )}
    </div>
  )
})
