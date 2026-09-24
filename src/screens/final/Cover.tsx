import { useState } from 'react'
import { Icon, cn } from '../../components/ui'

/** Album cover with a branded placeholder while loading / when the image fails. */
export function Cover({ src, alt = '', className, iconSize = 16 }: { src?: string | null; alt?: string; className?: string; iconSize?: number }) {
  const [failed, setFailed] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<string | null>(null)
  const ok = !!src && failed !== src
  return (
    <span className={cn('relative block overflow-hidden bg-linear-to-br from-violet-deep/60 to-magenta-deep/40 ring-1 ring-white/10', className)}>
      {(!ok || loaded !== src) && (
        <span aria-hidden className="absolute inset-0 grid place-items-center text-white/45">
          <Icon name="disc" size={iconSize} />
        </span>
      )}
      {ok && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(src)}
          onError={() => setFailed(src)}
          className={cn('relative size-full object-cover transition-opacity duration-300', loaded === src ? 'opacity-100' : 'opacity-0')}
        />
      )}
    </span>
  )
}
