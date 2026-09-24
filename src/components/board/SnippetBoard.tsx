// The core gameplay surface: a grid of snippet blocks to drag back into order.
// Mouse (drag after 4px), touch/pen (after 10px: a finger rolls a few px on a tap)
// and keyboard (space lifts, arrows move, space drops). Tap / Enter plays a single
// snippet; long-press / Shift+Enter plays the sequence from that position.
// Programmatic order changes (reveal) animate blocks to their new slots.
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type {
  Announcements,
  DragEndEvent,
  DragMoveEvent,
  DragOverEvent,
  DragStartEvent,
  DropAnimation,
  Modifier,
  PointerSensorOptions,
  PointerSensorProps,
  ScreenReaderInstructions,
  UniqueIdentifier,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Segment } from '../../game/types'
import { useT } from '../../i18n/react'
import { joinFacts } from '../ui/format'
import {
  PLAY_ALL_TAG,
  blockTag,
  scheduledSegmentAt,
  useBoardAudio,
  useEngineState,
} from './boardAudio'
import type { AudioEngine } from '../../audio/engine'
import { SnippetBlock } from './SnippetBlock'
import type { SnippetMark } from './SnippetBlock'
import { usePlayAll } from './usePlayAll'
import { fitGrid, slotOffset, snippetLetters } from './layout'
import type { GridLayout } from './layout'
import './board.css'

export interface SnippetBoardProps {
  /** Audio buffer key, 'track:<id>'. */
  trackKey: string
  /** Segments in CORRECT order (segments[i].index === i). */
  segments: Segment[]
  /** Hue per segment index. */
  hues: number[]
  /** Controlled arrangement: order[position] = segment index. */
  order: number[]
  onOrderChange: (order: number[]) => void
  /** No dragging (playback still works). */
  locked?: boolean
  /** Reveal marks per POSITION. */
  marks?: readonly (SnippetMark | null)[] | null
  /** Per POSITION: a small chip that replaces the slot badge (e.g. "era 5º"); null = keep the badge. */
  labels?: readonly (string | null)[] | null
  /**
   * An external playhead (e.g. the reveal song): segment `seg` glows and its waveform sweeps
   * with `progress()` (0..1 inside the segment, null = not in it). Wins over the board's own
   * playback highlight while set.
   */
  highlight?: BoardHighlight | null
  /** Tap / click / Enter on a block calls this instead of playing the lone snippet. */
  onTapSegment?: (segment: number) => void
  className?: string
}

export interface BoardHighlight {
  /** Segment index (not position). */
  seg: number
  progress: () => number | null
}

const TRANSITION = { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' }
const SWAP_THROTTLE_MS = 70

// Drag activation distance per pointer type. A mouse is precise; a finger rolls
// 5–10px on an ordinary tap (Android touch slop 8dp, iOS ≈10pt), and with 4px
// every such tap became a zero-length drag that swallowed the click.
const MOUSE_ACTIVATION = { distance: 4 }
const TOUCH_ACTIVATION = { distance: 10 }
/** A pointer drag dropped back on its own slot within this travel/time is a tap. */
const TAP_SLOP_PX = 16
const TAP_MAX_MS = 600
/** Press-and-hold (without dragging) plays the sequence from that position. */
const LONG_PRESS_MS = 450
/** The block visibly sinks this long into a press (quick taps never show it). */
const PRESS_FEEDBACK_MS = 140
const LONG_PRESS_SLOP_PX = 10

/** PointerSensor whose activation distance depends on the pointer that started it. */
class BoardPointerSensor extends PointerSensor {
  constructor(props: PointerSensorProps) {
    const pointerType = (props.event as Partial<PointerEvent>).pointerType
    const activationConstraint = pointerType === 'mouse' ? MOUSE_ACTIVATION : TOUCH_ACTIVATION
    super({ ...props, options: { ...props.options, activationConstraint } })
  }
}

// Module constants: useSensor memoizes on option identity.
const POINTER_OPTIONS: PointerSensorOptions = { activationConstraint: MOUSE_ACTIVATION }
const KEYBOARD_OPTIONS = {
  coordinateGetter: sortableKeyboardCoordinates,
  keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter', 'Tab'] },
}

const idOf = (segment: number): string => `s${segment}`
const segOf = (id: UniqueIdentifier): number => Number(String(id).slice(1))

function sanitizeOrder(order: readonly number[], n: number): number[] {
  if (order.length === n) {
    const seen = new Uint8Array(n)
    let ok = true
    for (const v of order) {
      if (!Number.isInteger(v) || v < 0 || v >= n || seen[v]) {
        ok = false
        break
      }
      seen[v] = 1
    }
    if (ok) return order as number[]
  }
  const seen = new Set<number>()
  const out: number[] = []
  for (const v of order) {
    if (Number.isInteger(v) && v >= 0 && v < n && !seen.has(v)) {
      seen.add(v)
      out.push(v)
    }
  }
  for (let i = 0; i < n; i++) if (!seen.has(i)) out.push(i)
  return out
}

function vibrate(ms: number) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    // unsupported
  }
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

