// Invite helpers: join link, clipboard (with a fallback for non-secure
// origins such as a LAN IP during a party), native share sheet.

import { useCallback, useEffect, useRef, useState } from 'react'

/** Link that opens the game straight on this room's join form. */
export function buildJoinUrl(code: string): string {
  if (typeof location === 'undefined') return `#/r/${code}`
  return `${location.origin}${location.pathname}#/r/${code}`
}

/**
 * "https://host/path/#/r/CODE" → "host/path#/r/CODE" for display; long links
 * keep both ends ("host…#/r/CODE") so the room code stays visible.
 */
export function prettyUrl(url: string, max = 36): string {
  const { head, tail } = splitDisplayUrl(url)
  const s = head + tail
  if (s.length <= max) return s
  const cut = head.slice(0, Math.max(8, max - tail.length - 1))
  return `${cut}…${tail}`
}

/**
 * Display parts of a join link for CSS middle truncation: `head` may be cut
 * with an ellipsis, `tail` ("#/r/CODE") must always stay visible.
 * "https://host/path/#/r/CODE" → { head: "host/path", tail: "#/r/CODE" }.
 */
export function splitDisplayUrl(url: string): { head: string; tail: string } {
  const s = url.replace(/^https?:\/\//, '').replace(/\/(#|$)/, '$1')
  const tail = s.match(/#\/r\/\w+$/)?.[0] ?? (s.length > 12 ? s.slice(-12) : '')
  return { head: s.slice(0, s.length - tail.length), tail }
}

function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined') return false
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none'
  const active = document.activeElement as HTMLElement | null
  document.body.appendChild(ta)
  ta.select()
  ta.setSelectionRange(0, text.length)
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  ta.remove()
  active?.focus?.({ preventScroll: true })
  return ok
}

/** Copies text; resolves false when the browser refuses. Never rejects. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Permission denied / document not focused: try the legacy path.
  }
  return legacyCopy(text)
}

export function canNativeShare(url: string): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false
  try {
    return navigator.canShare ? navigator.canShare({ url }) : true
  } catch {
    return false
  }
}

type ShareResult = 'shared' | 'cancelled' | 'failed'

export async function nativeShare(code: string, url: string): Promise<ShareResult> {
  try {
    await navigator.share({
      title: 'UNSHUFFLE',
      text: `Sfidami a UNSHUFFLE! Entra nella stanza ${code}:`,
      url,
    })
    return 'shared'
  } catch (err) {
    return err instanceof DOMException && err.name === 'AbortError' ? 'cancelled' : 'failed'
  }
}

type CopyState = 'idle' | 'copied' | 'failed'

/** Copy with a transient "copied" / "failed" flag (resets after `ms`). */
export function useCopy(ms = 2000) {
  const [state, setState] = useState<CopyState>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])
  const copy = useCallback(
    async (text: string) => {
      const ok = await copyText(text)
      if (timer.current) clearTimeout(timer.current)
      setState(ok ? 'copied' : 'failed')
      timer.current = setTimeout(() => setState('idle'), ms)
      return ok
    },
    [ms],
  )
  return { state, copy }
}
