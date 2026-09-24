// Result types of the analysis (CutPlan is re-exported by ./index.ts).

export interface CutSegment {
  start: number
  end: number
  beats: number
}

export type CutMethod = 'beat-grid' | 'onset' | 'uniform'

export interface CutPlan {
  /** Estimated tempo (BPM), 0 if no reliable beat. */
  bpm: number
  /** 0..1 confidence of the beat grid. */
  confidence: number
  /** Beat times (s). */
  beats: number[]
  /** Estimated bar starts (s). */
  downbeats: number[]
  /** Exactly `n` contiguous segments in correct order. */
  segments: CutSegment[]
  /** Region of the preview considered musically usable (fade in/out trimmed). */
  usableStart: number
  usableEnd: number
  /** Which strategy produced the cuts. */
  method: CutMethod
}
