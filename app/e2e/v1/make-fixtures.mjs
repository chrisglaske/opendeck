// Builds the V1 fixtures in src/v1/fixtures by running the V1 app (the repo root) in Chromium and
// driving it through its own functions, so every fixture is data V1 itself wrote. Each fixture is
// the raw localStorage value of `openDeckDB_v2` (and `openDeckFolders_v1` where used). Next to it,
// `<name>.expected.json` holds V1's own normalized result (`migrateProjectsDatabase`), which the
// TypeScript port is tested against.
//
// Run by hand from app/:  node e2e/v1/make-fixtures.mjs
import { createReadStream, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const OUT = fileURLToPath(new URL('../../src/v1/fixtures/', import.meta.url))
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
}

const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '')
  let file = join(ROOT, path)
  try {
    if (statSync(file).isDirectory()) file = join(file, 'index.html')
    statSync(file)
  } catch {
    res.writeHead(404).end()
    return
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
  createReadStream(file).pipe(res)
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const BASE = `http://127.0.0.1:${server.address().port}/`

const browser = await chromium.launch()
const page = await browser.newPage()
// Outside requests (CDN fonts, icon kits) are not needed to build the data.
await page.route((url) => !url.href.startsWith(BASE), (r) => r.abort())
page.on('pageerror', (e) => console.error('page error:', e.message))

/** A fresh V1 with no data. `demo: false` marks the demo deck as already seeded so V1 doesn't add it. */
async function fresh({ demo = false } = {}) {
  await page.goto(BASE)
  await page.evaluate((demo) => {
    localStorage.clear()
    if (!demo) localStorage.setItem('openDeckDemoSeeded', 'true')
  }, demo)
  await page.goto(BASE)
  await page.waitForFunction(() => typeof window.addSlide === 'function' && typeof window.migrateProjectsDatabase === 'function')
}

async function save(name, { withFolders = false } = {}) {
  const raw = await page.evaluate(() => ({
    projects: localStorage.getItem('openDeckDB_v2'),
    folders: localStorage.getItem('openDeckFolders_v1'),
  }))
  const fixture = { openDeckDB_v2: raw.projects, ...(withFolders ? { openDeckFolders_v1: raw.folders } : {}) }
  await writeFixture(name, fixture)
}

async function writeFixture(name, fixture) {
  const expected = await page.evaluate((raw) => migrateProjectsDatabase(JSON.parse(raw)).projects, fixture.openDeckDB_v2)
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(fixture, null, 2) + '\n')
  writeFileSync(join(OUT, `${name}.expected.json`), JSON.stringify(expected, null, 2) + '\n')
  console.log('wrote', name)
}

const ALL_TYPES = [
  'intro', 'split', 'grid', 'list', 'code', 'cta', 'glass_intro', 'comparison', 'showcase_window', 'roadmap_cards',
  'corp_title', 'corp_quote', 'corp_image_text', 'corp_basic', 'corp_team', 'pitch_pricing', 'pitch_hero', 'pitch_stats',
  'pitch_timeline',
]

/** Makes a new project through V1's "New presentation", names it, and adds the given slide types. */
async function newProject(name, types) {
  await page.evaluate(([name, types]) => {
    createNewProject()
    projects.find((p) => p.id === activeProjectId).name = name
    for (const t of types) addSlide(t)
  }, [name, types])
}

const back = () => page.evaluate(() => returnToDashboard())

/** Uploads a small generated picture through V1's own upload handler and waits for V1 to store it. */
async function upload(slideIndex, key, arrayName = null, index = null, color = '#E8590C') {
  await page.evaluate(async ([slideIndex, key, arrayName, index, color]) => {
    currentSlideId = slides[slideIndex].id
    const canvas = document.createElement('canvas')
    canvas.width = 48
    canvas.height = 32
    const g = canvas.getContext('2d')
    g.fillStyle = color
    g.fillRect(0, 0, 48, 32)
    g.fillStyle = '#ffffff'
    g.fillRect(8, 8, 16, 16)
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'))
    const file = new File([blob], 'picture.png', { type: 'image/png' })
    handleImageUpload({ target: { files: [file] } }, key, arrayName, index)
  }, [slideIndex, key, arrayName, index, color])
  await page.waitForFunction(([slideIndex, key, arrayName, index]) => {
    const s = slides[slideIndex]
    const v = arrayName === null ? s[key] : s[arrayName][index][key]
    return typeof v === 'string' && v.startsWith('data:image/')
  }, [slideIndex, key, arrayName, index])
}

