// Album-cover accents for the neon UI. The cover is downsampled to 48×48,
// saturated pixels are clustered in OKLab (k-means), the most vibrant
// meaningful cluster becomes the primary accent and the best contrasting hue
// the secondary. Both are then pushed to high chroma at a lightness that
// glows on the deep violet-black background, gamut-mapped to sRGB.

interface CoverColors {
  /** Vibrant neon-friendly accent (hex). */
  primary: string
  /** Contrasting second accent (hex). */
  secondary: string
  /** Whether the cover is mostly dark. */
  isDark: boolean
}

/** Brand violet / magenta, used when a cover can't be read or has no color. */
export const DEFAULT_COVER_COLORS: Readonly<CoverColors> = Object.freeze({
  primary: '#7b5cff',
  secondary: '#ff3fd1',
  isDark: true,
})

const SAMPLE_SIZE = 48
const LOAD_TIMEOUT_MS = 8000

const pending = new Map<string, Promise<CoverColors>>()
const settled = new Map<string, CoverColors>()

/** Dominant/vibrant colors of a (CORS-enabled) cover image; cached; resolves to defaults on failure. */
export function extractCoverColors(url: string): Promise<CoverColors> {
  if (!url) return Promise.resolve({ ...DEFAULT_COVER_COLORS })
  const known = settled.get(url)
  if (known) return Promise.resolve(known)
  let job = pending.get(url)
  if (!job) {
    job = readCover(url).then(
      (colors) => {
        settled.set(url, colors)
        pending.delete(url)
        return colors
      },
      () => {
        // Not cached: a later call may succeed (e.g. once back online).
        pending.delete(url)
        return { ...DEFAULT_COVER_COLORS }
      },
    )
    pending.set(url, job)
  }
  return job
}

/** Synchronous cache lookup (avoids a flash of default accents for known covers). */
export function peekCoverColors(url: string): CoverColors | undefined {
  return settled.get(url)
}

async function readCover(url: string): Promise<CoverColors> {
  if (typeof document === 'undefined') throw new Error('no DOM')
  const img = await loadImage(sampleUrl(url))
  // Decode off the main thread first: otherwise drawImage decodes synchronously (a long task).
  try {
    await img.decode()
  } catch {
    // Some browsers reject decode() for an image that is already usable: draw it anyway.
  }
  const canvas = document.createElement('canvas')
  canvas.width = SAMPLE_SIZE
  canvas.height = SAMPLE_SIZE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('no 2d context')
  ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
  // Throws SecurityError if the CDN ever stops sending CORS headers.
  return colorsFromPixels(ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data)
}

/** Deezer CDN covers come in any size: 250px is plenty for a 48px sample. */
function sampleUrl(url: string): string {
  return /dzcdn\.net\//.test(url) ? url.replace(/\/\d{2,4}x\d{2,4}-/, '/250x250-') : url
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    const timer = setTimeout(() => {
      img.onload = img.onerror = null
      img.src = ''
      reject(new Error('timeout'))
    }, LOAD_TIMEOUT_MS)
    img.onload = () => {
      clearTimeout(timer)
      resolve(img)
    }
    img.onerror = () => {
      clearTimeout(timer)
      reject(new Error('load failed'))
    }
    img.src = src
  })
}

// ─── Color math (OKLab / OKLCH) ──────────────────────────────────────────────

type Lab = [number, number, number]

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

