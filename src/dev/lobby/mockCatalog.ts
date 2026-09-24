// Offline, deterministic playlist catalog for the lobby lab (real Deezer metadata snapshot).
import type { PlaylistRef } from '../../game/types'
import { DeezerError, isDeezerShortLink, parsePlaylistInput } from '../../lib/deezer'
import type { PlaylistCatalog } from '../../screens/lobby/catalog'
import { MOCK_FEATURED, MOCK_SEARCHES } from './mockData'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const ALL: PlaylistRef[] = [...MOCK_FEATURED, ...Object.values(MOCK_SEARCHES).flat()]

export function createMockCatalog(latencyMs = 450): PlaylistCatalog {
  return {
    async search(query) {
      await wait(latencyMs)
      const q = query.trim().toLowerCase()
      if (q === 'errore') throw new DeezerError('Deezer non risponde. Controlla la connessione e riprova.', 'timeout')
      if (MOCK_SEARCHES[q]) return MOCK_SEARCHES[q]
      const seen = new Set<number>()
      return ALL.filter((p) => p.title.toLowerCase().includes(q) && !seen.has(p.id) && seen.add(p.id)).slice(0, 24)
    },
    async featured() {
      await wait(latencyMs)
      return MOCK_FEATURED
    },
    async getPlaylist(id) {
      await wait(latencyMs)
      const p = ALL.find((x) => x.id === id)
      if (!p) throw new DeezerError('Playlist non trovata: controlla il link (le playlist private non sono accessibili).', 'not-found')
      return p
    },
    parseInput: parsePlaylistInput,
    isShortLink: isDeezerShortLink,
  }
}

/** Never resolves: freezes the picker in its loading state (skeleton screenshots). */
export const pendingCatalog: PlaylistCatalog = {
  search: () => new Promise(() => {}),
  featured: () => new Promise(() => {}),
  getPlaylist: () => new Promise(() => {}),
  parseInput: parsePlaylistInput,
  isShortLink: isDeezerShortLink,
}