const dropAnimation: DropAnimation = {
  duration: 280,
  easing: 'cubic-bezier(.2,.8,.2,1)',
  sideEffects: defaultDropAnimationSideEffects({
    className: { dragOverlay: 'sb-dropping' },
    styles: { active: { opacity: '0' } },
  }),
}

interface ItemProps {
  seg: number
  position: number
  /** 1-based slot shown on the badge (live position while dragging). */
  slot: number
  total: number
  trackKey: string
  segment: Segment
  hue: number
  letter: string
  chip: string | null
  playing: boolean
  progress: () => number | null
  locked: boolean
  mark: SnippetMark | null
  dragging: { current: boolean }
  onToggle: (seg: number) => void
  /** Play the sequence from this block's position. */
  onPlayFrom: (seg: number) => void
  press: PressHandlers
  registerFlip: (seg: number, el: HTMLElement | null) => void
}

interface PressHandlers {
  start: (seg: number, e: ReactPointerEvent<HTMLElement>) => void
  move: (e: ReactPointerEvent<HTMLElement>) => void
  end: () => void
  /** True once when the click that follows a fired long-press must be ignored. */
  consumeClick: () => boolean
}

const preventFocus = (e: ReactMouseEvent) => {
  if (e.button === 0) e.preventDefault()
}

const SortableSnippet = memo(function SortableSnippet({
  seg,
  position,
  slot,
  total,
  trackKey,
  segment,
  hue,
  letter,
  chip,
  playing,
  progress,
  locked,
  mark,
  dragging,
  onToggle,
  onPlayFrom,
  press,
  registerFlip,
}: ItemProps) {
  const t = useT()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: idOf(seg),
    disabled: locked,
    transition: TRANSITION,
    attributes: { roleDescription: t('board.item.roleDescription') },
  })
  const flipRef = useCallback((el: HTMLDivElement | null) => registerFlip(seg, el), [registerFlip, seg])
  const keyDown = listeners?.onKeyDown as ((e: ReactKeyboardEvent) => void) | undefined
  const pointerDown = listeners?.onPointerDown as ((e: ReactPointerEvent<HTMLElement>) => void) | undefined
  const label = joinFacts([
    t('board.item.label', { letter, position: position + 1, total }),
    playing && t('board.item.playing'),
    mark === 'correct' ? t('board.item.correct') : mark === 'wrong' && t('board.item.wrong'),
    chip,
    locked && t('board.item.locked'),
  ])
  return (
    <div
      ref={setNodeRef}
      className="sb-item"
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      aria-disabled={undefined}
      aria-label={label}
      data-snippet-block=""
      data-seg={seg}
      data-pos={position}
      data-locked={locked || undefined}
      data-dragging={isDragging || undefined}
      onKeyDown={(e) => {
        // Mod+Enter belongs to the screen (confirm); plain Enter plays, Shift+Enter plays from here.
        if (e.key === 'Enter' && !dragging.current && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault()
          if (e.repeat) return
          if (e.shiftKey) onPlayFrom(seg)
          else onToggle(seg)
          return
        }
        keyDown?.(e)
      }}
      onPointerDown={(e) => {
        press.start(seg, e)
        pointerDown?.(e)
      }}
      onPointerMove={press.move}
      onPointerUp={press.end}
      onPointerCancel={press.end}
      onPointerLeave={press.end}
      onClick={() => {
        if (!press.consumeClick()) onToggle(seg)
      }}
      // Keep mouse clicks from focusing the block, so Space stays the play-all hotkey
      // (keyboard users reach blocks with Tab).
      onMouseDown={preventFocus}
    >
      <div className="sb-flip" ref={flipRef}>
        <SnippetBlock
          trackKey={trackKey}
          segment={segment}
          hue={hue}
          letter={letter}
          slot={slot}
          chip={chip}
          playing={playing}
          progress={progress}
          locked={locked}
          mark={mark}
          markDelayMs={position * 85}
          variant={isDragging ? 'ghost' : 'default'}
        />
      </div>
    </div>
  )
})

