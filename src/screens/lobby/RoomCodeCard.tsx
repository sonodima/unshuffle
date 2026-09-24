import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { Button, Icon, IconButton, Modal, Panel, cn, playSfx, useCanHover } from '../../components/ui'
import { QrCode } from './QrCode'
import { canNativeShare, nativeShare, splitDisplayUrl, useCopy } from './invite'

interface RoomCodeCardProps {
  code: string
  /** Full join link (…#/r/CODE). */
  joinUrl: string
  /** 'full' = code + inline QR + actions (desktop column) · 'compact' = code + actions, QR in a sheet (phones). */
  variant?: 'full' | 'compact'
  className?: string
}

/** The room's identity card: huge sliced-letter code, copy / share / QR. */
export function RoomCodeCard({ code, joinUrl, variant = 'full', className }: RoomCodeCardProps) {
  const [qrOpen, setQrOpen] = useState(false)
  const link = useCopy()
  const codeCopy = useCopy(1600)
  const [shareable] = useState(() => canNativeShare(joinUrl))
  const compact = variant === 'compact'
  // Narrow card (phones, the 320px desktop column) with two text buttons: drop their icons so both labels fit.
  const tight = shareable ? '@max-[22.5rem]:px-3.5 @max-[22.5rem]:[&_.btn-label>svg]:hidden' : undefined
  const canHover = useCanHover()
  const shownUrl = splitDisplayUrl(joinUrl)

  const copyLink = () => {
    void link.copy(joinUrl).then((ok) => {
      playSfx(ok ? 'pop' : 'wrong')
      // Clipboard blocked (e.g. plain-http LAN address): show the link so it can be copied by hand.
      if (!ok) setQrOpen(true)
    })
  }
  const share = () => {
    void nativeShare(code, joinUrl).then((r) => {
      if (r === 'failed') copyLink()
    })
  }

  return (
    <Panel as="section" aria-label="Codice stanza" padding={compact ? 'sm' : 'lg'} glow="magenta" className={cn(compact && '@container px-4 pt-3.5 pb-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow text-ink-200">Codice stanza</span>
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            key={codeCopy.state}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            className={cn('text-[11px] font-bold', codeCopy.state === 'copied' ? 'text-lime' : codeCopy.state === 'failed' ? 'text-gold' : 'text-ink-400')}
            aria-live="polite"
          >
            {codeCopy.state === 'copied'
              ? 'Codice copiato!'
              : codeCopy.state === 'failed'
                ? 'Copia non riuscita'
                : canHover
                  ? 'Clicca per copiarlo'
                  : 'Tocca per copiarlo'}
          </motion.span>
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={() => {
          void codeCopy.copy(code).then((ok) => ok && playSfx('pop'))
        }}
        aria-label={`Codice stanza ${code.split('').join(' ')}. Copia codice`}
        className={cn('group block w-full rounded-[18px] tap-none', compact ? 'mt-2.5' : 'mt-4')}
      >
        <CodeTiles code={code} size={compact ? 'md' : 'lg'} />
      </button>

      {compact ? (
        <div className="mt-4 flex gap-2 sm:justify-center">
          <Button
            variant="glass"
            size="md"
            leftIcon={link.state === 'copied' ? 'check' : 'link'}
            className={cn('min-w-0 flex-1 sm:max-w-[220px]', tight, link.state === 'copied' && 'text-lime')}
            onClick={copyLink}
            sound={false}
          >
            {link.state === 'copied' ? 'Copiato!' : 'Copia link'}
          </Button>
          {shareable && (
            <Button variant="glass" size="md" leftIcon="share" className={cn('min-w-0 flex-1 sm:max-w-[220px]', tight)} onClick={share}>
              Condividi
            </Button>
          )}
          <IconButton icon="qr" label="Mostra QR code" variant="glass" size="md" onClick={() => setQrOpen(true)} />
        </div>
      ) : (
        <div className="mt-6 flex items-stretch gap-4 border-t border-white/[0.07] pt-5">
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            aria-label="Ingrandisci QR code"
            className="group relative shrink-0 rounded-[18px] bg-ink-50 p-2 shadow-[0_0_0_1px_rgb(255_255_255/0.5),0_14px_30px_-12px_rgb(255_63_209/0.55)] transition-transform duration-200 ease-[var(--ease-spring)] hover:scale-[1.04] active:scale-[0.98]"
          >
            <QrCode value={joinUrl} size={88} />
            <span className="absolute -right-1.5 -bottom-1.5 grid size-7 place-items-center rounded-full bg-ink-800 text-ink-100 shadow-[0_0_0_2px_var(--color-ink-900)] transition-colors group-hover:bg-violet group-hover:text-white">
              <Icon name="search" size={13} strokeWidth={3} />
            </span>
          </button>
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
            <div className="min-w-0">
              <p className="display display-skew text-[13px] text-ink-50">Entra dal telefono</p>
              <p className="mt-1.5 text-[13px] leading-snug text-ink-300">Inquadra il QR o apri il link: si entra al volo, senza account.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="glass"
                size="sm"
                leftIcon={link.state === 'copied' ? 'check' : 'link'}
                className={cn(link.state === 'copied' && 'text-lime')}
                onClick={copyLink}
                sound={false}
              >
                {link.state === 'copied' ? 'Copiato!' : 'Copia link'}
              </Button>
              {shareable && (
                <IconButton icon="share" label="Condividi" size="sm" onClick={share} />
              )}
            </div>
          </div>
        </div>
      )}

      <Modal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        title="Invita gli amici"
        description="Inquadra il QR con la fotocamera del telefono, oppure condividi il link."
        size="sm"
      >
        <div className="flex flex-col items-center gap-5">
          <div className="rounded-[26px] bg-ink-50 p-4 shadow-[0_0_0_1px_rgb(255_255_255/0.6),0_24px_60px_-20px_rgb(255_63_209/0.6)]">
            <QrCode value={joinUrl} size={232} />
          </div>
          <div className="flex w-full flex-col items-center gap-1">
            <span className="eyebrow">Codice</span>
            <span className="display display-skew text-3xl tracking-[0.18em] text-ink-50">{code}</span>
          </div>
          <div className="flex w-full items-center gap-2 rounded-2xl border border-white/[0.08] bg-ink-950/50 py-1.5 pr-1.5 pl-4 shadow-well">
            {/* Middle truncation: the host part gives way, the "#/r/CODE" tail always stays readable. */}
            <span className="num flex min-w-0 flex-1 text-[13px] text-ink-200 select-all" title={joinUrl}>
              <span className="min-w-0 truncate">{shownUrl.head}</span>
              <span className="shrink-0 text-ink-50">{shownUrl.tail}</span>
            </span>
            <Button
              variant={link.state === 'copied' ? 'glass' : 'secondary'}
              size="sm"
              leftIcon={link.state === 'copied' ? 'check' : 'copy'}
              className={cn(link.state === 'copied' && 'text-lime')}
              onClick={copyLink}
              sound={false}
            >
              {link.state === 'copied' ? 'Copiato' : 'Copia'}
            </Button>
          </div>
          {link.state === 'failed' && (
            <p className="-mt-2 text-center text-xs font-semibold text-gold">Copia non riuscita: seleziona il link e copialo a mano.</p>
          )}
          {shareable && (
            <Button variant="glass" size="md" leftIcon="share" fullWidth onClick={share}>
              Condividi link
            </Button>
          )}
        </div>
      </Modal>
    </Panel>
  )
}

const TILE = {
  // Sized by the card (an @container), not the viewport: the compact card also sits in a 320px desktop column.
  md: 'h-[58px] max-w-[60px] rounded-[14px] text-[32px] @min-[26rem]:h-[76px] @min-[26rem]:max-w-[68px] @min-[26rem]:rounded-[18px] @min-[26rem]:text-[40px]',
  lg: 'h-[84px] max-w-[70px] rounded-[18px] text-[44px]',
} as const

/** Five keycap tiles, each letter sliced in two like an audio snippet (brand motif). */
function CodeTiles({ code, size = 'lg', className }: { code: string; size?: 'md' | 'lg'; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <span aria-hidden className={cn('flex justify-center gap-[clamp(6px,2vw,10px)] [perspective:600px]', className)}>
      {code.split('').map((ch, i) => (
        <motion.span
          key={`${code}-${i}`}
          initial={reduce ? false : { opacity: 0, y: -18, rotateX: 75 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 22, delay: 0.08 + i * 0.07 }}
          className={cn(
            'relative grid flex-1 place-items-center overflow-hidden font-display font-black transition-transform duration-200 ease-[var(--ease-spring)] group-hover:-translate-y-0.5 group-active:translate-y-0.5',
            TILE[size],
          )}
          style={{
            background: 'linear-gradient(180deg, var(--color-ink-700) 0%, var(--color-ink-850) 70%)',
            boxShadow:
              'inset 0 1px 0 rgb(255 255 255 / 0.16), inset 0 -3px 0 rgb(0 0 0 / 0.25), 0 5px 0 color-mix(in oklab, var(--color-violet-deep) 45%, black), 0 12px 24px -8px rgb(0 0 0 / 0.7)',
          }}
        >
          {/* Top gloss */}
          <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-linear-to-b from-white/[0.09] to-transparent" />
          <SlicedLetter ch={ch} index={i} />
        </motion.span>
      ))}
    </span>
  )
}

function SlicedLetter({ ch, index }: { ch: string; index: number }) {
  const t = index / 4
  return (
    <span className="display-skew relative inline-block leading-none" style={{ filter: 'drop-shadow(0 0.05em 0 var(--color-violet-deep))' }}>
      <span className="invisible">{ch}</span>
      <span
        className="absolute inset-0 text-transparent"
        style={{
          clipPath: 'inset(-0.2em -0.1em 50% -0.1em)',
          backgroundImage: 'linear-gradient(180deg, white 30%, var(--color-ink-100) 100%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
        }}
      >
        {ch}
      </span>
      <span
        className="absolute inset-0 translate-x-[0.04em] text-transparent"
        style={{
          clipPath: 'inset(calc(50% + 0.05em) -0.1em -0.2em -0.1em)',
          backgroundImage: `linear-gradient(180deg, color-mix(in oklab, var(--color-magenta) ${Math.round(100 - t * 60)}%, var(--color-violet-bright)) 0%, color-mix(in oklab, var(--color-magenta-deep) ${Math.round(100 - t * 60)}%, var(--color-violet-deep)) 100%)`,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
        }}
      >
        {ch}
      </span>
    </span>
  )
}
