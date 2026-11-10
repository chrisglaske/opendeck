/** Cloudflare Web Analytics. Loaded only after the visitor allows it; never sees deck content. */
export const BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js'

export function loadBeacon(token: string | undefined = import.meta.env.VITE_CF_BEACON_TOKEN, doc: Document = document): boolean {
  if (!token) return false
  if (doc.querySelector('script[data-od-beacon]')) return true
  const s = doc.createElement('script')
  s.defer = true
  s.src = BEACON_SRC
  s.setAttribute('data-cf-beacon', JSON.stringify({ token }))
  s.setAttribute('data-od-beacon', '')
  doc.head.appendChild(s)
  return true
}
