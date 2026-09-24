// Injects the board's audio dependencies (see boardAudio.ts). Omit a prop to keep
// the app default: <BoardAudioProvider engine={mockEngine}>…</BoardAudioProvider>.
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import type { AudioEngine } from '../../audio/engine'
import { BoardAudioContext, defaultPeaks, defaultSfx, resolveEngine } from './boardAudio'
import type { BoardAudio, PeaksFn, SfxFn } from './boardAudio'

export interface BoardAudioProviderProps {
  /** Override the engine; `null` disables audio. Omit to use the app's audioEngine. */
  engine?: AudioEngine | null
  peaks?: PeaksFn
  sfx?: SfxFn
  children: ReactNode
}

export function BoardAudioProvider({ engine, peaks, sfx, children }: BoardAudioProviderProps) {
  const value = useMemo<BoardAudio>(() => {
    const hasEngine = engine !== undefined
    return {
      get engine() {
        return hasEngine ? (engine ?? null) : resolveEngine()
      },
      peaks: peaks ?? defaultPeaks,
      sfx: sfx ?? defaultSfx,
    }
  }, [engine, peaks, sfx])
  return <BoardAudioContext.Provider value={value}>{children}</BoardAudioContext.Provider>
}

