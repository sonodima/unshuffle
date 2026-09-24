// Minimal Deezer JSONP helper for the engine lab (lib/deezer.ts is built separately).
let seq = 0

export function dz<T>(path: string, params: Record<string, string | number> = {}, timeoutMs = 10000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const cb = `__dzEngineLab_${Date.now().toString(36)}_${seq++}`
    const w = window as unknown as Record<string, unknown>
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) q.set(k, String(v))
    q.set('output', 'jsonp')
    q.set('callback', cb)
    const script = document.createElement('script')
    const cleanup = () => {
      clearTimeout(timer)
      delete w[cb]
      script.remove()
    }
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('Deezer timeout'))
    }, timeoutMs)
    w[cb] = (data: unknown) => {
      cleanup()
      const err = (data as { error?: { message?: string } }).error
      if (err) reject(new Error(err.message ?? 'Deezer error'))
      else resolve(data as T)
    }
    script.onerror = () => {
      cleanup()
      reject(new Error('Deezer network error'))
    }
    script.src = `https://api.deezer.com${path}?${q}`
    document.head.appendChild(script)
  })
}

interface DzTrack {
  id: number
  title: string
  preview: string
  artist: { name: string }
}

export async function trackPreview(id: number): Promise<{ url: string; title: string; artist: string }> {
  const t = await dz<DzTrack>(`/track/${id}`)
  if (!t.preview) throw new Error(`track ${id} has no preview`)
  return { url: t.preview, title: t.title, artist: t.artist.name }
}
