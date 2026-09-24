// Deezer public API client — NO api key, NO server.
// api.deezer.com does not send CORS headers, so every call goes through JSONP
// (`output=jsonp&callback=...`). Audio previews (cdnt-preview.dzcdn.net) and
// covers (cdn-images.dzcdn.net) DO send `Access-Control-Allow-Origin: *`, so
// they can be fetched / decoded / drawn to canvas normally.

import type { PlaylistRef, TrackInfo } from '../game/types'
import { FEATURED_PLAYLIST_IDS } from './playlistCategories'

// ─── Errors ──────────────────────────────────────────────────────────────────

type DeezerErrorKind =
  /** No answer within the timeout. */
  | 'timeout'
  /** The script request failed (offline, DNS, blocked by an ad blocker…). */
  | 'network'
  /** The response was not valid JSONP. */
  | 'invalid'
  /** Deezer quota exceeded (50 requests / 5 s per IP). */
  | 'quota'
  /** Deezer is temporarily overloaded. */
  | 'busy'
  /** The playlist / track does not exist (or is private). */
  | 'not-found'
  /** Not accessible (private, geo-blocked, needs a logged-in account). */
  | 'forbidden'
  /** Malformed request parameters. */
  | 'bad-request'
  /** The track exists but has no playable preview. */
  | 'no-preview'
  /** Any other API error payload. */
  | 'api'

/** Every failure of this module. `message` is Italian and safe to show to users. */
export class DeezerError extends Error {
  readonly kind: DeezerErrorKind
  /** Deezer API error code, when the error came from an `{error}` payload. */
  readonly code: number | undefined

  constructor(message: string, kind: DeezerErrorKind = 'api', code?: number) {
    super(message)
    this.name = 'DeezerError'
    this.kind = kind
    this.code = code
  }
}

const MSG = {
  timeout: 'Deezer non risponde. Controlla la connessione e riprova.',
  network: 'Impossibile contattare Deezer. Controlla la connessione (o eventuali ad blocker) e riprova.',
  invalid: 'Risposta inattesa da Deezer. Riprova tra poco.',
  quota: 'Troppe richieste a Deezer in poco tempo. Aspetta qualche secondo e riprova.',
  busy: 'Deezer è momentaneamente sovraccarico. Riprova tra poco.',
  notFound: 'Contenuto non trovato su Deezer.',
  forbidden: 'Contenuto non accessibile: potrebbe essere privato o non disponibile nel tuo paese.',
  badRequest: 'Richiesta non valida per Deezer.',
  api: 'Errore di Deezer. Riprova tra poco.',
  playlistNotFound: 'Playlist non trovata: controlla il link (le playlist private non sono accessibili).',
  noPreview: 'Anteprima non disponibile per questo brano.',
  trackNotFound: 'Brano non più disponibile su Deezer.',
  featured: 'Impossibile caricare le playlist in evidenza.',
} as const

function apiError(code: number | undefined): DeezerError {
  switch (code) {
    case 4:
      return new DeezerError(MSG.quota, 'quota', code)
    case 700:
      return new DeezerError(MSG.busy, 'busy', code)
    case 800:
      return new DeezerError(MSG.notFound, 'not-found', code)
    case 200:
    case 300:
    case 901:
      return new DeezerError(MSG.forbidden, 'forbidden', code)
    case 500:
    case 501:
    case 600:
      return new DeezerError(MSG.badRequest, 'bad-request', code)
    default:
      return new DeezerError(MSG.api, 'api', code)
  }
}

// ─── Raw API shapes (only the fields we read) ────────────────────────────────

interface DzUser {
  name?: string
}

interface DzPlaylist {
  id: number
  title?: string
  picture_medium?: string
  picture_big?: string
  picture_xl?: string
  nb_tracks?: number
  /** Present in search / chart results. */
  user?: DzUser
  /** Present in /playlist/{id}. */
  creator?: DzUser
  type?: string
}

interface DzTrack {
  id: number
  type?: string
  readable?: boolean
  title?: string
  title_short?: string
  link?: string
  duration?: number
  rank?: number
  preview?: string
  artist?: { name?: string }
  album?: { title?: string; cover_medium?: string; cover_big?: string; cover_xl?: string }
}

interface DzList<T> {
  data?: T[]
  total?: number
  next?: string
}

