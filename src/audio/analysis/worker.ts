// Module worker running the analysis pipeline off the main thread.

import { analyzeSync } from './pipeline'
import type { AnalyzeRequest, AnalyzeResponse } from './protocol'

interface WorkerScope {
  onmessage: ((e: MessageEvent<AnalyzeRequest>) => void) | null
  postMessage(message: AnalyzeResponse): void
}

const scope = self as unknown as WorkerScope

scope.onmessage = (e) => {
  const { id, samples, side, sampleRate, n } = e.data
  try {
    const { plan } = analyzeSync({ samples, side, sampleRate, n })
    scope.postMessage({ id, ok: true, plan })
  } catch (err) {
    scope.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
