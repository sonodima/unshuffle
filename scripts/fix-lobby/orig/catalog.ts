// Playlist data source for the lobby picker. The default goes to Deezer; the
// picker takes any implementation (lab mocks, tests) through the `catalog` prop.

import type { PlaylistRef } from '../../game/types'
import { DeezerError, getFeaturedPlaylists, getPlaylist, isDeezerShortLink, parsePlaylistInput, searchPlaylists } from '../../lib/deezer'

export interface PlaylistCatalog {
  /** Text search. Rejects with an Error whose `message` is Italian and user-facing. */
  search(query: string): Promise<PlaylistRef[]>
  /** Shelf shown while the search box is empty. */
  featured(): Promise<PlaylistRef[]>
  /** Metadata of one playlist (pasted links). */
  getPlaylist(id: number): Promise<PlaylistRef>
  /** Playlist id from a pasted link / bare id, else null. */
  parseInput(input: string): number | null
  /** Share short links (link.deezer.com…) that can't be resolved client-side. */
  isShortLink(input: string): boolean
}

export const SEARCH_LIMIT = 24
export const FEATURED_LIMIT = 20

// The featured shelf rarely changes: keep the first successful answer for the
// whole session so coming back to the lobby (Rigioca) renders instantly.
let featuredOnce: Promise<PlaylistRef[]> | null = null

export const deezerCatalog: PlaylistCatalog = {
  search: (query) => searchPlaylists(query, SEARCH_LIMIT),
  featured() {
    if (!featuredOnce) {
      featuredOnce = getFeaturedPlaylists(FEATURED_LIMIT).catch((err: unknown) => {
        featuredOnce = null
        throw err
      })
    }
    return featuredOnce
  },
  getPlaylist: (id) => getPlaylist(id),
  parseInput: (input) => parsePlaylistInput(input),
  isShortLink: (input) => isDeezerShortLink(input),
}

/** Italian message for any rejection coming out of a catalog (DeezerError messages are user-facing). */
export function catalogErrorMessage(err: unknown): string {
  if ((err instanceof DeezerError || (err instanceof Error && err.name === 'DeezerError')) && err.message) return err.message
  return 'Qualcosa è andato storto con Deezer. Riprova tra poco.'
}
