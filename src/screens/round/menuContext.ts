// The round's exit menu, shared by RoundMenuProvider (GameMenu.tsx) and the views that open it.
import { createContext, useContext } from 'react'

export interface RoundMenuApi {
  open(): void
  /** The sheet is on screen (views pause their shortcuts). */
  isOpen: boolean
  isHost: boolean
}

export const RoundMenuContext = createContext<RoundMenuApi | null>(null)

/** The round's exit menu, or null when the screen offers none (labs, fixtures). */
export function useRoundMenu(): RoundMenuApi | null {
  return useContext(RoundMenuContext)
}
