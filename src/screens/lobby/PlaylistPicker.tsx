import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useEffectEvent, useRef, useState, type ReactNode, type Ref } from 'react'
import { Button, Chip, Icon, IconButton, Input, Spinner, cn, formatNumber, playSfx, useCanHover, type IconName } from '../../components/ui'
import type { PlaylistRef } from '../../game/types'
import { CATEGORY_CHIPS, type CategoryChip } from '../../lib/playlistCategories'
import { catalogErrorMessage, deezerCatalog, type PlaylistCatalog } from './catalog'
import { MIN_ROUNDS, tracksWord } from './rules'

const SEARCH_DEBOUNCE_MS = 350
const MIN_QUERY = 2

interface PlaylistPickerProps {
  selected: PlaylistRef | null
  onSelect(playlist: PlaylistRef): void
  /** Ref to the search field (e.g. to focus it from a "Cambia" button). */
  inputRef?: Ref<HTMLInputElement>
  className?: string
}

type LinkKind = { kind: 'none' } | { kind: 'id'; id: number } | { kind: 'short' } | { kind: 'foreign' }

const URLISH = /:\/\/|www\.|deezer|\.[a-z]{2,}\//i

/** Classify what's in the search box: text, a playlist link, or a link we can't use. */
function analyzeInput(raw: string, catalog: PlaylistCatalog): LinkKind {
  const s = raw.trim()
  if (!s) return { kind: 'none' }
  // Bare numbers are ids only when long enough (so "2000" or "90" stay searches).
  const looksLikeLink = URLISH.test(s) || /^\d{6,}$/.test(s)
  if (!looksLikeLink) return { kind: 'none' }
  if (catalog.isShortLink(s)) return { kind: 'short' }
  const id = catalog.parseInput(s)
  if (id !== null) return { kind: 'id', id }
  return { kind: 'foreign' }
}

interface Request {
  key: string
  run(): Promise<PlaylistRef[]>
  heading: ReactNode
  icon: IconName | string
  /** Pasted link: select the playlist as soon as it resolves. */
  autoSelect?: boolean
  query?: string
}