mkdirSync(OUT, { recursive: true })

// 1. Every V1 slide type at its defaults.
await fresh()
await newProject('Every slide type', ALL_TYPES)
await back()
await save('all-types')

// 2. Every type with edited text (line breaks included), notes, pictures and a link.
await fresh()
await newProject('Edited deck', ALL_TYPES)
await page.evaluate((types) => {
  const at = (type) => slides.findIndex((s, i) => i > 0 && s.type === type)
  const edit = (type, fields, arrays = {}) => {
    currentSlideId = slides[at(type)].id
    for (const [k, v] of Object.entries(fields)) updateSlide(k, v)
    for (const [arr, items] of Object.entries(arrays)) {
      items.forEach((patch, i) => {
        if (typeof patch === 'string') updateArrayPrimitive(arr, i, patch)
        else for (const [k, v] of Object.entries(patch)) updateArrayItem(arr, i, k, v)
      })
    }
  }
  for (const t of types) edit(t, { title: `Edited ${t} title`, notes: `Say this about ${t}.\nSecond line of notes.` })
  edit('intro', { subtitle: 'Jamie Rivera\nHead of Product', icon: 'fa-rocket' })
  edit('split', { subtitle: 'First line\nSecond line', boxTitle: 'Result', boxText: 'Cut prep time by 70%', boxIcon: 'fa-chart-line' },
    { bullets: ['Faster onboarding', 'Fewer handoffs'] })
  edit('grid', { subtitle: 'Three areas' }, { cards: [{ title: 'Speed', text: 'Ships daily', icon: 'fa-bolt' }, { title: 'Trust', text: 'Audited', icon: 'fa-shield-halved' }] })
  edit('list', { subtitle: 'Status' }, { items: [{ label: 'Write content', value: 'DONE' }] })
  edit('code', { codeHeader: 'deploy.sh', codeContent: 'npm run build\nnpm run deploy' })
  edit('cta', { subtitle: 'Sign up today', link: 'https://example.com/signup', icon: 'fa-envelope' })
  edit('glass_intro', { kicker: 'Launch', subtitle: 'A new way\nto present' }, { badges: [{ text: 'Private' }, { text: 'Fast', icon: 'fa-bolt' }] })
  edit('comparison', { leftTitle: 'Before', leftText: 'Manual', rightTitle: 'After', rightText: 'Automatic' },
    { leftPoints: ['Slow', 'Error-prone'], rightPoints: ['Quick', 'Consistent'] })
  edit('showcase_window', { windowTitle: 'config.yaml', codeContent: 'mode: live\nlevel: 2' }, { bullets: ['Set the scene'] })
  edit('roadmap_cards', { kicker: 'Plan' }, { phases: [{ title: 'Now', text: 'Build the base', status: 'Current' }] })
  edit('corp_title', { subtitle: 'Quarterly review', author: 'Sam Lee' })
  edit('corp_quote', { title: 'It changed how our team works.', author: 'Alex Kim, COO' })
  edit('corp_image_text', { subtitle: 'Our new office' }, { bullets: ['Opened in May'] })
  edit('corp_basic', { subtitle: 'Paragraph one.\n\nParagraph two.' })
  edit('corp_team', { subtitle: 'Who we are' }, { team: [{ name: 'Priya Shah', role: 'CEO' }] })
  edit('pitch_pricing', { subtitle: 'Simple plans' }, { tiers: [{ name: 'Basic', price: '$9', feature: 'Core features' }] })
  edit('pitch_hero', { kicker: 'Big idea', subtitle: 'Food without waste' })
  edit('pitch_stats', { subtitle: 'This year' }, { stats: [{ value: '42k', label: 'Users' }] })
  edit('pitch_timeline', { subtitle: 'History' }, { timeline: [{ year: '2024', text: 'Founded' }] })
}, ALL_TYPES)
const idx = (type) => page.evaluate((type) => slides.findIndex((s, i) => i > 0 && s.type === type), type)
await upload(await idx('split'), 'image')
await upload(await idx('corp_image_text'), 'image', null, null, '#3B82F6')
await upload(await idx('corp_team'), 'image', 'team', 0, '#10B981')
await upload(await idx('grid'), 'image', 'cards', 1, '#8B5CF6')
await back()
await save('edited')

