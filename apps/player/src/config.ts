import { readRuntimeConfig } from '@quizv/core'

/** Deployment settings: `/quizv-config.js` (written by `hashquiz build`) or the `VITE_*` env vars. */
export const config = readRuntimeConfig(import.meta.env as unknown as Record<string, string | undefined>)
