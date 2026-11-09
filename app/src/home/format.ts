const MONTH_DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

export function formatEdited(ts: number, now = Date.now()): string {
  const diff = Math.max(0, now - ts)
  if (diff < 60_000) return 'Edited just now'
  if (diff < 3600_000) return `Edited ${Math.floor(diff / 60_000)} min ago`
  if (diff < 24 * 3600_000) return `Edited ${Math.floor(diff / 3600_000)} h ago`
  return `Edited ${MONTH_DAY.format(ts)}`
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
export const slidesLabel = (n: number) => count(n, 'slide', 'slides')
export const decksLabel = (n: number) => count(n, 'deck', 'decks')