// 3. Branding: custom accent, Playfair Display, a logo, header text and badge.
await fresh()
await newProject('Branded deck', ['split'])
await page.evaluate(() => {
  updateGlobalSetting('theme', '#E8590C')
  updateGlobalSetting('font', "'Playfair Display', serif")
  updateGlobalSetting('headerText', 'Northwind')
  updateGlobalSetting('headerIcon', 'NW')
})
await page.evaluate(async () => {
  const canvas = document.createElement('canvas')
  canvas.width = 40
  canvas.height = 40
  const g = canvas.getContext('2d')
  g.fillStyle = '#E8590C'
  g.beginPath()
  g.arc(20, 20, 16, 0, Math.PI * 2)
  g.fill()
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'))
  handlePresentationLogoUpload({ target: { files: [new File([blob], 'logo.png', { type: 'image/png' })] } })
})
await page.waitForFunction(() => globalSettings.companyLogo.startsWith('data:image/'))
await back()
await save('branded')

// 4. Folders and tags, including a project in a folder that no longer exists.
await fresh()
const folderNames = ['Clients', 'Internal', 'Old stuff']
page.on('dialog', (d) => (d.type() === 'prompt' ? d.accept(folderNames.shift()) : d.accept()))
for (let i = 0; i < 3; i++) await page.evaluate(() => createFolder())
for (const name of ['Acme pitch', 'Team offsite', 'Loose deck', 'Orphaned deck']) {
  await newProject(name, [])
  await back()
}
await page.evaluate(() => {
  const byName = (n) => projects.find((p) => p.name === n)
  const folder = (n) => folders.find((f) => f.name === n)
  const tag = (n, tags) => {
    openTagModal(byName(n).id, { stopPropagation() {} })
    document.getElementById('tagInput').value = tags
    saveTags()
  }
  const drop = (n, f) => dropProjectToFolder({ preventDefault() {}, currentTarget: document.body, dataTransfer: { getData: () => byName(n).id } }, folder(f).id)
  drop('Acme pitch', 'Clients')
  drop('Team offsite', 'Internal')
  drop('Orphaned deck', 'Old stuff')
  tag('Acme pitch', 'sales, Q4')
  tag('Loose deck', 'draft')
  // V1's own folder delete moves projects out; a stale folder id only arrives through imports.
  folders = folders.filter((f) => f.name !== 'Old stuff')
  saveProjects(false)
})
await save('organized', { withFolders: true })

// 5. Pre-schema shapes, hand-written (V1 still normalizes them).
await fresh()
await writeFixture('legacy', {
  openDeckDB_v2: JSON.stringify([
    { id: 'proj_legacy1', name: 'Old glass deck', lastModified: 1700000000000, data: { slides: [
      { id: 'slide_a', type: 'glass_intro', title: 'Hello', tags: [{ text: 'Legacy tag', icon: 'fa-star' }, {}] },
      { id: 'slide_b', type: 'split', bullets: ['One', 7], image: 42 },
      { type: 'pitch_stats', stats: [] },
      { id: 'slide_d', type: 'grid', cards: [{ title: 'Only title' }], transition: 'spin', bgOverride: 'bg-neon' },
      null,
    ] } },
    { id: 'proj_legacy2', name: 'No slides', lastModified: 1700000001000, data: {} },
    { name: 'No id', data: { slides: [{ id: 's1', type: 'intro', title: 'Kept' }] }, tags: ['x', 3, ''] },
    'not a project',
    { id: 'proj_legacy1', name: 'Duplicate id', lastModified: 1700000002000, data: { slides: [] } },
  ]),
})

// 6. V1's demo deck, as created and with one title changed.
await fresh({ demo: true })
await page.evaluate(() => createDemoProject())
await save('demo-untouched')
await page.evaluate(() => {
  openProject(projects[0].id)
  currentSlideId = slides[0].id
  updateSlide('title', 'Our own pitch')
  returnToDashboard()
})
await save('demo-edited')

await browser.close()
server.close()
