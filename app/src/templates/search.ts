const words = (s: string) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)

/** True when every word typed is the start of some word in the name, group or keywords. */
export function matchesQuery(t: { name: string; keywords: string[]; groupLabel: string }, q: string): boolean {
  const typed = words(q)
  if (typed.length === 0) return true
  const have = [...words(t.name), ...words(t.groupLabel), ...t.keywords.flatMap(words)]
  return typed.every((w) => have.some((h) => h.startsWith(w)))
}
