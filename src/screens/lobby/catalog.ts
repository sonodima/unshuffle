// Playlist data source for the lobby picker, backed by the Deezer API.

import { isMessageKey, type Msg } from '../../i18n'
import type { PlaylistRef } from '../../game/types'
import { DeezerError, getFeaturedPlaylists, getPlaylist, isDeezerShortLink, parsePlaylistInput, searchPlaylists } from '../../lib/deezer'
import { featuredPlaylistIds } from '../../lib/playlistCategories'

export interface PlaylistCatalog {
  /** Text search. Rejects with a DeezerError (see catalogError). */
  search(query: string): Promise<PlaylistRef[]>
  /** Shelf shown while the search box is empty (the current language's featured list). */
  featured(): Promise<PlaylistRef[]>
  /** Metadata of one playlist (pasted links). */
  getPlaylist(id: number): Promise<PlaylistRef>
  /** Playlist id from a pasted link / bare id, else null. */
  parseInput(input: string): number | null
  /** Share short links (link.deezer.com…) that can't be resolved client-side. */
  isShortLink(input: string): boolean
}

const SEARCH_LIMIT = 24
const FEATURED_LIMIT = 20

// The featured shelf rarely changes: keep the first successful answer (per list
// of ids, i.e. per language) for the whole session so coming back to the lobby
// (Rigioca) renders instantly.
const featuredOnce = new Map<string, Promise<PlaylistRef[]>>()

export const deezerCatalog: PlaylistCatalog = {
  search: (query) => searchPlaylists(query, SEARCH_LIMIT),
  featured() {
    const ids = featuredPlaylistIds()
    const key = ids.join(',')
    let shelf = featuredOnce.get(key)
    if (!shelf) {
      shelf = getFeaturedPlaylists(FEATURED_LIMIT, ids).catch((err: unknown) => {
        featuredOnce.delete(key)
        throw err
      })
      featuredOnce.set(key, shelf)
    }
    return shelf
  },
  getPlaylist: (id) => getPlaylist(id),
  parseInput: (input) => parsePlaylistInput(input),
  isShortLink: (input) => isDeezerShortLink(input),
}

/** The message for any rejection coming out of a catalog (a DeezerError carries a game.deezer key). */
export function catalogError(err: unknown): Msg {
  if ((err instanceof DeezerError || (err instanceof Error && err.name === 'DeezerError')) && isMessageKey(err.message)) return err.message
  return 'game.deezer.api'
}