interface Outcome {
  key: string
  attempt: number
  items?: PlaylistRef[]
  error?: string
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/** Search box + category chips + featured shelf + results grid. Paste a Deezer link to pick it directly. */
export function PlaylistPicker({ selected, onSelect, inputRef, className }: PlaylistPickerProps) {
  const [input, setInput] = useState('')
  const [chip, setChip] = useState<CategoryChip | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  // Results per request key for this picker's lifetime (going back to a chip / the shelf is instant).
  const [cache] = useState(() => new Map<string, PlaylistRef[]>())

  const trimmed = input.trim().replace(/\s+/g, ' ')
  const debounced = useDebounced(trimmed, SEARCH_DEBOUNCE_MS)
  const link = analyzeInput(input, deezerCatalog)

  let req: Request | null = null
  if (link.kind === 'id') {
    const id = link.id
    req = { key: `id:${id}`, run: () => deezerCatalog.getPlaylist(id).then((p) => [p]), heading: 'Dal tuo link', icon: 'link', autoSelect: true }
  } else if (link.kind === 'none') {
    if (trimmed.length >= MIN_QUERY) {
      const q = debounced.length >= MIN_QUERY ? debounced : null
      if (q) req = { key: `q:${q.toLowerCase()}`, run: () => deezerCatalog.search(q), heading: <>Risultati per “{q}”</>, icon: 'search', query: q }
    } else if (chip) {
      const c = chip
      req = { key: `c:${c.query}`, run: () => deezerCatalog.search(c.query), heading: c.label, icon: c.emoji ?? 'music' }
    } else {
      req = { key: 'featured', run: () => deezerCatalog.featured(), heading: 'In evidenza', icon: 'star' }
    }
  }
  const reqKey = req?.key ?? null
  const waiting = link.kind === 'none' && trimmed.length >= MIN_QUERY && trimmed !== debounced

  // Effect events read the latest render's request / selection without re-running the fetch effect.
  const currentRequest = useEffectEvent(() => req)
  const pickFromLink = useEffectEvent((playlist: PlaylistRef | undefined, withSound: boolean) => {
    if (!playlist || playlist.id === selected?.id) return
    if (withSound) playSfx('pop')
    onSelect(playlist)
  })

  useEffect(() => {
    const r = currentRequest()
    if (!r) return
    const hit = cache.get(r.key)
    if (hit) {
      // Cached pasted link: still select it.
      if (r.autoSelect) pickFromLink(hit[0], false)
      return
    }
    let alive = true
    r.run().then(
      (items) => {
        cache.set(r.key, items)
        if (!alive) return
        setOutcome({ key: r.key, attempt, items })
        if (r.autoSelect) pickFromLink(items[0], true)
      },
      (err: unknown) => {
        if (alive) setOutcome({ key: r.key, attempt, error: catalogErrorMessage(err) })
      },
    )
    return () => {
      alive = false
    }
  }, [reqKey, attempt, cache])

  const cached = reqKey ? cache.get(reqKey) : undefined
  const current: Outcome | null = cached
    ? { key: reqKey!, attempt, items: cached }
    : outcome && outcome.key === reqKey && outcome.attempt === attempt
      ? outcome
      : null
  const loading = (!!req && !current) || (!req && waiting)

  // Short screen-reader summary instead of announcing the whole grid.
  const status =
    link.kind === 'short' || link.kind === 'foreign'
      ? 'Link non valido'
      : loading
        ? 'Caricamento…'
        : current?.error
          ? current.error
          : current?.items
            ? `${current.items.length} playlist`
            : ''

  const setQuery = (v: string) => {
    setInput(v)
    if (chip && v.trim()) setChip(null)
  }

  return (
    <div className={cn('@container flex min-w-0 flex-col', className)}>
      <Input
        ref={inputRef}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        icon="search"
        size="lg"
        aria-label="Cerca playlist"
        placeholder="Cerca o incolla un link Deezer"
        value={input}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && input) {
            e.preventDefault()
            setQuery('')
          }
        }}
        className="[&::-webkit-search-cancel-button]:hidden"
        rightSlot={
          loading || waiting ? (
            <span className="grid size-9 place-items-center text-violet-bright">
              <Spinner size={18} label="Ricerca in corso" />
            </span>
          ) : input ? (
            <IconButton icon="x" label="Svuota ricerca" size="sm" variant="ghost" tooltip={false} onClick={() => setQuery('')} />
          ) : null
        }
      />

      <ChipRow active={link.kind === 'none' && trimmed.length < MIN_QUERY ? chip : null} onPick={(c) => {
        setInput('')
        setChip((cur) => (cur?.query === c.query ? null : c))
      }} />

      <p className="sr-only" aria-live="polite">
        {status}
      </p>
      <div className="mt-5 min-h-[280px]" aria-busy={loading || undefined}>
        {link.kind === 'short' ? (
          <Notice
            tone="gold"
            icon="link"
            title="Incolla il link completo della playlist"
            body="I link brevi (link.deezer.com) non si possono aprire da qui. Aprilo nel browser o nell’app Deezer e copia l’indirizzo completo: deezer.com/…/playlist/123456."
          />
        ) : link.kind === 'foreign' ? (
          <Notice
            tone="gold"
            icon="alert"
            title="Questo link non è una playlist"
            body="Incolla il link di una playlist pubblica di Deezer, tipo deezer.com/it/playlist/123456 — oppure cerca per nome, artista o genere."
          />
        ) : !req ? (
          waiting ? <SkeletonGrid count={10} /> : null
        ) : (
          <>
            <div className="mb-3 flex min-h-7 items-center justify-between gap-3 px-1">
              <h3 className="flex min-w-0 items-center gap-2 text-sm font-extrabold text-ink-100">
                <HeadingIcon icon={req.icon} />
                <span className="truncate">{req.heading}</span>
              </h3>
              {current?.items && current.items.length > 0 && link.kind === 'none' && (
                <span className="num shrink-0 text-xs text-ink-400">{current.items.length} playlist</span>
              )}
            </div>
            {current?.error ? (
              <Notice
                tone="coral"
                icon={link.kind === 'id' ? 'alert' : 'wifi-off'}
                title={link.kind === 'id' ? 'Playlist non trovata' : 'Deezer non risponde'}
                body={dropLead(current.error, link.kind === 'id' ? 'Playlist non trovata' : '')}
                action={
                  link.kind === 'id' ? undefined : (
                    <Button variant="glass" size="sm" leftIcon="refresh" onClick={() => setAttempt((a) => a + 1)}>
                      Riprova
                    </Button>
                  )
                }
              />
            ) : loading ? (
              <SkeletonGrid count={link.kind === 'id' ? 1 : 10} />
            ) : current?.items && current.items.length === 0 ? (
              <Notice
                tone="neutral"
                icon="search"
                title={req.query ? `Nessuna playlist per “${req.query}”` : 'Nessuna playlist'}
                body="Prova con un artista, un genere o un decennio, oppure incolla il link di una playlist Deezer."
              />
            ) : (
              <>
                {link.kind === 'id' && current?.items?.[0] && selected?.id === current.items[0].id && (
                  <p className="mb-3 flex items-center gap-2 px-1 text-sm font-bold text-lime">
                    <Icon name="check" size={16} strokeWidth={3} />
                    Playlist scelta dal link
                  </p>
                )}
                <Grid items={current?.items ?? []} selectedId={selected?.id ?? null} onSelect={onSelect} gridKey={reqKey ?? ''} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/** "Playlist non trovata: controlla il link" under the title "Playlist non trovata" → "Controlla il link". */
function dropLead(message: string, title: string): string {
  if (!title || !message.toLowerCase().startsWith(title.toLowerCase())) return message
  const rest = message.slice(title.length).replace(/^[\s:.–—-]+/, '')
  return rest ? rest[0].toUpperCase() + rest.slice(1) : message
}

function HeadingIcon({ icon }: { icon: IconName | string }) {
  const isEmoji = !/^[a-z-]+$/.test(icon)
  return isEmoji ? (
    <span className="emoji text-base">{icon}</span>
  ) : (
    <Icon name={icon as IconName} size={16} strokeWidth={2.5} filled={icon === 'star'} className={icon === 'star' ? 'text-gold' : 'text-ink-300'} />
  )
}

// ─── Chips ──────────────────────────────────────────────────────────────────

function ChipRow({ active, onPick }: { active: CategoryChip | null; onPick(c: CategoryChip): void }) {
  const ref = useRef<HTMLDivElement>(null)
  const canHover = useCanHover()
  const [edges, setEdges] = useState({ start: false, end: true })

  const measure = () => {
    const el = ref.current
    if (!el) return
    const start = el.scrollLeft > 4
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
    setEdges((e) => (e.start === start && e.end === end ? e : { start, end }))
  }
  useEffect(() => {
    measure()
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const scrollBy = (dir: 1 | -1) => {
    const el = ref.current
    el?.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: 'smooth' })
  }

  const mask = `linear-gradient(90deg, ${edges.start ? 'transparent 0, #000 40px' : '#000 0'}, ${edges.end ? '#000 calc(100% - 40px), transparent 100%' : '#000 100%'})`

  return (
    <div className="relative mt-3 -mx-1">
      <div
        ref={ref}
        onScroll={measure}
        role="group"
        aria-label="Categorie"
        className="no-scrollbar flex gap-2 overflow-x-auto scroll-smooth px-1 py-1.5 [overscroll-behavior-x:contain]"
        style={{ maskImage: mask, WebkitMaskImage: mask }}
      >
        {CATEGORY_CHIPS.map((c) => (
          <Chip
            key={c.query}
            leading={c.emoji}
            size="md"
            selected={active?.query === c.query}
            onClick={(e) => {
              e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
              onPick(c)
            }}
          >
            {c.label}
          </Chip>
        ))}
      </div>
      {canHover && edges.start && (
        <IconButton icon="chevron-left" label="Categorie precedenti" size="sm" tooltip={false} onClick={() => scrollBy(-1)} className="absolute top-1/2 left-0 -translate-y-1/2" />
      )}
      {canHover && edges.end && (
        <IconButton icon="chevron-right" label="Altre categorie" size="sm" tooltip={false} onClick={() => scrollBy(1)} className="absolute top-1/2 right-0 -translate-y-1/2" />
      )}
    </div>
  )
}

// ─── Results ────────────────────────────────────────────────────────────────

const GRID = 'grid grid-cols-2 gap-x-3 gap-y-4 @md:grid-cols-3 @2xl:grid-cols-4 @3xl:grid-cols-5 @md:gap-x-4'

function Grid({ items, selectedId, onSelect, gridKey }: { items: PlaylistRef[]; selectedId: number | null; onSelect(p: PlaylistRef): void; gridKey: string }) {
  const reduce = useReducedMotion()
  return (
    <ul key={gridKey} className={GRID}>
      {items.map((p, i) => (
        <motion.li
          key={p.id}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32, delay: Math.min(i, 14) * 0.028 }}
        >
          <PlaylistCard playlist={p} selected={p.id === selectedId} onSelect={() => onSelect(p)} />
        </motion.li>
      ))}
    </ul>
  )
}

function PlaylistCard({ playlist, selected, onSelect }: { playlist: PlaylistRef; selected: boolean; onSelect(): void }) {
  // Fewer tracks than the shortest game: still pickable, but say so before the host gets attached to it.
  const tooShort = playlist.nbTracks > 0 && playlist.nbTracks < MIN_ROUNDS
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => {
        if (selected) return
        playSfx('pop', { pitch: 1.1 })
        onSelect()
      }}
      className="group flex w-full flex-col text-left tap-none focus-visible:outline-offset-4"
      title={playlist.title}
    >
      <span className="relative block">
        <Cover
          src={playlist.picture}
          className={cn(
            'transition-[transform,box-shadow] duration-300 ease-[var(--ease-spring)] group-active:scale-[0.97]',
            selected
              ? 'scale-[0.96] shadow-[0_0_0_3px_var(--color-lime),0_0_0_6px_rgb(166_255_63/0.18),0_16px_40px_-12px_rgb(166_255_63/0.55)]'
              : 'shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_12px_28px_-14px_rgb(0_0_0/0.9)] group-hover:-translate-y-1 group-hover:shadow-[0_0_0_1px_rgb(255_255_255/0.2),0_18px_36px_-14px_rgb(123_92_255/0.7)]',
          )}
        />
        <AnimatePresence>
          {selected && (
            <motion.span
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 600, damping: 24 }}
              className="absolute -top-1.5 -right-1.5 grid size-8 place-items-center rounded-full bg-lime text-ink-950 shadow-[0_0_0_3px_var(--color-ink-900),0_4px_14px_rgb(166_255_63/0.6)]"
            >
              <Icon name="check" size={18} strokeWidth={3.4} />
            </motion.span>
          )}
        </AnimatePresence>
        {!selected && (
          <span className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-y-0 group-hover:opacity-100 translate-y-1 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
            <span className="btn-label rounded-full bg-ink-950/80 px-3 py-1.5 font-display text-[10px] font-bold tracking-wider text-white uppercase">
              Scegli
            </span>
          </span>
        )}
      </span>
      <span className={cn('mt-2.5 line-clamp-2 px-0.5 text-[13px] leading-snug font-extrabold transition-colors @md:text-sm', selected ? 'text-lime' : 'text-ink-50')}>
        {playlist.title}
      </span>
      <span className={cn('mt-0.5 truncate px-0.5 text-[11px] font-semibold @md:text-xs', tooShort ? 'text-gold' : 'text-ink-400')}>
        <span className="num">{formatNumber(playlist.nbTracks)}</span> {tracksWord(playlist.nbTracks)}
        {tooShort ? ' · troppo corta' : playlist.creator ? ` · ${playlist.creator}` : ''}
      </span>
    </button>
  )
}

