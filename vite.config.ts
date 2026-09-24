import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import type { HtmlTagDescriptor, Logger, Plugin } from 'vite'

// ---- index.html head tags ------------------------------------------------------
//
// The font preloads, resource hints and share-image tags of index.html are
// generated here, so they follow the deploy configuration (VITE_* variables,
// README → Deploy) and the hashed file names of the build.

/**
 * Fonts the home screen paints with: Unbounded (logo, buttons) and Manrope (text).
 * @fontsource only references them from the CSS, so without a preload they are
 * requested once the JS has rendered text and swap in visibly about a second later
 * on a slow phone connection. Latin subsets only: the Italian UI never needs the
 * others. Measured on a throttled phone load (562 ms RTT, 1.44 Mbps): the first
 * paint comes 0.4 s later but is already final (no fallback font, no swap), so
 * the home screen settles 1 s sooner.
 */
const PRELOAD_FONTS = [/(^|\/)unbounded-latin-wght-normal-[\w-]+\.woff2$/, /(^|\/)manrope-latin-wght-normal-[\w-]+\.woff2$/]

/** Share image for link previews (public/og-image.jpg, 1200×630). */
const OG_IMAGE = 'og-image.jpg'

const PEERJS_CLOUD = 'https://0.peerjs.com'
/** Lobby playlists / search: JSONP <script>s (no-cors, the default connection pool). */
const DEEZER_API = 'https://api.deezer.com'
/** Covers and preview MP3s: needed a bit later, DNS is enough. */
const DEEZER_CDNS = ['https://cdn-images.dzcdn.net', 'https://cdnt-preview.dzcdn.net']

type Env = Record<string, string>
const read = (env: Env, key: string): string => (env[key] ?? '').trim()

/**
 * Origin of the signaling server, mirroring src/net/peer.ts (a config it rejects →
 * the cloud). Null for `/` (the page's own host): nothing to warm up.
 */
export function signalingOrigin(env: Env): string | null {
  const rawHost = read(env, 'VITE_PEERJS_HOST')
  if (!rawHost) return PEERJS_CLOUD
  if (rawHost === '/') return null
  try {
    const explicit = /^[a-z]+:\/\//i.test(rawHost)
    const url = new URL(explicit ? rawHost : `wss://${rawHost}`)
    if (!url.hostname) return PEERJS_CLOUD
    // Not set: "same as the page", unknown at build time; deployments are HTTPS.
    let secure = explicit ? url.protocol === 'wss:' || url.protocol === 'https:' : true
    const secureEnv = read(env, 'VITE_PEERJS_SECURE')
    if (/^(1|true|yes|on)$/i.test(secureEnv)) secure = true
    else if (/^(0|false|no|off)$/i.test(secureEnv)) secure = false
    const portEnv = Number(read(env, 'VITE_PEERJS_PORT'))
    const port = Number.isInteger(portEnv) && portEnv > 0 && portEnv < 65_536 ? portEnv : Number(url.port) || 443
    const host = url.host.replace(/:\d+$/, '')
    return `${secure ? 'https' : 'http'}://${host}${port === (secure ? 443 : 80) ? '' : `:${port}`}`
  } catch {
    return PEERJS_CLOUD
  }
}

/** Origin of an http(s) URL from the environment, or null. */
function originOf(raw: string): string | null {
  if (!raw) return null
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null
  } catch {
    return null
  }
}

/** The public site URL (VITE_SITE_URL), normalised to end with a slash, or null. */
function siteUrl(env: Env): string | null {
  const raw = read(env, 'VITE_SITE_URL')
  if (!originOf(raw)) return null
  const url = new URL(raw)
  url.hash = ''
  url.search = ''
  if (!url.pathname.endsWith('/')) url.pathname += '/'
  return url.href
}

const tag = (name: 'link' | 'meta', attrs: Record<string, string | boolean>): HtmlTagDescriptor => ({
  tag: name,
  attrs,
  injectTo: 'head',
})

function headTags(env: Env): Plugin {
  const signaling = signalingOrigin(env)
  const turn = originOf(read(env, 'VITE_TURN_CREDENTIALS_URL'))
  const site = siteUrl(env)
  let logger: Logger | undefined
  return {
    name: 'unshuffle:head-tags',
    configResolved(config) {
      logger = config.logger
      if (read(env, 'VITE_SITE_URL') && !site) logger.warn('[head-tags] VITE_SITE_URL is not an http(s) URL: ignored.')
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        // The app page only (the dev server also serves the lab pages).
        if (ctx.path !== '/index.html') return
        const tags: HtmlTagDescriptor[] = []
        if (ctx.bundle) {
          const files = Object.keys(ctx.bundle)
          for (const re of PRELOAD_FONTS) {
            const file = files.find((f) => re.test(f))
            if (file) tags.push(tag('link', { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: true, href: `./${file}` }))
            else logger?.warn(`[head-tags] no emitted font matches ${re}: its preload was skipped.`)
          }
        }
        // Signaling socket on "Crea stanza" / "Entra" (DNS + TLS session), Deezer in the lobby.
        if (signaling) tags.push(tag('link', { rel: 'preconnect', href: signaling }))
        tags.push(tag('link', { rel: 'preconnect', href: DEEZER_API }))
        // TURN credentials: a CORS fetch without cookies, i.e. the anonymous connection pool.
        if (turn) tags.push(tag('link', { rel: 'preconnect', href: turn, crossorigin: true }))
        for (const origin of DEEZER_CDNS) tags.push(tag('link', { rel: 'dns-prefetch', href: origin }))
        // Link previews: most chat apps (WhatsApp, Facebook…) only load an absolute image
        // URL, which needs VITE_SITE_URL; the relative one still works for the others.
        tags.push(tag('meta', { property: 'og:image', content: site ? new URL(OG_IMAGE, site).href : `./${OG_IMAGE}` }))
        tags.push(tag('meta', { property: 'og:image:type', content: 'image/jpeg' }))
        tags.push(tag('meta', { property: 'og:image:width', content: '1200' }))
        tags.push(tag('meta', { property: 'og:image:height', content: '630' }))
        tags.push(tag('meta', { property: 'og:image:alt', content: 'UNSHUFFLE — la hit è stata fatta a pezzi. Rimettila in ordine.' }))
        if (site) tags.push(tag('meta', { property: 'og:url', content: site }))
        return tags
      },
    },
  }
}

// Static SPA: relative base so the build can be hosted from any sub-path
// (GitHub Pages, Netlify, S3, a plain folder...).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), tailwindcss(), headTags(loadEnv(mode, process.cwd(), 'VITE_'))],
  // Lets several dev servers run side by side without fighting over the dep cache.
  cacheDir: process.env.UNSHUFFLE_VITE_CACHE ?? 'node_modules/.vite',
  worker: { format: 'es' },
  build: { target: 'es2022', sourcemap: true },
  server: { host: true },
}))
