// Messages between the main thread and the analysis worker.

import type { CutPlan, CutStyle } from './types'

export interface AnalyzeRequest {
  id: number
  /** Mono samples (transferred). */
  samples: Float32Array
  /** Side channel (L − R) / 2 of a stereo preview (transferred), null for mono. */
  side: Float32Array | null
  sampleRate: number
  n: number
  style: CutStyle
}

export type AnalyzeResponse = { id: number; ok: true; plan: CutPlan } | { id: number; ok: false; error: string }
