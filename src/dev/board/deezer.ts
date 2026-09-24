// Minimal Deezer JSONP client for the board lab (the app has its own in lib/deezer.ts).

let seq = 0

export function jsonp<T>(url: string, timeoutMs = 10000): Promise<T> {
  return new Promise((resolve, reject) => {
    const name = `__boardLabCb${Date.now().toString(36)}${seq++}`
    const w = window as unknown as Record<string, unknown>
    const script = document.createElement('script')
    const cleanup = () => {
      clearTimeout(timer)
      delete w[name]
      script.remove()
    }
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('Deezer: timeout'))
    }, timeoutMs)
    w[name] = (data: T) => {
      cleanup()
      const err = (data as { error?: { message?: string } }).error
      if (err) reject(new Error(`Deezer: ${err.message ?? 'errore'}`))
      else resolve(data)
    }
    script.onerror = () => {
      cleanup()
      reject(new Error('Deezer: rete'))
    }
    script.src = `${url}${url.includes('?') ? '&' : '?'}output=jsonp&callback=${name}`
    document.head.appendChild(script)
  })
}

export interface LabTrack {
  id: number
  title: string
  artist: string
  preview: string
  cover: string
}

interface SearchResponse {
  data: {
    id: number
    title: string
    preview: string
    readable?: boolean
    artist: { name: string }
    album: { cover_medium: string }
  }[]
}

export async function findPreview(query: string): Promise<LabTrack> {
  const res = await jsonp<SearchResponse>(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=10`)
  const t = res.data.find((d) => d.preview && d.readable !== false)
  if (!t) throw new Error('Nessuna anteprima trovata')
  return { id: t.id, title: t.title, artist: t.artist.name, preview: t.preview, cover: t.album.cover_medium }
}