// ─── Transport: JSONP + rate limit + cache ───────────────────────────────────

const API_ORIGIN = 'https://api.deezer.com'
const DEFAULT_TIMEOUT_MS = 10_000
const CACHE_TTL_MS = 5 * 60_000
const CACHE_MAX_ENTRIES = 300
/** Late JSONP responses hit a no-op for this long before the global is deleted. */
const LATE_CALLBACK_GRACE_MS = 60_000
const RETRY_DELAY_MS = 1200
/** Stay safely under Deezer's 50 requests / 5 s per IP. */
const RATE_WINDOW_MS = 5000
const RATE_MAX = 40

const noop = (): void => {}
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

let callbackSeq = 0

function jsonp(url: string, timeoutMs: number): Promise<unknown> {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return Promise.reject(new DeezerError(MSG.network, 'network'))
  }
  return new Promise((resolve, reject) => {
    const name = `__dz_${++callbackSeq}_${Math.random().toString(36).slice(2, 8)}`
    const slots = window as unknown as Record<string, unknown>
    const script = document.createElement('script')
    let settled = false

    const finish = (settle: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      script.onload = null
      script.onerror = null
      script.remove()
      slots[name] = noop
      setTimeout(() => {
        delete slots[name]
      }, LATE_CALLBACK_GRACE_MS)
      settle()
    }

    const timer = setTimeout(() => finish(() => reject(new DeezerError(MSG.timeout, 'timeout'))), timeoutMs)
    slots[name] = (data: unknown) => finish(() => resolve(data))
    script.onerror = () => finish(() => reject(new DeezerError(MSG.network, 'network')))
    // JSONP runs the callback before `load` fires: a load without callback means garbage.
    script.onload = () => finish(() => reject(new DeezerError(MSG.invalid, 'invalid')))
    script.async = true
    script.src = `${url}${url.includes('?') ? '&' : '?'}output=jsonp&callback=${name}`
    document.head.appendChild(script)
  })
}

const sentAt: number[] = []
let rateGate: Promise<void> = Promise.resolve()

/** Sliding-window limiter shared by every request. */
function acquireSlot(): Promise<void> {
  const slot = rateGate.then(async () => {
    for (;;) {
      const now = Date.now()
      while (sentAt.length > 0 && now - sentAt[0] >= RATE_WINDOW_MS) sentAt.shift()
      if (sentAt.length < RATE_MAX) {
        sentAt.push(now)
        return
      }
      await sleep(RATE_WINDOW_MS - (now - sentAt[0]) + 25)
    }
  })
  rateGate = slot.catch(noop)
  return slot
}

function unwrap<T>(data: unknown): T {
  if (data === null || typeof data !== 'object') throw new DeezerError(MSG.invalid, 'invalid')
  if ('error' in data) {
    const err = (data as { error?: { code?: unknown } }).error
    throw apiError(typeof err?.code === 'number' ? err.code : undefined)
  }
  return data as T
}

async function fetchOnce<T>(url: string, timeoutMs: number): Promise<T> {
  await acquireSlot()
  return unwrap<T>(await jsonp(url, timeoutMs))
}

async function fetchWithRetry<T>(url: string, timeoutMs: number): Promise<T> {
  try {
    return await fetchOnce<T>(url, timeoutMs)
  } catch (err) {
    if (err instanceof DeezerError && (err.kind === 'quota' || err.kind === 'busy')) {
      await sleep(RETRY_DELAY_MS)
      return fetchOnce<T>(url, timeoutMs)
    }
    throw err
  }
}

