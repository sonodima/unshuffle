// Play-all: the snippets in the CURRENT order back-to-back. The engine asks for
// each position just in time, so reordering during playback changes what comes next.
import { useCallback, useLayoutEffect, useRef } from 'react'
import type { Segment } from '../../game/types'
import { PLAY_ALL_TAG, recordScheduled, resetScheduled, useAudioBuffer, useBoardAudio, useEngineState } from './boardAudio'

interface PlayAllControls {
  /** Play-all of this track is running. */
  playing: boolean
  /** Audible position (0-based) while playing, else -1. */
  position: number
  /** The track's audio buffer is decoded. */
  ready: boolean
  toggle: () => void
  play: (fromPosition?: number) => void
  stop: () => void
}

export function usePlayAll(trackKey: string, segments: Segment[], order: number[]): PlayAllControls {
  const { engine, sfx } = useBoardAudio()
  const state = useEngineState()
  const ready = useAudioBuffer(trackKey) !== undefined
  const segmentsRef = useRef(segments)
  const orderRef = useRef(order)
  const keyRef = useRef(trackKey)
  const engineRef = useRef(engine)
  useLayoutEffect(() => {
    segmentsRef.current = segments
    orderRef.current = order
    keyRef.current = trackKey
    engineRef.current = engine
  })

  const playing = state.playing && state.key === trackKey && state.tag === PLAY_ALL_TAG && state.mode === 'sequence'
  const position = playing ? state.index : -1

  const play = useCallback(
    (fromPosition = 0) => {
      const eng = engineRef.current
      if (!eng) return
      const key = keyRef.current
      try {
        void eng.unlock().catch(() => {})
        resetScheduled(key)
        eng.playSequence(
          key,
          (pos) => {
            const seg = orderRef.current[pos]
            const s = seg == null ? undefined : segmentsRef.current[seg]
            if (!s) return null
            recordScheduled(key, pos, seg)
            return { start: s.start, end: s.end }
          },
          { tag: PLAY_ALL_TAG, fromPosition: Math.max(0, Math.min(fromPosition, orderRef.current.length - 1)) },
        )
      } catch {
        // Audio unavailable.
      }
    },
    [],
  )

  const stop = useCallback(() => {
    const eng = engineRef.current
    if (!eng) return
    try {
      const s = eng.getState()
      if (s.playing && s.key === keyRef.current && s.tag === PLAY_ALL_TAG) eng.stop()
    } catch {
      // ignore
    }
  }, [])

  const playingRef = useRef(playing)
  useLayoutEffect(() => {
    playingRef.current = playing
  })
  const toggle = useCallback(() => {
    sfx('click')
    if (playingRef.current) stop()
    else play(0)
  }, [play, stop, sfx])

  return { playing, position, ready, toggle, play, stop }
}
