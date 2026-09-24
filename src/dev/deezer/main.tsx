// Lab: exercises src/lib/deezer.ts + coverColor.ts + playlistCategories.ts
// against the live Deezer API. Results are rendered and exposed on
// window.__deezerReport for scripts/deezer/run-lab.mjs.
import { useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import type { PlaylistRef, TrackInfo } from '../../game/types'
import { fxTrack } from '../fixtures'
import {
  DeezerError,
  dzGet,
  getFeaturedPlaylists,
  getPlaylist,
  getPlaylistTracks,
  isDeezerShortLink,
  parsePlaylistInput,
  pickGameTracks,
  previewExpiresAt,
  refreshPreview,
  resolvePlaylistInput,
  searchPlaylists,
} from '../../lib/deezer'
import { extractCoverColors, type CoverColors } from '../../lib/coverColor'
import { CATEGORY_CHIPS, FEATURED_PLAYLIST_IDS } from '../../lib/playlistCategories'

type Status = 'run' | 'ok' | 'fail'
interface Check {
  name: string
  status: Status
  detail: string
  ms?: number
}

interface ChipResult {
  label: string
  emoji?: string
  query: string
  playlists: PlaylistRef[]
}

interface Distribution {
  runs: number
  count: number
  poolTracks: number
  deciles: number[]
  topHalfShare: number
  avgDistinctArtists: number
  uniqueTracksSeen: number
  sample: TrackInfo[]
}

interface Swatch {
  track: TrackInfo
  colors: CoverColors
  ms: number
}

interface Report {
  checks: Check[]
  search: PlaylistRef[]
  featured: PlaylistRef[]
  chips: ChipResult[]
  tracks: { playlist: PlaylistRef | null; count: number; sample: TrackInfo[] }
  distribution: Distribution | null
  refresh: { before: string; after: string; beforeExp: number | null; afterExp: number | null; audioStatus: number } | null
  parse: { input: string; expected: number | null; got: number | null; short: boolean }[]
  swatches: Swatch[]
  leftovers: { scripts: number; liveCallbacks: number }
  done: boolean
}

declare global {
  interface Window {
    __deezerReport?: Report
  }
}

const PARSE_CASES: [string, number | null][] = [
  ['https://www.deezer.com/it/playlist/1116187241', 1116187241],
  ['deezer.com/playlist/908622995?utm_source=deezer&utm_medium=web', 908622995],
  ['3155776842', 3155776842],
  ['Ascolta su Deezer: https://www.deezer.com/en/playlist/248297032?utm_campaign=x', 248297032],
  ['https://widget.deezer.com/widget/dark/playlist/1116187241', 1116187241],
  ['deezer://www.deezer.com/playlist/867825522', 867825522],
  ['https://link.deezer.com/s/31qOmXyzAbc', null],
  ['https://deezer.page.link/AbCdEf123', null],
  ['https://www.deezer.com/it/album/302127', null],
  ['hits anni 90', null],
]

const TRACKS_PLAYLIST = 579513551 // Top Hits Italy (~290 tracks → 3 pages)
const DIST_RUNS = 1000
const DIST_COUNT = 9 // 5 rounds + 4 spares

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t0 = performance.now()
  const v = await fn()
  return [v, Math.round(performance.now() - t0)]
}

const errText = (e: unknown) => (e instanceof DeezerError ? `DeezerError(${e.kind}${e.code ? ` ${e.code}` : ''}): ${e.message}` : String(e))

const EMPTY_REPORT: Report = {
  checks: [],
  search: [],
  featured: [],
  chips: [],
  tracks: { playlist: null, count: 0, sample: [] },
  distribution: null,
  refresh: null,
  parse: [],
  swatches: [],
  leftovers: { scripts: 0, liveCallbacks: 0 },
  done: false,
}