function buildUrl(path: string, params?: Record<string, string | number>): string {
  const qs = new URLSearchParams()
  if (params) for (const [k, v] of Object.entries(params)) qs.set(k, String(v))
  const query = qs.toString()
  return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}${query ? `?${query}` : ''}`
}

interface CacheEntry {
  expires: number
  promise: Promise<unknown>
}
const cache = new Map<string, CacheEntry>()

function pruneCache(now: number): void {
  if (cache.size <= CACHE_MAX_ENTRIES) return
  for (const [key, entry] of cache) if (entry.expires <= now) cache.delete(key)
  // Still too big: drop the oldest insertions.
  for (const key of cache.keys()) {
    if (cache.size <= CACHE_MAX_ENTRIES) break
    cache.delete(key)
  }
}

function request<T>(path: string, params: Record<string, string | number> | undefined, timeoutMs: number, cached: boolean): Promise<T> {
  const url = buildUrl(path, params)
  if (!cached) return fetchWithRetry<T>(url, timeoutMs)
  const now = Date.now()
  const hit = cache.get(url)
  if (hit && hit.expires > now) return hit.promise as Promise<T>
  const promise = fetchWithRetry<T>(url, timeoutMs)
  const entry: CacheEntry = { expires: now + CACHE_TTL_MS, promise }
  cache.set(url, entry)
  // Never cache failures (the same in-flight promise is still shared meanwhile).
  promise.catch(() => {
    if (cache.get(url) === entry) cache.delete(url)
  })
  pruneCache(now)
  return promise
}

/**
 * Low-level JSONP GET. `path` like "/search/playlist", params appended as query.
 * Successful responses are cached in memory for 5 minutes (identical concurrent
 * calls share one request). Rejects with DeezerError on API error payloads,
 * script errors and timeouts; quota errors are retried once after 1.2 s.
 */
function dzGet<T>(path: string, params?: Record<string, string | number>, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<T> {
  return request<T>(path, params, timeoutMs, true)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

function withPlaylistMessage(err: unknown): unknown {
  if (err instanceof DeezerError && (err.kind === 'not-found' || err.kind === 'forbidden')) {
    return new DeezerError(MSG.playlistNotFound, err.kind, err.code)
  }
  return err
}

function toPlaylistRef(p: DzPlaylist): PlaylistRef {
  const ref: PlaylistRef = {
    id: p.id,
    title: p.title?.trim() || 'Playlist senza titolo',
    picture: p.picture_big || p.picture_medium || p.picture_xl || '',
    nbTracks: p.nb_tracks ?? 0,
  }
  const creator = (p.user?.name || p.creator?.name)?.trim()
  if (creator) ref.creator = creator
  return ref
}

function isPlayable(t: DzTrack): boolean {
  return (
    typeof t?.id === 'number' &&
    (t.type === undefined || t.type === 'track') &&
    t.readable !== false &&
    typeof t.preview === 'string' &&
    t.preview.length > 0
  )
}

function toTrackInfo(t: DzTrack): TrackInfo {
  const album = t.album ?? {}
  const cover = album.cover_xl || album.cover_big || album.cover_medium || ''
  return {
    id: t.id,
    title: (t.title_short || t.title || '').trim() || 'Senza titolo',
    artist: t.artist?.name?.trim() || 'Artista sconosciuto',
    album: album.title?.trim() || '',
    cover,
    coverSmall: album.cover_medium || cover,
    preview: t.preview ?? '',
    link: t.link || `https://www.deezer.com/track/${t.id}`,
    rank: t.rank ?? 0,
    durationSec: t.duration ?? 0,
  }
}

// Qualifiers that make two entries the same song for the game's purposes.
const QUALIFIER =
  /\b(remaster(ed)?|rimasterizzat[oa]|feat|ft|featuring|with|con|live|dal vivo|version|versione|edit|radio|remix|mix|mono|stereo|deluxe|bonus|anniversary|acoustic|acustic[ao]|unplugged|demo|single|album|original|explicit|clean|from|tratto|soundtrack|re-?recorded|sped up|slowed|extended)\b/i

function foldText(s: string): string {
  return s.normalize('NFKD').replace(/\p{M}+/gu, '').normalize('NFC').toLowerCase()
}

/** Title reduced to its identity: "Song (Remastered 2011) [feat. X]" → "song". */
export function normalizeTitle(title: string): string {
  let t = foldText(title)
  t = t.replace(/[([{]([^)\]}]*)[)\]}]/g, (m, inner: string) => (QUALIFIER.test(inner) ? ' ' : m))
  t = t.replace(/\s[-–—]\s(.*)$/, (m, tail: string) => (QUALIFIER.test(tail) ? ' ' : m))
  t = t.replace(/\s(feat\.?|ft\.|featuring)\s.*$/, ' ')
  const compact = t.replace(/[^\p{L}\p{N}]+/gu, '')
  return compact || foldText(title).trim()
}

function normalizeArtist(artist: string): string {
  const main = foldText(artist).split(/\s(?:feat\.?|ft\.|featuring)\s/)[0]
  return main.replace(/[^\p{L}\p{N}]+/gu, '') || foldText(artist).trim()
}

