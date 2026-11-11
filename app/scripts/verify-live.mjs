// Checks that opendeck.work serves exactly what this code builds: every file in dist (the
// landing page, the app, the old version at /v1/ and all their scripts, styles, fonts and
// pictures), byte for byte. Anyone can run it; it only reads public URLs.
//   npm run build:site && npm run verify:live [-- origin]
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const origin = (process.argv[2] || 'https://opendeck.work').replace(/\/$/, '')
const dist = fileURLToPath(new URL('../dist', import.meta.url))
// Cloudflare reads these as settings and never serves them.
const SETTINGS = new Set(['/_redirects', '/_headers'])

const files = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name)
  return statSync(path).isDirectory() ? files(path) : [path]
})
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')

let paths
try {
  paths = files(dist).map((path) => '/' + relative(dist, path).split(sep).join('/')).filter((p) => !SETTINGS.has(p)).sort()
} catch {
  console.error(`verify-live: ${dist} is missing; run npm run build:site first`)
  process.exit(1)
}

let failed = 0
for (const path of paths) {
  // A page is served at its folder's address, e.g. /app/index.html at /app/.
  const url = origin + path.replace(/(^|\/)index\.html$/, '$1')
  let verdict
  try {
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) verdict = `missing (${response.status})`
    else verdict = sha(Buffer.from(await response.arrayBuffer())) === sha(readFileSync(join(dist, path))) ? 'same' : 'DIFFERENT'
  } catch (error) {
    verdict = `unreachable (${error.message})`
  }
  if (verdict !== 'same') failed += 1
  console.log(verdict.padEnd(12), path)
}
console.log(failed
  ? `\n${failed} of ${paths.length} files differ from ${origin}.`
  : `\nAll ${paths.length} files ${origin} serves match this build.`)
process.exit(failed ? 1 : 0)