function useLab(): Report {
  const [report, setReport] = useState<Report>(EMPTY_REPORT)

  useEffect(() => {
    let cancelled = false
    const r: Report = { ...EMPTY_REPORT, checks: [] }
    const push = () => {
      if (cancelled) return
      const snapshot = { ...r, checks: [...r.checks] }
      window.__deezerReport = snapshot
      setReport(snapshot)
    }
    const check = async (name: string, fn: () => Promise<string>) => {
      const c: Check = { name, status: 'run', detail: '' }
      r.checks.push(c)
      push()
      const t0 = performance.now()
      try {
        c.detail = await fn()
        c.status = 'ok'
      } catch (e) {
        c.detail = errText(e)
        c.status = 'fail'
      }
      c.ms = Math.round(performance.now() - t0)
      push()
    }
    const assert = (cond: boolean, msg: string) => {
      if (!cond) throw new Error(msg)
    }

    ;(async () => {
      await check('dzGet /search/playlist?q=hits', async () => {
        const res = await dzGet<{ data: unknown[]; total: number }>('/search/playlist', { q: 'hits', limit: 5 })
        assert(res.data.length === 5, `expected 5 rows, got ${res.data.length}`)
        return `${res.data.length} righe, total ${res.total}`
      })
      await check('dzGet cache (stessa richiesta)', async () => {
        const [, ms] = await timed(() => dzGet('/search/playlist', { q: 'hits', limit: 5 }))
        assert(ms < 20, `cache miss? ${ms}ms`)
        return `${ms} ms (cache)`
      })
      await check('dzGet errore API → DeezerError', async () => {
        try {
          await dzGet('/playlist/1')
        } catch (e) {
          assert(e instanceof DeezerError && e.kind === 'not-found' && e.code === 800, errText(e))
          return errText(e)
        }
        throw new Error('nessun errore')
      })
      await check('dzGet timeout → DeezerError', async () => {
        try {
          await dzGet('/search/playlist', { q: 'timeout-probe', limit: 1 }, 1)
        } catch (e) {
          assert(e instanceof DeezerError && e.kind === 'timeout', errText(e))
          return errText(e)
        }
        throw new Error('nessun errore')
      })
      await check('getPlaylist(1) → messaggio playlist', async () => {
        try {
          await getPlaylist(1)
        } catch (e) {
          assert(e instanceof DeezerError && e.kind === 'not-found', errText(e))
          return errText(e)
        }
        throw new Error('nessun errore')
      })

      await check("searchPlaylists('hits')", async () => {
        r.search = await searchPlaylists('hits')
        assert(r.search.length >= 12, `solo ${r.search.length}`)
        assert(r.search.every((p) => p.nbTracks >= 10 && p.picture.startsWith('https://')), 'playlist non valide')
        return `${r.search.length} playlist · prima: ${r.search[0]?.title}`
      })
      await check("searchPlaylists('   ') → []", async () => {
        const res = await searchPlaylists('   ')
        assert(res.length === 0, 'non vuoto')
        return '[]'
      })

      await check('getFeaturedPlaylists()', async () => {
        r.featured = await getFeaturedPlaylists()
        const curated = r.featured.filter((p) => FEATURED_PLAYLIST_IDS.includes(p.id)).length
        assert(curated === FEATURED_PLAYLIST_IDS.length, `curate ${curated}/${FEATURED_PLAYLIST_IDS.length}`)
        assert(r.featured.length === 24, `totale ${r.featured.length}`)
        assert(new Set(r.featured.map((p) => p.id)).size === r.featured.length, 'duplicati')
        return `${r.featured.length} (curate ${curated} + chart ${r.featured.length - curated})`
      })

      await check(`chip (${CATEGORY_CHIPS.length} ricerche)`, async () => {
        const out: ChipResult[] = []
        for (const chip of CATEGORY_CHIPS) {
          const playlists = await searchPlaylists(chip.query, 8)
          out.push({ ...chip, playlists })
          r.chips = [...out]
          push()
        }
        const weak = out.filter((c) => c.playlists.length < 6)
        assert(weak.length === 0, `deboli: ${weak.map((c) => c.label).join(', ')}`)
        return `tutte ≥ 6 risultati`
      })

      let tracks: TrackInfo[] = []
      await check(`getPlaylistTracks(${TRACKS_PLAYLIST})`, async () => {
        const [playlist, list] = await Promise.all([getPlaylist(TRACKS_PLAYLIST), getPlaylistTracks(TRACKS_PLAYLIST)])
        tracks = list
        r.tracks = { playlist, count: list.length, sample: list.slice(0, 6) }
        assert(list.length >= 200, `solo ${list.length}`)
        assert(new Set(list.map((t) => t.id)).size === list.length, 'id duplicati')
        assert(list.every((t) => t.preview.startsWith('https://') && t.cover.startsWith('https://')), 'campi mancanti')
        return `${list.length} brani giocabili su ${playlist.nbTracks}`
      })
      await check('getPlaylistTracks(1116187241, 50) → max rispettato', async () => {
        const list = await getPlaylistTracks(1116187241, 50)
        assert(list.length > 0 && list.length <= 50, `${list.length}`)
        return `${list.length} brani`
      })

      await check(`pickGameTracks × ${DIST_RUNS}`, async () => {
        const byRank = [...tracks].sort((a, b) => b.rank - a.rank)
        const pos = new Map(byRank.map((t, i) => [t.id, i]))
        const deciles = new Array<number>(10).fill(0)
        const seen = new Set<number>()
        let topHalf = 0
        let distinct = 0
        let sample: TrackInfo[] = []
        for (let run = 0; run < DIST_RUNS; run++) {
          const picks = pickGameTracks(tracks, DIST_COUNT)
          assert(picks.length === DIST_COUNT, `run ${run}: ${picks.length}`)
          assert(new Set(picks.map((t) => t.id)).size === DIST_COUNT, 'duplicati')
          distinct += new Set(picks.map((t) => t.artist.toLowerCase())).size
          for (const t of picks) {
            const p = pos.get(t.id) ?? 0
            deciles[Math.min(9, Math.floor((p / byRank.length) * 10))]++
            if (p < byRank.length / 2) topHalf++
            seen.add(t.id)
          }
          if (run === 0) sample = picks
        }
        const total = DIST_RUNS * DIST_COUNT
        r.distribution = {
          runs: DIST_RUNS,
          count: DIST_COUNT,
          poolTracks: tracks.length,
          deciles: deciles.map((d) => d / total),
          topHalfShare: topHalf / total,
          avgDistinctArtists: distinct / DIST_RUNS,
          uniqueTracksSeen: seen.size,
          sample,
        }
        return `top 50%: ${((topHalf / total) * 100).toFixed(1)}% · artisti distinti medi ${(distinct / DIST_RUNS).toFixed(2)}/${DIST_COUNT} · ${seen.size} brani diversi`
      })

      await check('refreshPreview', async () => {
        const track = tracks[0]
        await new Promise((res) => setTimeout(res, 1100)) // let the signature timestamp move
        const after = await refreshPreview(track.id)
        const beforeExp = previewExpiresAt(track.preview)
        const afterExp = previewExpiresAt(after)
        const audio = await fetch(after, { headers: { Range: 'bytes=0-1023' } })
        r.refresh = { before: track.preview, after, beforeExp, afterExp, audioStatus: audio.status }
        assert(after !== track.preview, 'URL identico')
        assert(afterExp !== null && afterExp > Date.now() + 10 * 60_000, 'scadenza sospetta')
        assert(audio.ok, `audio HTTP ${audio.status}`)
        return `nuova firma, scade tra ${Math.round(((afterExp ?? 0) - Date.now()) / 60000)} min · audio HTTP ${audio.status}`
      })

      await check('parsePlaylistInput', async () => {
        r.parse = PARSE_CASES.map(([input, expected]) => ({ input, expected, got: parsePlaylistInput(input), short: isDeezerShortLink(input) }))
        const bad = r.parse.filter((p) => p.got !== p.expected)
        assert(bad.length === 0, `falliti: ${bad.map((b) => b.input).join(' | ')}`)
        return `${r.parse.length}/${r.parse.length}`
      })
      await check('resolvePlaylistInput(link)', async () => {
        const p = await resolvePlaylistInput('https://www.deezer.com/it/playlist/1116187241?utm_source=x')
        assert(p?.id === 1116187241, 'id errato')
        const none = await resolvePlaylistInput('ciao')
        assert(none === null, 'atteso null')
        return `${p?.title} · ${p?.nbTracks} brani`
      })

      await check('extractCoverColors', async () => {
        const byAlbum = new Map<string, TrackInfo>([[fxTrack.cover, fxTrack]])
        for (const t of tracks) if (!byAlbum.has(t.cover) && byAlbum.size < 15) byAlbum.set(t.cover, t)
        const picks = [...byAlbum.values()]
        const out: Swatch[] = []
        for (const t of picks) {
          const [colors, ms] = await timed(() => extractCoverColors(t.cover))
          out.push({ track: t, colors, ms })
          r.swatches = [...out]
          push()
        }
        const defaults = out.filter((s) => s.colors.primary === '#7b5cff').length
        const [again, cachedMs] = await timed(() => extractCoverColors(picks[0].cover))
        assert(again === out[0].colors || again.primary === out[0].colors.primary, 'cache')
        const failed = await extractCoverColors('https://cdn-images.dzcdn.net/images/cover/doesnotexist/250x250-000000-80-0-0.jpg')
        assert(failed.primary === '#7b5cff', 'fallback')
        return `${out.length} cover · ${defaults} default · cache ${cachedMs} ms · fallback ok`
      })

      await new Promise((res) => setTimeout(res, 50))
      r.leftovers = {
        scripts: document.querySelectorAll('script[src*="api.deezer.com"]').length,
        liveCallbacks: Object.keys(window).filter((k) => k.startsWith('__dz_')).length,
      }
      r.done = true
      push()
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return report
}

function StatusDot({ s }: { s: Status }) {
  const cls = s === 'ok' ? 'bg-lime shadow-glow-lime' : s === 'fail' ? 'bg-coral' : 'bg-gold animate-pulse'
  return <span className={`inline-block size-2.5 shrink-0 rounded-full ${cls}`} />
}

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-panel border border-white/10 bg-ink-900/70 p-4 backdrop-blur-xl sm:p-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-sm font-extrabold tracking-wide text-ink-100 uppercase sm:text-base">{title}</h2>
        {aside && <div className="font-mono text-xs text-ink-300">{aside}</div>}
      </div>
      {children}
    </section>
  )
}

function PlaylistCard({ p }: { p: PlaylistRef }) {
  return (
    <div className="group min-w-0">
      <div className="aspect-square overflow-hidden rounded-block bg-ink-800 ring-1 ring-white/10">
        {p.picture && <img src={p.picture} alt="" loading="lazy" className="size-full object-cover" />}
      </div>
      <div className="mt-2 truncate text-sm font-bold text-ink-50">{p.title}</div>
      <div className="truncate text-xs text-ink-300">
        {p.nbTracks} brani{p.creator ? ` · ${p.creator}` : ''}
      </div>
    </div>
  )
}

function SwatchCard({ s }: { s: Swatch }) {
  const { primary, secondary, isDark } = s.colors
  return (
    <div className="overflow-hidden rounded-panel border border-white/10 bg-ink-950">
      <div className="relative aspect-[4/3] overflow-hidden">
        <img src={s.track.coverSmall} alt="" className="absolute inset-0 size-full object-cover" />
        <span className="absolute top-2 right-2 rounded-full bg-ink-950/80 px-2 py-0.5 font-mono text-[10px] text-ink-200 backdrop-blur">
          {isDark ? 'dark' : 'light'}
        </span>
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(180deg, transparent 35%, ${primary}00 45%, rgb(6 4 15 / 0.92) 100%)` }}
        />
        <div className="absolute right-3 bottom-3 left-3">
          <div className="truncate font-display text-sm font-extrabold uppercase" style={{ color: primary, textShadow: `0 0 18px ${primary}` }}>
            {s.track.title}
          </div>
          <div className="truncate text-xs font-semibold" style={{ color: secondary }}>
            {s.track.artist}
          </div>
        </div>
      </div>
      <div
        className="flex items-center gap-3 p-3"
        style={{ background: `radial-gradient(120% 140% at 0% 0%, ${primary}33, transparent 60%), radial-gradient(120% 140% at 100% 100%, ${secondary}2e, transparent 60%)` }}
      >
        <span className="size-9 rounded-full ring-2 ring-white/15" style={{ background: primary, boxShadow: `0 0 24px -2px ${primary}` }} />
        <span className="size-9 rounded-full ring-2 ring-white/15" style={{ background: secondary, boxShadow: `0 0 24px -2px ${secondary}` }} />
        <div className="min-w-0 flex-1 font-mono text-[11px] leading-tight text-ink-200">
          <div>{primary}</div>
          <div>{secondary}</div>
        </div>
      </div>
      <div className="px-3 pb-3">
        <div className="h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${primary}, ${secondary})`, boxShadow: `0 0 18px -4px ${primary}` }} />
      </div>
    </div>
  )
}

