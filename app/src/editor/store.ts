import type { Deck, Selection } from '../model/types'

export type EditorState = { deck: Deck; selection: Selection; editingId: string | null; canUndo: boolean; canRedo: boolean }
export type CommitOpts = { selection?: Selection; coalesce?: string }

export interface EditorStore {
  getState(): EditorState
  subscribe(fn: () => void): () => void
  /** One undo step. Returning the same deck is a no-op. */
  apply(fn: (d: Deck) => Deck, opts?: CommitOpts): void
  /** Starts a gesture (drag, resize…): many previews, then one commit or cancel. */
  begin(): void
  /** Shows a change during a gesture. `fn` always receives the deck as it was at `begin()`. */
  preview(fn: (d: Deck) => Deck): void
  commit(opts?: CommitOpts): void
  cancel(): void
  undo(): void
  redo(): void
  select(sel: Selection): void
  setEditing(id: string | null): void
  /** Fires on committed deck changes only (apply, commit, undo, redo). */
  onDeckChange(fn: (d: Deck) => void): () => void
}

type Entry = { deck: Deck; selection: Selection }

/** Consecutive applies with the same coalesce key this close together merge into one step. */
const COALESCE_MS = 1000

export function createEditorStore(initial: Deck, opts: { historyLimit?: number } = {}): EditorStore {
  const limit = opts.historyLimit ?? 200
  let past: Entry[] = []
  let future: Entry[] = []
  let gesture: Entry | null = null
  let lastCoalesce: { key: string; at: number } | null = null
  let state: EditorState = {
    deck: initial,
    selection: { slideId: initial.slides[0]?.id ?? '', ids: [] },
    editingId: null,
    canUndo: false,
    canRedo: false,
  }
  const listeners = new Set<() => void>()
  const deckListeners = new Set<(d: Deck) => void>()

  function set(patch: Partial<EditorState>, deckChanged: boolean) {
    state = { ...state, ...patch, canUndo: past.length > 0, canRedo: future.length > 0 }
    listeners.forEach((fn) => fn())
    if (deckChanged) deckListeners.forEach((fn) => fn(state.deck))
  }

  function pushPast(e: Entry) {
    past.push(e)
    if (past.length > limit) past = past.slice(past.length - limit)
  }

  const stamp = (d: Deck): Deck => ({ ...d, updatedAt: Date.now() })
  const current = (): Entry => ({ deck: state.deck, selection: state.selection })

  return {
    getState: () => state,
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    apply(fn, o = {}) {
      const next = fn(state.deck)
      if (next === state.deck) return
      const now = Date.now()
      const merge = o.coalesce !== undefined && lastCoalesce?.key === o.coalesce && now - lastCoalesce.at < COALESCE_MS && past.length > 0
      if (!merge) pushPast(current())
      future = []
      lastCoalesce = o.coalesce !== undefined ? { key: o.coalesce, at: now } : null
      set({ deck: stamp(next), selection: o.selection ?? state.selection }, true)
    },
    begin() {
      gesture = current()
    },
    preview(fn) {
      if (!gesture) return
      set({ deck: fn(gesture.deck) }, false)
    },
    commit(o = {}) {
      const start = gesture
      gesture = null
      if (!start) return
      lastCoalesce = null
      if (state.deck === start.deck) {
        if (o.selection) set({ selection: o.selection }, false)
        return
      }
      pushPast(start)
      future = []
      set({ deck: stamp(state.deck), selection: o.selection ?? state.selection }, true)
    },
    cancel() {
      const start = gesture
      gesture = null
      if (start && state.deck !== start.deck) set({ deck: start.deck }, false)
    },
    undo() {
      if (gesture) this.cancel()
      const prev = past.pop()
      if (!prev) return
      future.push(current())
      lastCoalesce = null
      set({ ...prev, editingId: null }, true)
    },
    redo() {
      if (gesture) this.cancel()
      const next = future.pop()
      if (!next) return
      pushPast(current())
      lastCoalesce = null
      set({ ...next, editingId: null }, true)
    },
    select(sel) {
      set({ selection: sel }, false)
    },
    setEditing(id) {
      set({ editingId: id }, false)
    },
    onDeckChange(fn) {
      deckListeners.add(fn)
      return () => deckListeners.delete(fn)
    },
  }
}
