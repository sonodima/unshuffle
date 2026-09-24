// Color helpers for the background: hex parsing, OKLab/OKLCH conversions and the
// "neon-safe" normalization that keeps any accent (e.g. a grey album cover)
// luminous enough to glow on a near-black background.

/** Linear-light RGB, components 0..1. */
export type Rgb = [number, number, number]
/** OKLab: L 0..1, a/b roughly −0.4..0.4. */
export type Lab = [number, number, number]

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const linearToSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)

/** Parses #rgb, #rgba, #rrggbb, #rrggbbaa (alpha ignored). Returns null when invalid. */
export function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3,8})$/i.exec(hex.trim())
  if (!m) return null
  let h = m[1]
  if (h.length === 3 || h.length === 4) h = [...h.slice(0, 3)].map((c) => c + c).join('')
  else if (h.length === 8) h = h.slice(0, 6)
  else if (h.length !== 6) return null
  const n = parseInt(h, 16)
  return [srgbToLinear(((n >> 16) & 255) / 255), srgbToLinear(((n >> 8) & 255) / 255), srgbToLinear((n & 255) / 255)]
}

export function toHex(rgb: Rgb): string {
  return (
    '#' +
    rgb
      .map((c) =>
        Math.round(clamp01(linearToSrgb(clamp01(c))) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  )
}

export function rgbToOklab([r, g, b]: Rgb): Lab {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

export function oklabToRgb([L, a, b]: Lab): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

/** Largest-chroma-preserving gamut clip: shrink chroma until the color fits in sRGB. */
function fitGamut(lab: Lab): Rgb {
  let [L, a, b] = lab
  for (let i = 0; i < 24; i++) {
    const rgb = oklabToRgb([L, a, b])
    if (rgb.every((c) => c >= -1e-4 && c <= 1 + 1e-4)) return rgb.map(clamp01) as Rgb
    a *= 0.92
    b *= 0.92
  }
  L = clamp01(L)
  return oklabToRgb([L, 0, 0]).map(clamp01) as Rgb
}

/** OKLCH hue of the brand violet (#7b5cff), radians. */
const BRAND_HUE = (286 * Math.PI) / 180
const GREY_CHROMA = 0.05

/**
 * Makes an arbitrary color usable as a neon light: lightness pulled into a glowing
 * band and a minimum chroma for colored inputs; greys get a faint brand-violet tint.
 */
export function neonize(rgb: Rgb, minL = 0.6, maxL = 0.84, minChroma = 0.11): Rgb {
  const [L, a, b] = rgbToOklab(rgb)
  const c = Math.hypot(a, b)
  const nl = Math.min(maxL, Math.max(minL, L))
  let na = a
  let nb = b
  if (c > 0.02 && c < minChroma) {
    na = (a / c) * minChroma
    nb = (b / c) * minChroma
  } else if (c <= 0.02) {
    // Greys become a cool silver-violet instead of dead grey.
    const k = 1 - c / 0.02
    na = a + Math.cos(BRAND_HUE) * GREY_CHROMA * k
    nb = b + Math.sin(BRAND_HUE) * GREY_CHROMA * k
  }
  return fitGamut([nl, na, nb])
}

/** Hue-rotated sibling (OKLCH), used to derive the third light when only two accents are given. */
export function rotateHue(rgb: Rgb, degrees: number, L = 0.84, minChroma = 0.12): Rgb {
  const [, a, b] = rgbToOklab(rgb)
  const c = Math.max(minChroma, Math.min(0.16, Math.hypot(a, b)))
  const h = Math.atan2(b, a) + (degrees * Math.PI) / 180
  return fitGamut([L, Math.cos(h) * c, Math.sin(h) * c])
}

/** Yellow-ish OKLCH hue (radians): the family that turns to mud/brown when dark. */
const MUD_HUE = (85 * Math.PI) / 180

const wrapAngle = (x: number) => Math.atan2(Math.sin(x), Math.cos(x))

/**
 * Shadow tone for split toning. Dark yellows/oranges/olives read as brown, so their
 * hue is turned towards the brand violet (up to `maxShift`°, shortest way round,
 * never through grey) with a rich chroma. Neon hues (magenta, violet, blue, cyan)
 * are left as they are.
 */
export function shadeOf(rgb: Rgb, maxShift = 70, minChroma = 0.15): Rgb {
  const [L, a, b] = rgbToOklab(rgb)
  const c = Math.max(minChroma, Math.hypot(a, b))
  const h = Math.atan2(b, a)
  const mud = Math.exp(-((wrapAngle(h - MUD_HUE) / ((60 * Math.PI) / 180)) ** 2))
  const lim = ((maxShift * Math.PI) / 180) * mud
  const d = wrapAngle(BRAND_HUE - h)
  const nh = h + Math.max(-lim, Math.min(lim, d))
  return fitGamut([L, Math.cos(nh) * c, Math.sin(nh) * c])
}

/** Perceptual interpolation (OKLab) between two linear RGB colors. */
export function mixOklab(from: Rgb, to: Rgb, t: number): Rgb {
  const a = rgbToOklab(from)
  const b = rgbToOklab(to)
  const k = clamp01(t)
  return oklabToRgb([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]).map(clamp01) as Rgb
}