/** Identity of a song across remasters / live / feat. variants: "artist|title". */
export function songKey(track: Pick<TrackInfo, 'artist' | 'title'>): string {
  return `${normalizeArtist(track.artist)}|${normalizeTitle(track.title)}`
}

/** Dedupes by id, then by songKey (keeping the most popular variant, in first-seen order). */
function dedupeTracks(tracks: readonly TrackInfo[]): TrackInfo[] {
  const ids = new Set<number>()
  const byKey = new Map<string, number>()
  const out: TrackInfo[] = []
  for (const t of tracks) {
    if (ids.has(t.id)) continue
    ids.add(t.id)
    const key = songKey(t)
    const at = byKey.get(key)
    if (at === undefined) {
      byKey.set(key, out.length)
      out.push(t)
    } else if (t.rank > out[at].rank) {
      out[at] = t
    }
  }
  return out
}

function uniqueById<T extends { id: number }>(items: readonly T[]): T[] {
  const seen = new Set<number>()
  return items.filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)))
}

// ─── Playlists ───────────────────────────────────────────────────────────────

const MIN_PLAYLIST_TRACKS = 10
/** Chart playlists that make poor game material (instrumental / ambient moods). */
const CALM_PLAYLIST = /piano|relax|medita|yoga|sleep|dorm|study|lofi|lo-fi|calm|ambient|focus|zen|spa\b|chill|classical|classica|jazz|lounge|acoustic|acustic|noise|natur/i

/** Search public playlists by text. Drops tiny playlists (< 10 tracks). Empty query → []. */
export async function searchPlaylists(query: string, limit = 24): Promise<PlaylistRef[]> {
  const q = query.trim().replace(/\s+/g, ' ')
  if (!q || limit <= 0) return []
  const fetchCount = Math.min(100, Math.max(10, Math.ceil(limit * 1.5)))
  const res = await dzGet<DzList<DzPlaylist>>('/search/playlist', { q, limit: fetchCount })
  const valid = (res.data ?? []).filter((p) => typeof p?.id === 'number' && (p.nb_tracks ?? 0) >= MIN_PLAYLIST_TRACKS)
  return uniqueById(valid)
    .map(toPlaylistRef)
    .slice(0, limit)
}

/** Single playlist metadata. Rejects with DeezerError (kind 'not-found' for unknown / private ids). */
export async function getPlaylist(id: number): Promise<PlaylistRef> {
  if (!Number.isSafeInteger(id) || id <= 0) throw new DeezerError(MSG.playlistNotFound, 'not-found')
  try {
    // limit=1 keeps the embedded track list tiny (~3 KB instead of ~150 KB).
    const p = await dzGet<DzPlaylist>(`/playlist/${id}`, { limit: 1 })
    if (typeof p.id !== 'number') throw new DeezerError(MSG.playlistNotFound, 'not-found')
    return toPlaylistRef(p)
  } catch (err) {
    throw withPlaylistMessage(err)
  }
}

/**
 * Featured playlists for the picker's "Top" shelf: the curated
 * FEATURED_PLAYLIST_IDS (in order) followed by Deezer's chart playlists for
 * the visitor's country, deduped, minus ambient/instrumental moods.
 * Individual failures are skipped; rejects only if nothing could be loaded.
 */
export async function getFeaturedPlaylists(limit = 24): Promise<PlaylistRef[]> {
  if (limit <= 0) return []
  let firstError: unknown = null
  const [featured, chart] = await Promise.all([
    mapLimit(FEATURED_PLAYLIST_IDS.slice(0, limit), 4, (id) =>
      getPlaylist(id).catch((err: unknown) => {
        firstError ??= err
        return null
      }),
    ),
    dzGet<DzList<DzPlaylist>>('/chart/0/playlists', { limit: 50 })
      .then((r) => r.data ?? [])
      .catch((err: unknown) => {
        firstError ??= err
        return [] as DzPlaylist[]
      }),
  ])
  const curated = featured.filter((p): p is PlaylistRef => p !== null)
  const extra = chart
    .filter((p) => typeof p?.id === 'number' && (p.nb_tracks ?? 0) >= 20 && !CALM_PLAYLIST.test(p.title ?? ''))
    .map(toPlaylistRef)
  const merged = uniqueById([...curated, ...extra]).slice(0, limit)
  if (merged.length === 0 && firstError) {
    throw firstError instanceof DeezerError ? firstError : new DeezerError(MSG.featured, 'network')
  }
  return merged
}

