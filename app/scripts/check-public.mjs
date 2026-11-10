// Stops a public site build that still contains the development component gallery (#/design).
// Builds made with VITE_DESIGN_PAGE=1 (the end-to-end tests) keep it on purpose.
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

if (process.env.VITE_DESIGN_PAGE !== '1') {
  const assets = fileURLToPath(new URL('../dist/assets/', import.meta.url))
  const found = readdirSync(assets).filter((f) => f.startsWith('DesignSystemPage'))
  if (found.length) {
    console.error(`check-public: the public build contains ${found.join(', ')}`)
    process.exit(1)
  }
}
console.log('check-public: ok')
