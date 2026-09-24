import { sfx, type SfxName } from '../../audio/sfx'

export type { SfxName }

/** Plays a UI sound if the sfx module is available; never throws. */
export function playSfx(name: SfxName, opts?: { pitch?: number; gain?: number }): void {
  try {
    sfx?.play(name, opts)
  } catch {
    // Audio is optional: a missing or locked AudioContext must never break the UI.
  }
}
