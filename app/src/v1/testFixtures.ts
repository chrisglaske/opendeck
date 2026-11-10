/** The V1 fixtures (made by e2e/v1/make-fixtures.mjs), for tests. */
import { normalizeV1Projects } from './normalize'
import type { V1Project } from './types'

type Fixture = { openDeckDB_v2: string; openDeckFolders_v1?: string }
const files = import.meta.glob<Fixture>('./fixtures/*.json', { eager: true, import: 'default' })

export const FIXTURE_NAMES = ['all-types', 'edited', 'branded', 'organized', 'legacy', 'demo-untouched', 'demo-edited'] as const

export function v1Fixture(name: (typeof FIXTURE_NAMES)[number]): Fixture {
  return files[`./fixtures/${name}.json`]
}

export function v1Projects(name: (typeof FIXTURE_NAMES)[number]): V1Project[] {
  return normalizeV1Projects(JSON.parse(v1Fixture(name).openDeckDB_v2))
}