function Lab() {
  const r = useLab()
  const ok = r.checks.filter((c) => c.status === 'ok').length
  const fail = r.checks.filter((c) => c.status === 'fail').length
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-10 sm:gap-6 sm:px-6 sm:pt-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-xs tracking-widest text-magenta uppercase">lab / deezer</div>
          <h1 className="-skew-x-6 font-display text-3xl font-black text-ink-50 uppercase sm:text-5xl">Deezer API</h1>
        </div>
        <div className="font-mono text-sm text-ink-200" data-testid="summary">
          {r.done ? 'finito' : 'in corso…'} · <span className="text-lime">{ok} ok</span> · <span className="text-coral">{fail} ko</span>
        </div>
      </header>

      <Section title="Controlli" aside={r.done ? `script rimasti ${r.leftovers.scripts} · callback ${r.leftovers.liveCallbacks}` : undefined}>
        <ul className="flex flex-col divide-y divide-white/5">
          {r.checks.map((c) => (
            <li key={c.name} className="flex items-start gap-3 py-2">
              <span className="mt-1.5">
                <StatusDot s={c.status} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-ink-50">{c.name}</div>
                <div className={`text-xs break-words ${c.status === 'fail' ? 'text-coral' : 'text-ink-300'}`}>{c.detail}</div>
              </div>
              {c.ms !== undefined && <span className="font-mono text-xs text-ink-400 tabular-nums">{c.ms} ms</span>}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Cover → accenti neon" aside="extractCoverColors">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {r.swatches.map((s) => (
            <SwatchCard key={s.track.id} s={s} />
          ))}
        </div>
      </Section>

      <Section title="In evidenza" aside={`${r.featured.length} playlist`}>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {r.featured.map((p) => (
            <PlaylistCard key={p.id} p={p} />
          ))}
        </div>
      </Section>

      <Section title="Ricerca “hits”" aside={`${r.search.length} playlist`}>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {r.search.slice(0, 16).map((p) => (
            <PlaylistCard key={p.id} p={p} />
          ))}
        </div>
      </Section>

      <Section title="Chip categorie" aside={`${r.chips.length}/${CATEGORY_CHIPS.length}`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {r.chips.map((c) => (
            <div key={c.label} className="rounded-block border border-white/10 bg-ink-850 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded-full bg-white/8 px-3 py-1 text-sm font-bold text-ink-50">
                  {c.emoji} {c.label}
                </span>
                <span className="font-mono text-[11px] text-ink-400">“{c.query}”</span>
              </div>
              <ol className="flex flex-col gap-1.5">
                {c.playlists.slice(0, 4).map((p) => (
                  <li key={p.id} className="flex items-center gap-2">
                    <img src={p.picture} alt="" className="size-8 shrink-0 rounded-md object-cover" />
                    <span className="min-w-0 flex-1 truncate text-xs text-ink-100">{p.title}</span>
                    <span className="font-mono text-[10px] text-ink-400">{p.nbTracks}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </Section>

      {r.distribution && (
        <Section title={`pickGameTracks × ${r.distribution.runs}`} aside={`${r.distribution.count} brani da ${r.distribution.poolTracks}`}>
          <div className="flex h-40 items-end gap-1.5 sm:gap-3">
            {r.distribution.deciles.map((d, i) => (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="font-mono text-[10px] text-ink-300">{(d * 100).toFixed(1)}%</span>
                <div
                  className="w-full rounded-t-md"
                  style={{ height: `${Math.max(2, d * 400)}%`, background: i < 5 ? 'var(--color-violet)' : 'var(--color-ink-600)' }}
                />
                <span className="font-mono text-[10px] text-ink-400">D{i + 1}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-300">
            Decili per popolarità (D1 = più popolari). Top 50%: {(r.distribution.topHalfShare * 100).toFixed(1)}% · artisti distinti medi{' '}
            {r.distribution.avgDistinctArtists.toFixed(2)} · brani diversi visti {r.distribution.uniqueTracksSeen}
          </p>
          <ol className="mt-3 grid gap-2 sm:grid-cols-3">
            {r.distribution.sample.map((t, i) => (
              <li key={t.id} className="flex items-center gap-2 rounded-xl bg-ink-850 p-2">
                <img src={t.coverSmall} alt="" className="size-10 rounded-lg" />
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold">
                    {i + 1}. {t.title}
                  </div>
                  <div className="truncate text-[11px] text-ink-300">
                    {t.artist} · rank {t.rank.toLocaleString('it-IT')}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      <Section title="parsePlaylistInput">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <tbody>
              {r.parse.map((p) => (
                <tr key={p.input} className="border-t border-white/5">
                  <td className="max-w-0 truncate py-1.5 pr-3 font-mono text-ink-200">{p.input}</td>
                  <td className="py-1.5 pr-3 font-mono whitespace-nowrap text-ink-100">{p.got ?? 'null'}</td>
                  <td className="py-1.5 whitespace-nowrap">{p.got === p.expected ? <span className="text-lime">✓</span> : <span className="text-coral">✗ {String(p.expected)}</span>}</td>
                  <td className="py-1.5 pl-2 text-[10px] whitespace-nowrap text-ink-400">{p.short ? 'short link' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {r.refresh && (
        <Section title="refreshPreview">
          <div className="grid gap-2 font-mono text-[11px] break-all text-ink-300">
            <div>
              <span className="text-ink-100">prima</span> exp {r.refresh.beforeExp && new Date(r.refresh.beforeExp).toLocaleTimeString('it-IT')} · {r.refresh.before.slice(0, 120)}…
            </div>
            <div>
              <span className="text-lime">dopo</span> exp {r.refresh.afterExp && new Date(r.refresh.afterExp).toLocaleTimeString('it-IT')} · HTTP {r.refresh.audioStatus} · {r.refresh.after.slice(0, 120)}…
            </div>
          </div>
        </Section>
      )}
    </div>
  )
}

// No StrictMode: the effect must run exactly once (live API quota).
createRoot(document.getElementById('root')!).render(<Lab />)
