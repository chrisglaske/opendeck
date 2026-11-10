import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { build } from 'vite'
import type { Plugin, ResolvedConfig } from 'vite'

/** The player for downloaded HTML files: one classic script and one stylesheet, inlined by the export. */
export type PlayerBundle = { js: string; css: string }

export const PLAYER_BUNDLE_FILE = 'player-bundle.json'

const appRoot = resolve(import.meta.dirname, '..')
const entry = resolve(appRoot, 'src/player/main.tsx')

type Output = { type: 'chunk'; code: string; fileName: string } | { type: 'asset'; source: string | Uint8Array; fileName: string }

/** Builds the player on its own, the way the export needs it: no files written, no network URLs. */
export async function bundlePlayer(): Promise<PlayerBundle> {
  const result = await build({
    configFile: false,
    root: appRoot,
    logLevel: 'silent',
    mode: 'production',
    plugins: [react()],
    define: { 'process.env.NODE_ENV': '"production"' },
    build: {
      write: false,
      emptyOutDir: false,
      minify: true,
      cssCodeSplit: false,
      assetsInlineLimit: 0,
      modulePreload: false,
      copyPublicDir: false,
      rollupOptions: {
        input: entry,
        output: { format: 'iife', name: 'OpenDeckPlayer' },
      },
    },
  })
  const outputs = (Array.isArray(result) ? result : [result]) as unknown as { output: Output[] }[]
  const files = outputs.flatMap((r) => r.output)
  const text = (o: Output) => (o.type === 'chunk' ? o.code : typeof o.source === 'string' ? o.source : new TextDecoder().decode(o.source))
  const js = files.filter((f) => f.type === 'chunk').map(text).join('\n')
  const css = files.filter((f) => f.fileName.endsWith('.css')).map(text).join('\n')
  const other = files.filter((f) => f.type === 'asset' && !f.fileName.endsWith('.css'))
  if (other.length) throw new Error(`The player must not need extra files: ${other.map((f) => f.fileName).join(', ')}`)
  return { js: inlineSafeJs(js), css }
}

/**
 * The player is inlined in a <script>, so it must never close that tag early, and must not
 * contain `<!--`, which can change how the browser reads the rest of the script.
 */
export function inlineSafeJs(js: string): string {
  if (js.includes('<!--')) throw new Error('The player script must not contain "<!--"')
  return js.replace(/<\/script/gi, '<\\/script')
}

/**
 * Serves the player bundle at `<base>player-bundle.json`: emitted into the build, and built on
 * request (then cached until a source file changes) on the dev server.
 */
export function playerPlugin(): Plugin {
  let config: ResolvedConfig
  let bundle: Promise<PlayerBundle> | null = null
  return {
    name: 'opendeck-player',
    configResolved(c) { config = c },
    async generateBundle() {
      this.emitFile({ type: 'asset', fileName: PLAYER_BUNDLE_FILE, source: JSON.stringify(await bundlePlayer()) })
    },
    configureServer(server) {
      server.watcher.on('change', () => { bundle = null })
      server.middlewares.use(`${config.base}${PLAYER_BUNDLE_FILE}`, (_req, res, next) => {
        bundle ??= bundlePlayer()
        bundle.then(
          (b) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(b)) },
          (e: unknown) => { bundle = null; next(e) },
        )
      })
    },
  }
}
