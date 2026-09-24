import QRCode from 'qrcode'
import { useMemo } from 'react'

interface QrCodeProps {
  /** Text to encode (the join URL). */
  value: string
  /** Rendered size in px (square). */
  size: number
  /** Accessible description. */
  label?: string
  className?: string
}

const QUIET = 2
const FINDER = 7

const f = (n: number) => String(Math.round(n * 100) / 100)

function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  return `M${f(x + r)} ${f(y)}h${f(w - 2 * r)}a${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(r)}v${f(h - 2 * r)}a${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(r)}h${f(-(w - 2 * r))}a${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(-r)}v${f(-(h - 2 * r))}a${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(-r)}z`
}

function inFinder(r: number, c: number, n: number): boolean {
  return (r < FINDER && c < FINDER) || (r < FINDER && c >= n - FINDER) || (r >= n - FINDER && c < FINDER)
}

interface Geometry {
  n: number
  modules: string
  eyesOuter: string
  eyesInner: string
}

function build(value: string): Geometry | null {
  try {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'M' })
    const { size: n, data } = qr.modules
    let modules = ''
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!data[r * n + c] || inFinder(r, c, n)) continue
        modules += roundedRect(c + QUIET + 0.07, r + QUIET + 0.07, 0.86, 0.86, 0.3)
      }
    }
    let eyesOuter = ''
    let eyesInner = ''
    for (const [r, c] of [
      [0, 0],
      [0, n - FINDER],
      [n - FINDER, 0],
    ]) {
      const x = c + QUIET
      const y = r + QUIET
      // Ring = outer rounded square minus inner one (even-odd fill).
      eyesOuter += roundedRect(x, y, 7, 7, 2.1) + roundedRect(x + 1, y + 1, 5, 5, 1.35)
      eyesInner += roundedRect(x + 2, y + 2, 3, 3, 0.95)
    }
    return { n, modules, eyesOuter, eyesInner }
  } catch {
    return null
  }
}

/** QR code drawn as crisp rounded modules (dark on light, so every phone camera reads it). */
export function QrCode({ value, size, label = 'Codice QR per entrare nella stanza', className }: QrCodeProps) {
  const geo = useMemo(() => build(value), [value])
  if (!geo) return null
  const vb = geo.n + QUIET * 2
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${vb} ${vb}`} width={size} height={size} className={className} shapeRendering="geometricPrecision">
      <path d={geo.modules} fill="var(--color-ink-950)" />
      <path d={geo.eyesOuter} fill="var(--color-ink-950)" fillRule="evenodd" />
      <path d={geo.eyesInner} fill="var(--color-violet-deep)" />
    </svg>
  )
}