/** Square cover with shimmer while loading and a branded fallback. */
export function Cover({ src, className, rounded = 'rounded-[16px]' }: { src: string; className?: string; rounded?: string }) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>(src ? 'loading' : 'error')
  const [lastSrc, setLastSrc] = useState(src)
  if (src !== lastSrc) {
    setLastSrc(src)
    setState(src ? 'loading' : 'error')
  }
  return (
    <span className={cn('relative block aspect-square w-full overflow-hidden bg-ink-800', rounded, className)}>
      {state !== 'ok' && (
        <span className={cn('absolute inset-0 grid place-items-center', state === 'loading' ? 'shimmer' : 'bg-gradient-brand')}>
          {state === 'error' && <Icon name="music" size={32} className="text-white/70" />}
        </span>
      )}
      {src && state !== 'error' && (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setState('ok')}
          onError={() => setState('error')}
          className={cn('absolute inset-0 size-full object-cover transition-opacity duration-300', state === 'ok' ? 'opacity-100' : 'opacity-0')}
        />
      )}
      <span className="pointer-events-none absolute inset-0 bg-linear-to-b from-white/[0.08] via-transparent to-black/20" />
    </span>
  )
}

function SkeletonGrid({ count }: { count: number }) {
  return (
    <ul className={GRID} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex flex-col">
          <span className="shimmer block aspect-square w-full rounded-[16px] bg-white/[0.04]" />
          <span className="shimmer mt-3 block h-3 w-4/5 rounded-full bg-white/[0.05]" />
          <span className="shimmer mt-2 block h-2.5 w-1/2 rounded-full bg-white/[0.04]" />
        </li>
      ))}
    </ul>
  )
}

const NOTICE_TONE = {
  gold: 'border-gold/25 bg-gold/[0.07] text-gold',
  coral: 'border-coral/25 bg-coral/[0.07] text-coral',
  neutral: 'border-white/[0.08] bg-white/[0.03] text-ink-300',
} as const

function Notice({ tone, icon, title, body, action }: { tone: keyof typeof NOTICE_TONE; icon: IconName; title: string; body: string; action?: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      role={tone === 'coral' ? 'alert' : undefined}
      className={cn('flex flex-col items-center gap-3 rounded-block border px-5 py-8 text-center', NOTICE_TONE[tone])}
    >
      <span className="grid size-12 place-items-center rounded-full bg-current/10">
        <Icon name={icon} size={22} strokeWidth={2.3} />
      </span>
      <div className="max-w-sm">
        <p className="font-extrabold text-ink-50">{title}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-300">{body}</p>
      </div>
      {action}
    </motion.div>
  )
}
