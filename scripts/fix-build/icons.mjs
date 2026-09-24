// Renders the home-screen / install icons from one SVG master with Playwright
// (no image tooling dependency). Output goes to scripts/fix-build/icons/, then gets
// copied to public/ in one go (so other dev servers see a single change).
//   node scripts/fix-build/icons.mjs
import { chromium } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const OUT = new URL('./icons/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

// Same mark as public/favicon.svg (four equalizer bars on a 64 grid), with a neon glow.
const BARS = `
  <rect x="10" y="24" width="8" height="16" rx="4" fill="url(#mv)"/>
  <rect x="22" y="14" width="8" height="36" rx="4" fill="#2ee6ff"/>
  <rect x="34" y="20" width="8" height="24" rx="4" fill="url(#mv)"/>
  <rect x="46" y="28" width="8" height="8" rx="4" fill="#a6ff3f"/>`

/**
 * @param {object} o
 * @param {number} o.scale   bars group scale around the centre (1 = favicon proportions)
 * @param {number} o.radius  corner radius of the plate in grid units (0 = full-bleed square)
 */
function svg({ scale, radius }) {
  const t = `translate(32 32) scale(${scale}) translate(-32 -32)`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%">
  <defs>
    <linearGradient id="mv" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff3fd1"/><stop offset="1" stop-color="#7b5cff"/></linearGradient>
    <radialGradient id="bg" cx="0.5" cy="0.42" r="0.75">
      <stop offset="0" stop-color="#231c4b"/>
      <stop offset="0.55" stop-color="#120e2a"/>
      <stop offset="1" stop-color="#06040f"/>
    </radialGradient>
    <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#7b5cff" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#7b5cff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.10"/>
      <stop offset="0.5" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4"/></filter>
    <clipPath id="plate"><rect width="64" height="64" rx="${radius}"/></clipPath>
  </defs>
  <g clip-path="url(#plate)">
    <rect width="64" height="64" fill="url(#bg)"/>
    <circle cx="32" cy="32" r="${26 * scale}" fill="url(#halo)"/>
    <g transform="${t}" filter="url(#glow)" opacity="0.85">${BARS}</g>
    <g transform="${t}">${BARS}</g>
    <rect width="64" height="64" fill="url(#sheen)"/>
    ${radius ? `<rect x="0.5" y="0.5" width="63" height="63" rx="${radius - 0.5}" fill="none" stroke="#fff" stroke-opacity="0.08"/>` : ''}
  </g>
</svg>`
}

const ICONS = [
  // iOS masks it itself and fills transparency with black: full-bleed square.
  { file: 'apple-touch-icon.png', size: 180, scale: 0.92, radius: 0 },
  // Install icons ("any"): the favicon's rounded plate, transparent corners.
  { file: 'icon-192.png', size: 192, scale: 1, radius: 14 },
  { file: 'icon-512.png', size: 512, scale: 1, radius: 14 },
  // Android adaptive icons: full bleed, mark inside the 80 % safe circle.
  { file: 'icon-maskable-512.png', size: 512, scale: 0.82, radius: 0 },
]

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ deviceScaleFactor: 1 })
for (const icon of ICONS) {
  await page.setViewportSize({ width: icon.size, height: icon.size })
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent"><div id="i" style="width:${icon.size}px;height:${icon.size}px">${svg(icon)}</div></body></html>`,
  )
  const png = await page.locator('#i').screenshot({ omitBackground: true })
  writeFileSync(OUT + icon.file, png)
  console.log(icon.file, png.length, 'bytes')
}
// Preview sheet: every icon, plus the maskable one under a circle and a squircle mask.
const b64 = (f) => `data:image/png;base64,${readFileSync(OUT + f).toString('base64')}`
const tiles = []
for (const icon of ICONS) tiles.push(`<figure><img src="${b64(icon.file)}" width="${Math.min(icon.size, 180)}"><figcaption>${icon.file}</figcaption></figure>`)
tiles.push(`<figure><img src="${b64('icon-maskable-512.png')}" width="180" style="border-radius:50%"><figcaption>maskable · circle</figcaption></figure>`)
tiles.push(`<figure><img src="${b64('apple-touch-icon.png')}" width="180" style="border-radius:40px"><figcaption>apple · iOS mask</figcaption></figure>`)
await page.setViewportSize({ width: 1640, height: 330 })
await page.setContent(
  `<!doctype html><body style="margin:0;padding:24px;background:#3a3a44;display:flex;gap:24px;font:13px system-ui;color:#ddd">${tiles.join('')}</body>`,
)
await page.screenshot({ path: OUT + 'sheet.png' })
await browser.close()
