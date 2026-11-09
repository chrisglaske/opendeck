/** The shapes V1 (the classic OpenDeck at the site root) keeps in localStorage, after its own normalization. */

export type V1Slide = { id: string; type: string; navName: string; title: string; notes: string; [k: string]: unknown }

export type V1Settings = {
  theme: string
  font: string
  headerText: string
  headerIcon: string
  customFontUrl: string
  customFontFamily: string
  companyLogo: string
  savedFonts: Record<string, unknown>[]
  [k: string]: unknown
}

export type V1Project = {
  id: string
  name: string
  lastModified: number
  tags: string[]
  folderId?: string | null
  schemaVersion: number
  data: { slides: V1Slide[]; slideCounter: number; globalSettings: V1Settings; [k: string]: unknown }
  [k: string]: unknown
}

export type V1Folder = { id: string; name: string }
