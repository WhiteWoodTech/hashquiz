// Browser-safe: the local solo WS protocol shared by the dev server and the browser client.
import type { LivePlayer, LiveState } from '@hashquiz/core'

/** `role` query value of a solo socket: `/ws?role=solo&deck=<id>&key=<key>`. */
export const SOLO_WS_ROLE = 'solo'

/** Pub/sub topic of one deck's presence and new runs. */
export const soloTopic = (deckId: string): string => `solo:${deckId}`

export type SoloClientMsg = { type: 'solo_track'; state: LiveState } | { type: 'solo_untrack' }

export type SoloServerMsg =
  | { type: 'solo_presence'; deckId: string; players: LivePlayer[] }
  | { type: 'solo_new_run'; deckId: string }
