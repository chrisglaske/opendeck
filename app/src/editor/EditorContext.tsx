import { createContext, useContext, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import type { EditorState, EditorStore } from './store'

const Ctx = createContext<EditorStore | null>(null)

export function EditorProvider({ store, children }: { store: EditorStore; children: ReactNode }) {
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useEditorStore(): EditorStore {
  const store = useContext(Ctx)
  if (!store) throw new Error('useEditorStore must be used inside <EditorProvider>')
  return store
}

/** Subscribes to part of the editor state. The selector must return stable values (no new objects per call). */
export function useEditor<T>(selector: (s: EditorState) => T): T {
  const store = useEditorStore()
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()))
}

/** The editor store when there is one; null outside the editor (for example on Home). */
export function useOptionalEditorStore(): EditorStore | null {
  return useContext(Ctx)
}

const noSubscribe = () => () => {}

/** Like `useEditor`, but gives `fallback` outside the editor. */
export function useOptionalEditor<T>(selector: (s: EditorState) => T, fallback: T): T {
  const store = useContext(Ctx)
  return useSyncExternalStore(store ? store.subscribe : noSubscribe, () => (store ? selector(store.getState()) : fallback))
}
