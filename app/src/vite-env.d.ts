/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Cloudflare Web Analytics site token; without it the visitor counter never loads. */
  readonly VITE_CF_BEACON_TOKEN?: string
}
