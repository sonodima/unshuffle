// The whole app in pseudo-Italian (tests/e2e/pseudo/generate.mjs): the app's own
// config, with the Italian catalog import (`./locales/it` in src/i18n/index.ts)
// resolved to the generated pseudo catalog. Italian stays the source locale, so every
// screen, fallback and `<html lang="it-IT">` behaves exactly as in the real app.
//
//   npx vite --config tests/e2e/pseudo/vite.config.ts --port 5621
//   node tests/e2e/i18n-bounds.mjs http://localhost:5621/ pseudo
//
// The pseudo catalog is regenerated at startup and whenever a file of
// src/i18n/locales/it changes (the page then reloads). Run it from the repo root.
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mergeConfig, type ConfigEnv, type Plugin, type UserConfig } from 'vite'
import appConfig from '../../../vite.config.ts'
import { PSEUDO_FILE, generatePseudo } from './generate.mjs'

const ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const IT_DIR = resolve(ROOT, 'src/i18n/locales/it')

function pseudoItalian(): Plugin {
  return {
    name: 'unshuffle:pseudo-it',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || !/locales\/it(\/index(\.ts)?)?$/.test(source)) return null
      const target = resolve(importer.replace(/[?#].*$/, ''), '..', source).replace(/\/index(\.ts)?$/, '')
      return target === IT_DIR ? PSEUDO_FILE : null
    },
    configureServer(server) {
      server.watcher.add(IT_DIR)
      server.watcher.on('change', (file) => {
        if (!file.startsWith(IT_DIR)) return
        void generatePseudo({ fresh: true }).then(
          () => server.config.logger.info('[pseudo-it] regenerated the pseudo catalog', { timestamp: true }),
          (err: unknown) => server.config.logger.error(`[pseudo-it] ${String(err)}`),
        )
      })
    },
  }
}

export default async (env: ConfigEnv): Promise<UserConfig> => {
  // Before anything resolves (the dependency scan included), the file must exist.
  await generatePseudo()
  // The app config is a function of the mode (it reads VITE_* variables).
  const base = typeof appConfig === 'function' ? await appConfig(env) : appConfig
  return mergeConfig(base, {
    root: ROOT,
    // Its own dependency cache: a normal dev server may run next to this one.
    cacheDir: resolve(ROOT, 'node_modules/.vite-pseudo'),
    plugins: [pseudoItalian()],
  } satisfies UserConfig)
}