function linearToOklab(r: number, g: number, b: number): Lab {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

function oklabToLinear(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

function lchToLinear(L: number, C: number, hDeg: number): [number, number, number] {
  const h = (hDeg * Math.PI) / 180
  return oklabToLinear(L, C * Math.cos(h), C * Math.sin(h))
}

function inGamut(L: number, C: number, h: number): boolean {
  const eps = 1e-4
  return lchToLinear(L, C, h).every((v) => v >= -eps && v <= 1 + eps)
}

/** Largest in-gamut chroma for a lightness/hue (binary search). */
function maxChroma(L: number, h: number): number {
  let lo = 0
  let hi = 0.4
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2
    if (inGamut(L, mid, h)) lo = mid
    else hi = mid
  }
  return lo
}

function lchToHex(L: number, C: number, h: number): string {
  const channel = (v: number) =>
    Math.round(Math.min(1, Math.max(0, toGamma(Math.min(1, Math.max(0, v))))) * 255)
      .toString(16)
      .padStart(2, '0')
  const [r, g, b] = lchToLinear(L, C, h)
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

const hueOf = (a: number, b: number) => ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360
const hueDistance = (x: number, y: number) => {
  const d = Math.abs(x - y) % 360
  return d > 180 ? 360 - d : d
}

/**
 * The hue as a glowing accent: the lightness where this hue reaches its
 * strongest chroma (clamped to a range that reads on a near-black UI, pulled
 * toward a common level so accents feel like one family), at ~95 % of the
 * gamut's max chroma.
 */
function neon(h: number): string {
  let bestL = 0.74
  let bestC = -1
  for (let L = 0.62; L <= 0.9; L += 0.01) {
    const c = maxChroma(L, h)
    if (c > bestC + 1e-4) {
      bestC = c
      bestL = L
    }
  }
  const L = Math.min(0.9, Math.max(0.68, bestL * 0.75 + 0.74 * 0.25))
  return lchToHex(L, maxChroma(L, h) * 0.95, h)
}

// ─── Clustering ──────────────────────────────────────────────────────────────

interface Cluster {
  L: number
  a: number
  b: number
  C: number
  h: number
  /** Share of all opaque pixels. */
  share: number
}

const MIN_CHROMA = 0.04
const MIN_COLORFUL_SHARE = 0.03
const K = 6
const ITERATIONS = 10

function nearest(p: Lab, centers: readonly Lab[]): number {
  let best = 0
  let bestD = Infinity
  for (let c = 0; c < centers.length; c++) {
    const q = centers[c]
    // Lightness matters less than hue/chroma for picking accents.
    const d = 0.5 * (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2
    if (d < bestD) {
      bestD = d
      best = c
    }
  }
  return best
}

function kmeans(points: readonly Lab[], total: number): Cluster[] {
  const mean = (groups: number[][]) => groups.filter((g) => g[3] > 0).map((g): Lab => [g[0] / g[3], g[1] / g[3], g[2] / g[3]])
  const accumulate = (groups: number[][], p: Lab, into: number) => {
    const g = groups[into]
    g[0] += p[0]
    g[1] += p[1]
    g[2] += p[2]
    g[3]++
  }
  // Deterministic init: the mean of each 60° hue sector that has pixels.
  const sectors = Array.from({ length: K }, () => [0, 0, 0, 0])
  for (const p of points) accumulate(sectors, p, Math.min(K - 1, Math.floor(hueOf(p[1], p[2]) / (360 / K))))
  let centers = mean(sectors)

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const groups = centers.map(() => [0, 0, 0, 0])
    for (const p of points) accumulate(groups, p, nearest(p, centers))
    const next = mean(groups)
    const stable = next.length === centers.length && next.every((c, i) => c.every((v, j) => Math.abs(v - centers[i][j]) < 1e-5))
    centers = next
    if (stable) break
  }

  const counts = new Array<number>(centers.length).fill(0)
  for (const p of points) counts[nearest(p, centers)]++
  return centers.map(([L, a, b], i) => ({ L, a, b, C: Math.hypot(a, b), h: hueOf(a, b), share: counts[i] / total }))
}

/**
 * Accent colors from raw RGBA pixels (e.g. ImageData.data). Pure and
 * deterministic; exported for tests.
 */
export function colorsFromPixels(rgba: ArrayLike<number>): CoverColors {
  const colorful: Lab[] = []
  let opaque = 0
  let lightnessSum = 0
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue
    const lab = linearToOklab(toLinear(rgba[i] / 255), toLinear(rgba[i + 1] / 255), toLinear(rgba[i + 2] / 255))
    opaque++
    lightnessSum += lab[0]
    if (lab[0] >= 0.18 && lab[0] <= 0.97 && Math.hypot(lab[1], lab[2]) >= MIN_CHROMA) colorful.push(lab)
  }
  if (opaque === 0) return { ...DEFAULT_COVER_COLORS }
  const isDark = lightnessSum / opaque < 0.55
  // Black-and-white / greyscale covers: keep the brand accents.
  if (colorful.length / opaque < MIN_COLORFUL_SHARE) return { ...DEFAULT_COVER_COLORS, isDark }

  const clusters = kmeans(colorful, opaque).filter((c) => c.share >= 0.015)
  if (clusters.length === 0) return { ...DEFAULT_COVER_COLORS, isDark }
  const murk = (L: number) => Math.min(1, Math.max(0.35, (L - 0.15) / 0.35))
  // Skin tones are everywhere on photo covers but rarely the cover's "color".
  const skin = (c: Cluster) => (c.h >= 35 && c.h <= 85 && c.C < 0.11 ? 0.45 : 1)
  const vibrancy = (c: Cluster) => c.C ** 1.2 * Math.sqrt(c.share) * murk(c.L) * skin(c)

  const primary = clusters.reduce((best, c) => (vibrancy(c) > vibrancy(best) ? c : best))
  let secondaryHue: number | null = null
  let bestScore = 0
  for (const c of clusters) {
    const dist = hueDistance(c.h, primary.h)
    if (c === primary || dist < 38 || c.C < 0.045) continue
    const score = vibrancy(c) * (0.4 + dist / 120)
    if (score > bestScore) {
      bestScore = score
      secondaryHue = c.h
    }
  }
  if (secondaryHue === null) {
    // Monochrome palette: an analogous neighbour, rotated toward the violet/magenta
    // end of the wheel so it sits naturally in the club palette.
    const up = (primary.h + 58) % 360
    const down = (primary.h + 302) % 360
    secondaryHue = hueDistance(up, 320) <= hueDistance(down, 320) ? up : down
  }
  return { primary: neon(primary.h), secondary: neon(secondaryHue), isDark }
}
