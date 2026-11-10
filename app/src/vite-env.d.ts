/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Cloudflare Web Analytics site token; without it the visitor counter never loads. */
  readonly VITE_CF_BEACON_TOKEN?: string
  /** '1' keeps the development component gallery (`#/design`) in a production build. */
  readonly VITE_DESIGN_PAGE?: string
}
