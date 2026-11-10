import { expect, it } from 'vitest'
import { CSP_POLICY } from './csp.ts'

const directives = (p: string) => Object.fromEntries(p.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
  const [name, ...rest] = d.split(/\s+/)
  return [name, rest.join(' ')]
}))

it('allows Cloudflare Web Analytics and nothing else from outside', () => {
  expect(CSP_POLICY).toContain("script-src 'self' https://static.cloudflareinsights.com;")
  expect(CSP_POLICY).toContain("connect-src 'self' https://cloudflareinsights.com;")
  expect(directives(CSP_POLICY)).toEqual({
    'default-src': "'self'",
    'script-src': "'self' https://static.cloudflareinsights.com",
    'style-src': "'self'",
    'font-src': "'self'",
    'img-src': "'self' data: blob:",
    'connect-src': "'self' https://cloudflareinsights.com",
    'object-src': "'none'",
    'base-uri': "'self'",
    'form-action': "'none'",
    'frame-src': "'none'",
  })
})