const DEEZER_HOST = /(^|\.)deezer\.com$/i
const SHORT_LINK = /(^|[/.@\s])(link\.deezer\.com|deezer\.page\.link|dzr\.page\.link)(\/|$)/i

/**
 * Extract a playlist id from a pasted deezer.com URL (any locale prefix, query
 * string, widget embed, deezer:// deep link) or a bare numeric id.
 * Returns null otherwise — including link.deezer.com / deezer.page.link short
 * links, which cannot be resolved without a server (see isDeezerShortLink).
 */
export function parsePlaylistInput(input: string): number | null {
  const s = input.trim()
  if (!s) return null
  const asId = (digits: string | undefined): number | null => {
    if (!digits) return null
    const n = Number(digits)
    return Number.isSafeInteger(n) && n > 0 ? n : null
  }
  if (/^\d{1,16}$/.test(s)) return asId(s)
  if (isDeezerShortLink(s)) return null

  const deep = /^deezer:\/\/(?:www\.deezer\.com\/)?(?:[a-z]{2}(?:-[a-z]{2})?\/)?playlist\/(\d+)/i.exec(s)
  if (deep) return asId(deep[1])

  // The first URL-looking token (people paste "Ascolta X su Deezer: https://…").
  const token = /(?<![\w.-])(?:https?:\/\/)?(?:[\w-]+\.)*deezer\.com\/\S*/i.exec(s)?.[0]
  if (!token) return null
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(token) ? token : `https://${token}`)
  } catch {
    return null
  }
  if (!DEEZER_HOST.test(url.hostname)) return null
  const m = /\/playlist\/(\d+)(?:[/?#]|$)/i.exec(url.pathname + (url.pathname.endsWith('/') ? '' : '/'))
  return asId(m?.[1])
}

/** True for share short links (link.deezer.com, deezer.page.link) the UI must ask to expand. */
export function isDeezerShortLink(input: string): boolean {
  return SHORT_LINK.test(input.trim())
}

// ─── Tracks ──────────────────────────────────────────────────────────────────

const TRACKS_PAGE = 100

/**
 * All playable tracks of a playlist (preview available + readable), deduped by
 * id and by artist|title (remaster / live / feat. variants). Scans up to `max`
 * playlist entries. Resolves [] for a playlist without playable tracks; rejects
 * with DeezerError if the playlist can't be read at all.
 */
export async function getPlaylistTracks(id: number, max = 300): Promise<TrackInfo[]> {
  if (!Number.isSafeInteger(id) || id <= 0) throw new DeezerError(MSG.playlistNotFound, 'not-found')
  const scan = Math.max(1, Math.floor(max))
  const page = (index: number) =>
    dzGet<DzList<DzTrack>>(`/playlist/${id}/tracks`, { limit: Math.min(TRACKS_PAGE, scan - index), index })

  let first: DzList<DzTrack>
  try {
    first = await page(0)
  } catch (err) {
    throw withPlaylistMessage(err)
  }
  const raw: DzTrack[] = [...(first.data ?? [])]

  if (typeof first.total === 'number') {
    const indices: number[] = []
    for (let i = TRACKS_PAGE; i < Math.min(first.total, scan); i += TRACKS_PAGE) indices.push(i)
    // Later pages are best effort: a partial playlist is still playable.
    const pages = await mapLimit(indices, 3, (index) => page(index).then((r) => r.data ?? [], () => [] as DzTrack[]))
    for (const p of pages) raw.push(...p)
  } else {
    let next = first.next
    while (next && raw.length < scan && (first.data?.length ?? 0) > 0) {
      const r = await page(raw.length).catch(() => null)
      if (!r?.data?.length) break
      raw.push(...r.data)
      next = r.next
    }
  }

  return dedupeTracks(raw.slice(0, scan).filter(isPlayable).map(toTrackInfo))
}

/** One track by id (cached unless `fresh`). Rejects with 'not-found' / 'no-preview' if it can't be played. */
async function getTrack(trackId: number, fresh = false): Promise<TrackInfo> {
  if (!Number.isSafeInteger(trackId) || trackId <= 0) throw new DeezerError(MSG.trackNotFound, 'not-found')
  const path = `/track/${trackId}`
  let t: DzTrack
  try {
    t = fresh ? await request<DzTrack>(path, undefined, DEFAULT_TIMEOUT_MS, false) : await dzGet<DzTrack>(path)
  } catch (err) {
    if (err instanceof DeezerError && err.kind === 'not-found') throw new DeezerError(MSG.trackNotFound, 'not-found', err.code)
    throw err
  }
  if (!isPlayable(t)) throw new DeezerError(MSG.noPreview, 'no-preview')
  return toTrackInfo(t)
}

/** Re-fetch a track to get a fresh signed preview URL (previews expire after ~15 min). Never cached. */
export async function refreshPreview(trackId: number): Promise<string> {
  return (await getTrack(trackId, true)).preview
}

/** Expiry (ms epoch) encoded in a signed preview URL (`hdnea=exp=…`), or null if unknown. */
export function previewExpiresAt(previewUrl: string): number | null {
  const m = /[?&~]hdnea=exp=(\d+)/.exec(previewUrl) ?? /exp=(\d{9,})/.exec(previewUrl)
  return m ? Number(m[1]) * 1000 : null
}

// ─── Game track picking ──────────────────────────────────────────────────────

const MIN_POOL = 20
/** Weight of the most popular track in the pool relative to the least popular one. */
const TOP_WEIGHT = 3
/** Tracks outside the popular pool count as if this many players had already heard them. */
const LESS_KNOWN_EXPOSURE = 1

/** Uniform float in (0, 1), crypto-backed when available. */
function randomUnit(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    return (buf[0] + 0.5) / 4_294_967_296
  }
  return Math.random() * (1 - 2e-12) + 1e-12
}

