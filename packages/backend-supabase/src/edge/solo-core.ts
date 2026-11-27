// Entry of the `solo-submit` Edge Function bundle (`functions/_shared/solo-core.js`, built by
// `bun run build:edge`): the deck source, the scoring and the row mapping, with no bare imports so Deno
// loads it as a plain relative module.
export { parseManifest, SoloDeckSource } from '@quizv/core/solo-decks'
export { verifySoloRun } from '@quizv/core'
export { toSoloRunRow } from '../solo/rows'
export { manifestUrl } from './site-url'
