// Compressed-audio prefetch for rounds beyond the decode window (see store.ts).
// A decoded 30 s preview is ~11 MB of PCM, its MP3 only ~0.5 MB. The store decodes
// just the current and the next round, but downloads every later preview early —
// Deezer's signed preview URLs expire ~15 minutes after the playlist was fetched and a
// flaky phone network is better used before it is needed. The bytes are kept as a Blob
// URL, which the audio engine fetches like any other URL (falling back to a fresh
// Deezer URL on its own if anything goes wrong).

/** Give up on a background download after this long (the decode path will try again later). */
const BYTES_TIMEOUT_MS = 20_000

export interface PreviewBytes {
  /** Blob URL of the downloaded preview once it is here; null if the download failed. */
  readonly ready: Promise<string | null>
  /** Cancel the download / free the Blob. Safe to call more than once. */
  release(): void
}

/** Byte prefetch needs a browser (fetch + Blob URLs). Elsewhere (tests, SSR) it is skipped. */
export function canPrefetchBytes(): boolean {
  return (
    typeof document !== 'undefined' &&
    typeof fetch === 'function' &&
    typeof Blob === 'function' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function'
  )
}

/** Download `url` in the background and keep it as a Blob URL. Never rejects. */
export function prefetchPreviewBytes(url: string, timeoutMs = BYTES_TIMEOUT_MS): PreviewBytes {
  let objectUrl: string | null = null
  let released = false
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null
  const ready = (async (): Promise<string | null> => {
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null
    try {
      const res = await fetch(url, { mode: 'cors', credentials: 'omit', signal: ctrl?.signal })
      if (!res.ok) return null
      const blob = await res.blob()
      if (released || blob.size === 0) return null
      objectUrl = URL.createObjectURL(blob)
      return objectUrl
    } catch {
      return null
    } finally {
      if (timer) clearTimeout(timer)
    }
  })()
  return {
    ready,
    release() {
      released = true
      try {
        ctrl?.abort()
      } catch {
        // already settled
      }
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl)
        } catch {
          // ignore
        }
        objectUrl = null
      }
    },
  }
}
