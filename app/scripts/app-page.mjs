// Serves the built page at /app/ too: the app (Home and the editor) lives there, the start page at /.
// Same page and assets; only the tab title and a noindex hint differ (the start page is what search shows).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const html = readFileSync(`${dist}index.html`, 'utf8')
const page = html
  .replace(/<title>[^<]*<\/title>/, '<title>OpenDeck</title>')
  .replace('<meta name="viewport"', '<meta name="robots" content="noindex" />\n    <meta name="viewport"')
if (page === html || !page.includes('<title>OpenDeck</title>') || !page.includes('content="noindex"')) {
  console.error('app-page: could not adapt dist/index.html')
  process.exit(1)
}
mkdirSync(`${dist}app`, { recursive: true })
writeFileSync(`${dist}app/index.html`, page)
console.log('app-page: wrote dist/app/index.html')
