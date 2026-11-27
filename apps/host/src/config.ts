import { readRuntimeConfig } from '@hashquiz/core'

/** Deployment settings: `/hashquiz-config.js` (written by `hashquiz build`) or the `VITE_*` env vars. */
export const config = readRuntimeConfig(import.meta.env as unknown as Record<string, string | undefined>)