/**
 * Pick `count` tracks for a game: songs the room has heard least come first, then
 * popular ones (rank); no repeated artists when possible; randomized. Returns fewer
 * if the playlist is too small.
 *
 * `exposure(id)` is how much the players in the room have already heard a track
 * (the sum of their faded play counts, see src/game/history.ts; 0 = nobody). Tracks
 * are grouped by rounded exposure, where tracks outside the popular pool (the top
 * half by rank, at least 20 and at least 1.5 × count) count as heard by one more
 * player. Groups are taken least-heard first; inside a group, a weighted random
 * order (popular tracks up to 3× more likely) is walked keeping one track per
 * artist, then repeats fill the gaps. The result is in pick order, so trailing
 * items (used as spares) are the least ideal ones. Without history this is the
 * popular pool first, then the rest.
 */
export function pickGameTracks(tracks: TrackInfo[], count: number, exposure: (trackId: number) => number = () => 0): TrackInfo[] {
  const want = Math.floor(count)
  if (want <= 0 || tracks.length === 0) return []
  const sorted = uniqueById(tracks)
    .map((t, i) => ({ t, i }))
    .sort((a, b) => b.t.rank - a.t.rank || a.i - b.i)
    .map((x) => x.t)
  const n = sorted.length
  const poolSize = Math.min(n, Math.max(MIN_POOL, Math.ceil(n / 2), Math.ceil(want * 1.5)))

  // Efraimidis–Spirakis: key = ln(u) / w, larger keys first ⇒ weighted sampling without replacement.
  const ordered = sorted
    .map((t, i) => {
      const inPool = i < poolSize
      const w = inPool ? 1 + (TOP_WEIGHT - 1) * (poolSize > 1 ? 1 - i / (poolSize - 1) : 1) : 1
      const heard = exposure(t.id)
      const tier = Math.round((Number.isFinite(heard) && heard > 0 ? heard : 0) + (inPool ? 0 : LESS_KNOWN_EXPOSURE))
      return { t, tier, key: Math.log(randomUnit()) / w }
    })
    .sort((a, b) => a.tier - b.tier || b.key - a.key)
    .map((k) => k.t)

  const picked: TrackInfo[] = []
  const chosen = new Set<number>()
  const artists = new Set<string>()
  for (const t of ordered) {
    if (picked.length >= want) return picked
    const artist = normalizeArtist(t.artist)
    if (artists.has(artist)) continue
    picked.push(t)
    chosen.add(t.id)
    artists.add(artist)
  }
  for (const t of ordered) {
    if (picked.length >= want) break
    if (!chosen.has(t.id)) picked.push(t)
  }
  return picked
}
