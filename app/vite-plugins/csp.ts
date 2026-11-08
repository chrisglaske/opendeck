import type { Plugin } from 'vite'

/**
 * Strict policy for the built app. Build-only: Vite dev injects <style> tags
 * that this policy would block. Don't loosen it (e.g. 'unsafe-inline') without
 * a security review; element styles go through the CSSOM instead.
 */
export const CSP_POLICY =
  "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-src 'none'"

export function cspPlugin(): Plugin {
  return {
    name: 'opendeck-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: () => [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP_POLICY },
          injectTo: 'head-prepend',
        },
      ],
    },
  }
}
