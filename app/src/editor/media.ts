import { createImage } from '../model/factory'
import { coverCrop } from '../model/geometry'
import { addElements, updateElements, updateSlide } from '../model/ops'
import type { ImageEl, Point } from '../model/types'
import { getDeckStore } from '../storage/appStore'
import { ACCEPTED, ImageTooLargeError, importImage, rememberImageSize, UnsupportedImageError } from '../storage/assets'
import { toast } from '../ui'
import { SAVE_ERROR_TEXT } from './SaveStatus'
import type { EditorStore } from './store'

/** Opens the system file picker for images. */
export function pickImageFile(onPick: (file: File) => void) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = ACCEPTED.join(',')
  input.addEventListener('change', () => {
    const f = input.files?.[0]
    if (f) onPick(f)
  })
  input.click()
}

/** Image files in a drop or paste, in order. */
export const imageFiles = (files: FileList | File[] | null | undefined): File[] =>
  Array.from(files ?? []).filter((f) => f.type.startsWith('image/'))

/** Stores an image, telling the person what went wrong when it can't be used. */
export async function saveImageFile(file: Blob) {
  toast('Adding image…', { durationMs: 2000 })
  try {
    const r = await importImage(await getDeckStore(), file)
    rememberImageSize(r.assetId, { w: r.width, h: r.height })
    if (r.notSaved) toast(`Image added, but not saved. ${SAVE_ERROR_TEXT[r.notSaved]}`, { durationMs: 8000 })
    return r
  } catch (e) {
    if (e instanceof UnsupportedImageError || e instanceof ImageTooLargeError) toast(e.message)
    else toast("Couldn't add that image. Try again, or try another file.")
    return null
  }
}

/** Adds images to the current slide, centered on `at` when given, and selects them. */
export async function addImages(editor: EditorStore, files: File[], at?: Point) {
  const slideId = editor.getState().selection.slideId
  const els: ImageEl[] = []
  for (const [i, f] of files.entries()) {
    const r = await saveImageFile(f)
    if (!r) continue
    const el = createImage(r.assetId, { w: r.width, h: r.height })
    if (at) {
      el.x = Math.round(at.x - el.w / 2 + i * 24)
      el.y = Math.round(at.y - el.h / 2 + i * 24)
    }
    els.push(el)
  }
  if (!els.length) return
  editor.apply((d) => addElements(d, slideId, els), { selection: { slideId, ids: els.map((e) => e.id) } })
}

/**
 * Swaps the picture in an image box. The box keeps its place, size, corners and fit; the new
 * picture is cropped to fill it. A sample picture becomes an ordinary one.
 */
export async function replaceImage(editor: EditorStore, slideId: string, id: string, file: File) {
  const r = await saveImageFile(file)
  if (!r) return
  editor.apply((d) =>
    updateElements(d, slideId, [id], (e) => {
      if (e.type !== 'image') return e
      const { art: _art, sample: _sample, ...rest } = e
      return { ...rest, assetId: r.assetId, crop: coverCrop({ w: r.width, h: r.height }, { w: e.w, h: e.h }) }
    }),
  )
}

export async function setBackgroundImage(editor: EditorStore, slideId: string, file: File) {
  const r = await saveImageFile(file)
  if (!r) return
  editor.apply((d) => {
    const slide = d.slides.find((s) => s.id === slideId)
    return slide ? updateSlide(d, slideId, { background: { ...slide.background, imageId: r.assetId } }) : d
  })
}
