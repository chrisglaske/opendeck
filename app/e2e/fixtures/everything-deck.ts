import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/*
 * A deck with every kind of thing a slide can hold: text in theme and uploaded fonts with
 * bold/italic/underline/links/lists, shapes with fades, shadows and transparency, a dashed
 * arrow, an icon, a rotated group, a cropped and a letterboxed picture, a background picture,
 * the brand logo, and one hidden slide. Imported as a deck file (.odeck) through Home.
 */

const file = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)))
const photo = file('./photo-small.jpg')
const font = file('../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2')

export const EVERYTHING_DECK_NAME = 'Everything deck'
export const UPLOADED_FAMILY = 'Acme Sans'
/** Slides a person sees when presenting (the hidden one is left out). */
export const VISIBLE_SLIDES = 3
export const NOTES = ['Open with the photo.', 'Walk through the shapes.', 'End on the crop.', 'Never shown.']

const box = (id: string, x: number, y: number, w: number, h: number, extra: Record<string, unknown> = {}) =>
  ({ id, x, y, w, h, rotation: 0, locked: false, ...extra })
const text = (id: string, style: string, at: [number, number, number, number], paragraphs: unknown[], extra: Record<string, unknown> = {}) =>
  ({ ...box(id, ...at), type: 'text', style, paragraphs, autoFit: false, ...extra })
const p = (runs: unknown[], extra: Record<string, unknown> = {}) => ({ runs, align: 'left', list: 'none', ...extra })

const slides = [
  {
    id: 'title', notes: NOTES[0], hidden: false,
    background: { color: { theme: 'bg' }, imageId: 'photo' },
    elements: [
      { ...box('veil', 0, 0, 1920, 1080), type: 'shape', shape: 'rect', radius: 0, fill: { theme: 'bg' }, stroke: null, opacity: 0.8 },
      { ...box('logo', 134, 97, 320, 120), type: 'logo' },
      text('title', 'title', [134, 380, 1400, 160], [p([{ text: 'Everything, ' }, { text: 'all at once', italic: true }])]),
      text('custom', 'body', [134, 600, 1300, 260], [
        p([{ text: 'Set in an uploaded font, with ' }, { text: 'bold', bold: true }, { text: ', ' }, { text: 'underline', underline: true }, { text: ' and a ' }, { text: 'link', href: 'https://opendeck.work/' }, { text: '.' }]),
        p([{ text: 'A point in a list' }], { list: 'bullet' }),
        p([{ text: 'Another point, right-aligned color', color: { hex: '#C2410C' } }], { list: 'bullet', align: 'right' }),
      ], { fontFamily: UPLOADED_FAMILY }),
    ],
  },
  {
    id: 'shapes', notes: NOTES[1], hidden: false,
    background: { color: { theme: 'surface' } },
    elements: [
      text('h2', 'heading', [134, 97, 1200, 90], [p([{ text: 'Shapes, lines and icons' }])]),
      { ...box('rect', 134, 260, 480, 320), type: 'shape', shape: 'rect', radius: 'theme', fill: { theme: 'accent' }, stroke: null, shadow: true },
      { ...box('ellipse', 700, 260, 320, 320), type: 'shape', shape: 'ellipse', radius: 0, fill: { theme: 'accentTint' }, stroke: { color: { theme: 'accent' }, width: 8, dash: 'dashed' } },
      { ...box('fade', 1100, 260, 640, 320), type: 'shape', shape: 'rect', radius: 24, fill: { theme: 'accent2' }, stroke: null, fade: 'right' },
      { id: 'arrow', type: 'line', x1: 134, y1: 700, x2: 1000, y2: 760, locked: false, stroke: { color: { theme: 'text' }, width: 6, dash: 'dashed' }, start: 'none', end: 'arrow' },
      { ...box('icon', 1100, 640, 200, 200), type: 'icon', name: 'rocket', color: { theme: 'accent' }, strokeWidth: 1.75 },
      {
        ...box('group', 1400, 640, 380, 300, { rotation: 8 }), type: 'group',
        children: [
          { ...box('g1', 0, 0, 380, 140), type: 'shape', shape: 'rect', radius: 16, fill: { theme: 'text' }, stroke: null },
          text('g2', 'caption', [20, 170, 340, 100], [p([{ text: 'A rotated group' }], { align: 'center' })]),
        ],
      },
    ],
  },
  {
    id: 'pictures', notes: NOTES[2], hidden: false,
    background: { color: { theme: 'bg' } },
    elements: [
      text('h3', 'heading', [134, 97, 1200, 90], [p([{ text: 'Pictures, cropped and fitted' }])]),
      { ...box('crop', 134, 260, 800, 600), type: 'image', assetId: 'photo', fit: 'fill', crop: { x: 0.2, y: 0.1, w: 0.5, h: 0.6 }, radius: 32 },
      { ...box('fit', 1000, 260, 780, 600), type: 'image', assetId: 'photo', fit: 'fit', crop: { x: 0, y: 0, w: 1, h: 1 }, radius: 0, opacity: 0.9 },
      text('cap', 'caption', [134, 900, 1600, 60], [p([{ text: 'Same picture twice, stored once.' }])]),
    ],
  },
  {
    id: 'hidden', notes: NOTES[3], hidden: true,
    background: { color: { theme: 'text' } },
    elements: [text('secret', 'title', [134, 400, 1400, 160], [p([{ text: 'This slide is hidden' }])])],
  },
]

/** The deck as a .odeck file, ready for `setInputFiles`. */
export function everythingDeckFile() {
  const deck = {
    format: 'opendeck', version: 1, id: 'everything', name: EVERYTHING_DECK_NAME,
    theme: { logo: { main: 'photo' } },
    slides, transition: 'fade', createdAt: 0, updatedAt: 0,
  }
  const odeck = {
    format: 'opendeck-deck', version: 1, deck,
    assets: [{ id: 'photo', type: 'image/jpeg', width: 1200, height: 800, data: photo.toString('base64') }],
    fonts: [{ family: UPLOADED_FAMILY, weight: '400', style: 'normal', format: 'woff2', fileName: 'AcmeSans-Regular.woff2', data: font.toString('base64') }],
  }
  return { name: 'everything.odeck', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(odeck)) }
}
