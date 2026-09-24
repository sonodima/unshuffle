// Curated entry points for the lobby playlist picker.
// Every id and query below was checked against the live Deezer API
// (see scripts/deezer/verify_ids.py): each featured playlist has ≥ 40 tracks
// with a playable preview, and each chip query returns relevant, sizeable
// playlists as its first results.

export interface CategoryChip {
  /** Italian UI label. */
  label: string
  /** Deezer playlist search query. */
  query: string
  /** Optional emoji for the chip. */
  emoji?: string
}

export const CATEGORY_CHIPS: CategoryChip[] = [
  { label: 'Hit del momento', query: 'hit del momento', emoji: '🔥' },
  { label: 'Hit 2000', query: '00s hits', emoji: '💿' },
  { label: 'Anni 90', query: '90s hits', emoji: '📼' },
  { label: 'Anni 80', query: '80s hits', emoji: '🕺' },
  { label: 'Anni 70', query: '70s hits', emoji: '🪩' },
  { label: 'Rap italiano', query: 'rap italiano', emoji: '🎤' },
  { label: 'Pop italiano', query: 'pop italiano', emoji: '🇮🇹' },
  { label: 'Cantautori', query: 'cantautori italiani', emoji: '✍️' },
  { label: 'Sanremo', query: 'sanremo', emoji: '🌺' },
  { label: 'Tormentoni', query: 'tormentoni estivi', emoji: '🏖️' },
  { label: 'Rock classics', query: 'rock classics', emoji: '🎸' },
  { label: 'Dance / EDM', query: 'dance hits', emoji: '🎧' },
  { label: 'Indie', query: 'indie italiano', emoji: '🌙' },
  { label: 'Reggaeton', query: 'reggaeton', emoji: '💃' },
  { label: 'Party', query: 'party hits', emoji: '🎉' },
  { label: 'Disney', query: 'disney hits', emoji: '🏰' },
  { label: 'Colonne sonore', query: 'film soundtrack', emoji: '🎬' },
]

/**
 * Curated, verified Deezer playlist ids shown in the featured shelf, in shelf
 * order. Editorial playlists (Deezer Charts / Deezer editors / label
 * curators) whose ids have been stable for years.
 */
export const FEATURED_PLAYLIST_IDS: number[] = [
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
