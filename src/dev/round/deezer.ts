// Tiny JSONP helper for the round lab: a fresh signed preview URL for a track id.
let seq = 0

export function loadPreview(trackId: number, timeoutMs = 10000): Promise<string> {
  return new Promise((resolve, reject) => {
    const name = `__roundLabCb${Date.now().toString(36)}${seq++}`
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
    w[name] = (data: { preview?: string; error?: { message?: string } }) => {
      cleanup()
      if (data.error || !data.preview) reject(new Error(`Deezer: ${data.error?.message ?? 'nessuna anteprima'}`))
      else resolve(data.preview)
    }
    script.onerror = () => {
      cleanup()
      reject(new Error('Deezer: rete'))
    }
    script.src = `https://api.deezer.com/track/${trackId}?output=jsonp&callback=${name}`
    document.head.appendChild(script)
  })
}
