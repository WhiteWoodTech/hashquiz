import type { GameEvent } from './events'
import type { PlayerState } from './types'

export type Unsubscribe = () => void

/**
 * Pluggable realtime transport.
 * Implementations: LocalTransport (Bun WS) and SupabaseTransport.
 */
export interface IRealtimeTransport {
  /**
   * Broadcast a game event to all subscribers on the given channel.
   */
  broadcast(channel: string, event: GameEvent): Promise<void>

  /**
   * Subscribe to events on a channel. Returns an unsubscribe function.
   */
  subscribe(channel: string, cb: (event: GameEvent) => void): Unsubscribe

  presence: {
    track(channel: string, state: PlayerState): Promise<void>
    untrack(channel: string): Promise<void>
    list(channel: string): PlayerState[]
    onChange(channel: string, cb: (players: PlayerState[]) => void): Unsubscribe
  }
}
