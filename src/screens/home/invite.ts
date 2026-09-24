// Small, dependency-light helpers of the Home screen (kept out of the
// component modules so React Fast Refresh keeps working).
import { isRoomCode } from '../../game/persist'

/** localStorage flag: "Come si gioca" was shown automatically once. */
export const ONBOARDED_KEY = 'unshuffle:onboarded'

/** Room code of an invite link (`#/r/CODE`), or null. Defaults to the current URL. */
export function inviteCodeFromHash(hash: string = typeof location === 'undefined' ? '' : location.hash): string | null {
  const match = /^#\/r\/([A-Za-z]+)(?:[/?#]|$)/.exec(hash)
  const code = match?.[1].toUpperCase() ?? null
  return code && isRoomCode(code) ? code : null
}

export function hasFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) != null
  } catch {
    return true // storage blocked: don't nag on every visit
  }
}

export function setFlag(key: string): void {
  try {
    localStorage.setItem(key, String(Date.now()))
  } catch {
    // Blocked storage: the overlay may show again next time, which is harmless.
  }
}
