// Tiny standalone Deezer JSONP client for the analysis lab (the app's own
// client lives in src/lib/deezer.ts).

export interface DzTrack {
  id: number
  title: string
  preview: string
  readable?: boolean
  artist: { name: string }
  album?: { cover_medium?: string }
}

let seq = 0

export function jsonp<T>(url: string, timeoutMs = 10000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const cb = `__dzlab_${Date.now().toString(36)}_${seq++}`
    const script = document.createElement('script')
    const scope = window as unknown as Record<string, unknown>
    const cleanup = (): void => {
      clearTimeout(timer)
      delete scope[cb]
      script.remove()
    }
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('JSONP timeout'))
    }, timeoutMs)
    scope[cb] = (data: T) => {
      cleanup()
      const err = (data as { error?: { message?: string } } | null)?.error
      if (err) reject(new Error(err.message ?? 'Deezer error'))
      else resolve(data)
    }
    script.src = `${url}${url.includes('?') ? '&' : '?'}output=jsonp&callback=${cb}`
    script.onerror = () => {
      cleanup()
      reject(new Error('JSONP network error'))
    }
    document.head.appendChild(script)
  })
}

const norm = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

const EXCLUDE = /\b(live|acoustic|remix|karaoke|instrumental|cover|version)\b/

/** Best matching track for a query, preferring the given artist / title and studio versions. */
export async function findTrack(q: string, artist?: string, title?: string): Promise<DzTrack> {
  if (/^\d+$/.test(q.trim())) return jsonp<DzTrack>(`https://api.deezer.com/track/${q.trim()}`)
  const res = await jsonp<{ data?: DzTrack[] }>(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=15`)
  const list = (res.data ?? []).filter((t) => t.preview && t.readable !== false)
  const ok = (t: DzTrack): boolean =>
    (!artist || norm(t.artist.name).includes(norm(artist))) && (!title || norm(t.title).includes(norm(title)))
  const hit = list.find((t) => ok(t) && !EXCLUDE.test(norm(t.title))) ?? list.find(ok) ?? list[0]
  if (!hit) throw new Error(`Nessun risultato per "${q}"`)
  return hit
}