export function SnippetBoard({
  trackKey,
  segments,
  hues,
  order,
  onOrderChange,
  locked = false,
  marks = null,
  labels = null,
  highlight = null,
  onTapSegment,
  className,
}: SnippetBoardProps) {
  const t = useT()
  const audio = useBoardAudio()
  const engine = audio.engine
  const n = segments.length
  const safeOrder = useMemo(() => sanitizeOrder(order, n), [order, n])

  // Optimistic order after a drop, until the parent passes a new `order`.
  const [optimistic, setOptimistic] = useState<{ base: number[]; order: number[] } | null>(null)
  const shown = optimistic && optimistic.base === safeOrder ? optimistic.order : safeOrder
  const shownKey = shown.join(',')

  const safeHues = useMemo(
    () => segments.map((_, i) => (Number.isFinite(hues[i]) ? hues[i] : (i * 360) / Math.max(1, n))),
    [segments, hues, n],
  )
  const letters = useMemo(() => snippetLetters(safeHues), [safeHues])

  // --- sizing ------------------------------------------------------------------
  const rootRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [freeHeight, setFreeHeight] = useState(false)
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const measure = () => {
      const w = Math.floor(el.clientWidth)
      const h = Math.floor(el.clientHeight)
      // Parent gave us no height: switch (once) to width-driven layout in normal flow.
      if (h < 24 && w > 0) setFreeHeight(true)
      setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const layout = useMemo<GridLayout | null>(
    () => (size && size.w > 0 ? fitGrid(n, size.w, freeHeight ? Infinity : size.h) : null),
    [n, size, freeHeight],
  )

  // --- refs for stable callbacks ---------------------------------------------------
  const shownRef = useRef(shown)
  const segmentsRef = useRef(segments)
  const lettersRef = useRef(letters)
  const trackKeyRef = useRef(trackKey)
  const engineRef = useRef<AudioEngine | null>(engine)
  const lockedRef = useRef(locked)
  const layoutRef = useRef(layout)
  const onOrderChangeRef = useRef(onOrderChange)
  const onTapSegmentRef = useRef(onTapSegment)
  const safeOrderRef = useRef(safeOrder)
  /** A drag is in progress (any sensor). */
  const draggingRef = useRef(false)
  useLayoutEffect(() => {
    safeOrderRef.current = safeOrder
    shownRef.current = shown
    segmentsRef.current = segments
    lettersRef.current = letters
    trackKeyRef.current = trackKey
    engineRef.current = engine
    lockedRef.current = locked
    layoutRef.current = layout
    onOrderChangeRef.current = onOrderChange
    onTapSegmentRef.current = onTapSegment
  })

  // --- playback -----------------------------------------------------------------
  const pb = useEngineState()
  let playingSeg = -1
  if (highlight && highlight.seg >= 0 && highlight.seg < n) {
    playingSeg = highlight.seg
  } else if (pb.playing && pb.key === trackKey) {
    if (pb.tag === PLAY_ALL_TAG && pb.mode === 'sequence') {
      playingSeg = scheduledSegmentAt(trackKey, pb.index) ?? shown[pb.index] ?? -1
    } else if (pb.tag && pb.tag.startsWith('block:')) {
      playingSeg = Number(pb.tag.slice(6))
    }
  }

  // One stable per-frame progress reader per segment (read by the playing block's waveform).
  const progressFns = useMemo(
    () =>
      Array.from({ length: n }, (_, seg) => (): number | null => {
        const eng = engineRef.current
        if (!eng) return null
        const p = eng.getPosition()
        if (!p || p.key !== trackKeyRef.current) return null
        if (p.tag === PLAY_ALL_TAG && p.mode === 'sequence') {
          const s = scheduledSegmentAt(p.key, p.index) ?? shownRef.current[p.index]
          return s === seg ? p.progress : null
        }
        return p.tag === blockTag(seg) ? p.progress : null
      }),
    [n],
  )

  const toggleSegment = useCallback((seg: number) => {
    const eng = engineRef.current
    const segment = segmentsRef.current[seg]
    if (!eng || !segment) return
    try {
      void eng.unlock().catch(() => {})
      const s = eng.getState()
      if (s.playing && s.key === trackKeyRef.current && s.tag === blockTag(seg)) {
        eng.stop()
      } else {
        eng.playSegment(trackKeyRef.current, { start: segment.start, end: segment.end }, { tag: blockTag(seg), index: seg })
      }
    } catch {
      // Audio unavailable: the board stays usable.
    }
  }, [])

  // A tap on a block: the screen's handler when it has one, else play the lone snippet.
  const tapSegment = useCallback(
    (seg: number) => {
      const handler = onTapSegmentRef.current
      if (!handler) return toggleSegment(seg)
      try {
        handler(seg)
      } catch (err) {
        console.warn('[board] onTapSegment failed', err)
      }
    },
    [toggleSegment],
  )

  // Play-all from a block's position (long-press / Shift+Enter). Same engine run as
  // the TransportBar's, so its play/stop state follows along.
  const { play: playAllFrom, ready: audioReady } = usePlayAll(trackKey, segments, shown)
  const audioReadyRef = useRef(audioReady)
  useLayoutEffect(() => {
    audioReadyRef.current = audioReady
  })
  const playFromSegment = useCallback(
    (seg: number) => {
      const pos = shownRef.current.indexOf(seg)
      if (pos >= 0) playAllFrom(pos)
    },
    [playAllFrom],
  )

  // --- press & hold -----------------------------------------------------------------
  const pressRef = useRef<{
    pointerId: number
    x: number
    y: number
    el: HTMLElement
    timer: ReturnType<typeof setTimeout>
    feedback: ReturnType<typeof setTimeout>
  } | null>(null)
  const longPressFired = useRef(false)
  const cancelPress = useCallback(() => {
    const p = pressRef.current
    if (!p) return
    pressRef.current = null
    clearTimeout(p.timer)
    clearTimeout(p.feedback)
    delete p.el.dataset.pressing
  }, [])
  useEffect(() => cancelPress, [cancelPress])
  const press = useMemo<PressHandlers>(
    () => ({
      start: (seg, e) => {
        cancelPress()
        longPressFired.current = false
        if (!e.isPrimary || e.button !== 0) return
        const el = e.currentTarget
        const feedback = setTimeout(() => {
          if (!draggingRef.current) el.dataset.pressing = ''
        }, PRESS_FEEDBACK_MS)
        const timer = setTimeout(() => {
          cancelPress()
          if (draggingRef.current || !audioReadyRef.current) return
          longPressFired.current = true
          vibrate(12)
          playFromSegment(seg)
        }, LONG_PRESS_MS)
        pressRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, el, timer, feedback }
      },
      move: (e) => {
        const p = pressRef.current
        if (p && e.pointerId === p.pointerId && Math.hypot(e.clientX - p.x, e.clientY - p.y) > LONG_PRESS_SLOP_PX) cancelPress()
      },
      end: cancelPress,
      consumeClick: () => {
        if (!longPressFired.current) return false
        longPressFired.current = false
        return true
      },
    }),
    [cancelPress, playFromSegment],
  )

  // Stop what the board started when it goes away.
  useEffect(
    () => () => {
      const eng = engineRef.current
      if (!eng) return
      try {
        const s = eng.getState()
        if (s.playing && s.key === trackKeyRef.current && (s.tag === PLAY_ALL_TAG || s.tag?.startsWith('block:'))) eng.stop()
      } catch {
        // ignore
      }
    },
    [],
  )

  // --- drag & drop -------------------------------------------------------------------
  const sensors = useSensors(useSensor(BoardPointerSensor, POINTER_OPTIONS), useSensor(KeyboardSensor, KEYBOARD_OPTIONS))
  const [activeSeg, setActiveSeg] = useState<number | null>(null)
  const [overPos, setOverPos] = useState<number | null>(null)
  const lastOver = useRef<number | null>(null)
  const lastSwapAt = useRef(0)
  const boundsRef = useRef<DOMRect | null>(null)
  const dragResultKey = useRef<string | null>(null)
  // Pointer drags: when it started and how far it ever travelled (tap detection).
  const dragGesture = useRef<{ pointer: boolean; at: number; travel: number }>({ pointer: false, at: 0, travel: 0 })

  const endDragChrome = useCallback(() => {
    document.documentElement.classList.remove('sb-grabbing')
  }, [])
  useEffect(() => endDragChrome, [endDragChrome])

  const onDragStart = useCallback(({ active, activatorEvent }: DragStartEvent) => {
    const seg = segOf(active.id)
    draggingRef.current = true
    cancelPress()
    dragGesture.current = { pointer: activatorEvent?.type === 'pointerdown', at: performance.now(), travel: 0 }
    setActiveSeg(seg)
    const pos = shownRef.current.indexOf(seg)
    setOverPos(pos)
    lastOver.current = pos
    boundsRef.current = gridRef.current?.getBoundingClientRect() ?? null
    // Settle any running reveal/FLIP animation so rects are measured correctly.
    gridRef.current?.getAnimations({ subtree: true }).forEach((a) => {
      if (!(a as { animationName?: string }).animationName) a.finish()
    })
    document.documentElement.classList.add('sb-grabbing')
    audio.sfx('pickup')
    vibrate(8)
  }, [audio, cancelPress])

  const onDragMove = useCallback(({ delta }: DragMoveEvent) => {
    const g = dragGesture.current
    const d = Math.hypot(delta.x, delta.y)
    if (d > g.travel) g.travel = d
  }, [])

  const onDragOver = useCallback(({ over }: DragOverEvent) => {
    if (!over) return
    const pos = shownRef.current.indexOf(segOf(over.id))
    if (pos === lastOver.current) return
    lastOver.current = pos
    setOverPos(pos)
    const now = performance.now()
    if (now - lastSwapAt.current >= SWAP_THROTTLE_MS) {
      lastSwapAt.current = now
      audio.sfx('swap')
    }
  }, [audio])

  const finishDrag = useCallback(() => {
    draggingRef.current = false
    setActiveSeg(null)
    setOverPos(null)
    lastOver.current = null
    endDragChrome()
  }, [endDragChrome])

  const onDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      finishDrag()
      const current = shownRef.current
      const from = current.indexOf(segOf(active.id))
      const to = over ? current.indexOf(segOf(over.id)) : -1
      const g = dragGesture.current
      // A finger that rolled past the activation distance and let go on the same slot
      // meant to tap: play the snippet (dnd-kit swallows the click after activating).
      if (g.pointer && from >= 0 && from === to && g.travel < TAP_SLOP_PX && performance.now() - g.at < TAP_MAX_MS) {
        tapSegment(segOf(active.id))
        return
      }
      audio.sfx('drop')
      vibrate(8)
      if (!over || lockedRef.current) return
      if (from < 0 || to < 0 || from === to) return
      const next = arrayMove(current, from, to)
      dragResultKey.current = next.join(',')
      setOptimistic({ base: safeOrderRef.current, order: next })
      onOrderChangeRef.current(next)
    },
    [audio, finishDrag, tapSegment],
  )
  // Locking mid-drag (time's up) cancels the drag. Both sensors listen for Escape on
  // the document (not window); non-bubbling, so no other Escape handler sees it.
  useEffect(() => {
    if (locked && activeSeg != null) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }))
    }
  }, [locked, activeSeg])

  const restrictToBoard = useMemo<Modifier>(
    () =>
      ({ transform, draggingNodeRect }) => {
        const b = boundsRef.current
        if (!b || !draggingNodeRect) return transform
        const m = 18
        const minX = b.left - m - draggingNodeRect.left
        const maxX = b.right + m - draggingNodeRect.right
        const minY = b.top - m - draggingNodeRect.top
        const maxY = b.bottom + m - draggingNodeRect.bottom
        return {
          ...transform,
          x: Math.min(maxX, Math.max(minX, transform.x)),
          y: Math.min(maxY, Math.max(minY, transform.y)),
        }
      },
    [],
  )
  const overlayModifiers = useMemo(() => [restrictToBoard], [restrictToBoard])

  // Announcements are read at event time (current language); the instructions are
  // rendered text, so the memo follows them.
  const instructions = t('board.announce.instructions')
  const accessibility = useMemo(() => {
    const at = (id: UniqueIdentifier, pos: UniqueIdentifier = id) => ({
      letter: lettersRef.current[segOf(id)] ?? '?',
      position: shownRef.current.indexOf(segOf(pos)) + 1,
      total: shownRef.current.length,
    })
    const announcements: Announcements = {
      onDragStart: ({ active }) => t('board.announce.dragStart', at(active.id)),
      onDragOver: ({ active, over }) =>
        over ? t('board.announce.dragOver', at(active.id, over.id)) : t('board.announce.dragOutside', at(active.id)),
      onDragEnd: ({ active, over }) =>
        over ? t('board.announce.drop', at(active.id, over.id)) : t('board.announce.dropOutside', at(active.id)),
      onDragCancel: ({ active }) => t('board.announce.cancel', at(active.id)),
    }
    const screenReaderInstructions: ScreenReaderInstructions = { draggable: instructions }
    return { announcements, screenReaderInstructions }
  }, [t, instructions])

  // --- programmatic reorder animation (FLIP) ------------------------------------------
  const flipEls = useRef(new Map<number, HTMLElement>())
  const registerFlip = useCallback((seg: number, el: HTMLElement | null) => {
    if (el) flipEls.current.set(seg, el)
    else flipEls.current.delete(seg)
  }, [])
  const prevPositions = useRef<{ round: unknown; key: string; map: Map<number, number> } | null>(null)
  useLayoutEffect(() => {
    const prev = prevPositions.current
    const order = shownKey ? shownKey.split(',').map(Number) : []
    // A new round (other track / segments) replaces the board: no slide from the old layout.
    const round = segments
    prevPositions.current = { round, key: `${trackKey}|${n}`, map: new Map(order.map((seg, pos) => [seg, pos])) }
    const fromDrag = dragResultKey.current === shownKey
    dragResultKey.current = null
    const lay = layoutRef.current
    if (!prev || !lay || fromDrag || prev.round !== round || prev.key !== `${trackKey}|${n}`) return
    const reduced = prefersReducedMotion()
    order.forEach((seg, pos) => {
      const was = prev.map.get(seg)
      const el = flipEls.current.get(seg)
      if (was == null || was === pos || !el) return
      const a = slotOffset(lay, was)
      const b = slotOffset(lay, pos)
      const dx = a.x - b.x
      const dy = a.y - b.y
      const holder = el.parentElement
      if (holder) holder.style.zIndex = String(2 + Math.round(Math.hypot(dx, dy) / 40))
      const anim = el.animate(
        reduced
          ? [{ opacity: 0.4 }, { opacity: 1 }]
          : [
              { transform: `translate(${dx}px, ${dy}px) scale(1)` },
              { transform: `translate(${dx * 0.45}px, ${dy * 0.45}px) scale(1.06)`, offset: 0.45 },
              { transform: 'translate(0px, 0px) scale(1)' },
            ],
        {
          duration: reduced ? 180 : 640,
          delay: reduced ? 0 : pos * 38,
          easing: reduced ? 'ease-out' : 'cubic-bezier(.3,.9,.25,1.08)',
          fill: 'backwards',
        },
      )
      const reset = () => {
        if (holder) holder.style.zIndex = ''
      }
      anim.onfinish = reset
      anim.oncancel = reset
    })
  }, [shownKey, segments, trackKey, n])

  // --- render ---------------------------------------------------------------------------
  const ids = useMemo(() => shown.map(idOf), [shown])
  const dragActive = activeSeg != null
  // Slot badges follow the live preview while dragging.
  const projected = useMemo(() => {
    if (activeSeg == null || overPos == null) return shown
    const from = shown.indexOf(activeSeg)
    return from < 0 ? shown : arrayMove(shown, from, overPos)
  }, [shown, activeSeg, overPos])
  const activeSegment = activeSeg != null ? segments[activeSeg] : undefined

  const gridStyle = layout
    ? {
        width: layout.width,
        height: layout.height,
        gap: layout.gap,
        gridTemplateColumns: `repeat(${layout.cols}, ${layout.w}px)`,
        gridAutoRows: `${layout.h}px`,
      }
    : undefined

  return (
    <div
      ref={rootRef}
      className={className ? `sb-board ${className}` : 'sb-board'}
      data-free={freeHeight || undefined}
      data-dragging={dragActive || undefined}
      data-locked={locked || undefined}
      style={freeHeight && layout ? { height: layout.height } : undefined}
    >
      {layout && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          autoScroll={false}
          accessibility={accessibility}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={finishDrag}
        >
          <SortableContext items={ids} strategy={rectSortingStrategy} disabled={locked}>
            <div ref={gridRef} className="sb-grid" style={gridStyle} role="group" aria-label={t('board.grid')}>
              {shown.map((seg, pos) => (
                <SortableSnippet
                  key={seg}
                  seg={seg}
                  position={pos}
                  slot={projected.indexOf(seg) + 1}
                  total={n}
                  trackKey={trackKey}
                  segment={segments[seg]}
                  hue={safeHues[seg]}
                  letter={letters[seg]}
                  chip={labels?.[pos] ?? null}
                  playing={playingSeg === seg}
                  progress={highlight && highlight.seg === seg ? highlight.progress : progressFns[seg]}
                  locked={locked}
                  mark={marks?.[pos] ?? null}
                  dragging={draggingRef}
                  onToggle={tapSegment}
                  onPlayFrom={playFromSegment}
                  press={press}
                  registerFlip={registerFlip}
                />
              ))}
            </div>
          </SortableContext>
          {typeof document !== 'undefined' &&
            createPortal(
              <DragOverlay className="sb-overlay" dropAnimation={dropAnimation} modifiers={overlayModifiers} zIndex={60}>
                {activeSeg != null && activeSegment ? (
                  <div className="sb-lift">
                    <SnippetBlock
                      trackKey={trackKey}
                      segment={activeSegment}
                      hue={safeHues[activeSeg]}
                      letter={letters[activeSeg]}
                      slot={(overPos ?? shown.indexOf(activeSeg)) + 1}
                      playing={playingSeg === activeSeg}
                      progress={progressFns[activeSeg]}
                      variant="lifted"
                    />
                  </div>
                ) : null}
              </DragOverlay>,
              document.body,
            )}
        </DndContext>
      )}
    </div>
  )
}
