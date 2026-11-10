// Copies the old version (../v1) into the built site at dist/v1, so it keeps running at /v1/.
import { cpSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const from = fileURLToPath(new URL('../../v1', import.meta.url))
const to = fileURLToPath(new URL('../dist/v1', import.meta.url))

if (!existsSync(`${from}/index.html`)) {
  console.error(`copy-v1: ${from}/index.html is missing`)
  process.exit(1)
}
// input.css and tailwind.config.js are only for rebuilding V1's stylesheet.
cpSync(from, to, { recursive: true, filter: (src) => !/(input\.css|tailwind\.config\.js)$/.test(src) })
console.log(`copy-v1: copied ${from} → ${to}`)
