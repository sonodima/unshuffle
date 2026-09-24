// Curated entry points for the lobby playlist picker. The category chips and the
// featured shelf are per-language data in the catalog (lobby.chips, lobby.featured),
// so each language can list its own genres, searches and country tops.
// Every id and query was checked against the live Deezer API: each featured
// playlist has ≥ 40 tracks with a playable preview, and each chip query returns
// relevant, sizeable playlists as its first results.

import { td } from '../i18n'

/** A category chip (an entry of lobby.chips): a shortcut to a playlist search. */
export interface CategoryChip {
  /** UI label, in the chip's language. */
  label: string
  /** Deezer playlist search query. */
  query: string
  /** Optional emoji for the chip. */
  emoji?: string
}

/** The category chips of the current language. */
export function categoryChips(): readonly CategoryChip[] {
  return td('lobby.chips')
}

/**
 * Default featured shelf: curated, verified Deezer playlist ids in shelf order,
 * for a language whose lobby.featured is empty. Editorial playlists (Deezer
 * Charts / Deezer editors / label curators) whose ids have been stable for years.
 */
export const FEATURED_PLAYLIST_IDS: readonly number[] = [
  1116187241, // Top Italy — Deezer Charts
  3155776842, // Top Worldwide — Deezer Charts
  579513551, // Top Hits Italy (hit del momento) — Filtr Italy
  1363560485, // Deezer Hits
  4403076402, // TikTok Hits World
  248297032, // 00s Hits
  878989033, // 90s Hits
  867825522, // 80s Hits
  8282573142, // 10s Pop
  1470022445, // 70s Hits
  1306931615, // Rock Essentials
  12797956601, // Italo Hits: Best of Italia
  4562471864, // Musica Italiana — Best Of Italo Hits & Classics
  1931998962, // Cantautori Italiani
  822101931, // Pop Italiano
  1303152955, // Rap Italiano Game Over
  1977689462, // 00s Party Hits
  706093725, // Global Dance Hits
  1273315391, // Reggaeton Hits
  7624119742, // Disney Hits Italia
  754776991, // Film Classics
]

/** The featured shelf of the current language (lobby.featured), else the default one. */
export function featuredPlaylistIds(): readonly number[] {
  const ids = td('lobby.featured')
  return ids.length > 0 ? ids : FEATURED_PLAYLIST_IDS
}
