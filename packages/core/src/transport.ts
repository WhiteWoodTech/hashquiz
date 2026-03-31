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
    /** Track the current client's presence state on a channel. */
    track(channel: string, state: PlayerState): Promise<void>

    /** Remove the current client from presence tracking on a channel. */
    untrack(channel: string): Promise<void>

    /** Get all currently tracked presence states for a channel. */
    list(channel: string): PlayerState[]

    /** Subscribe to presence changes on a channel. Returns an unsubscribe function. */
    onChange(
      channel: string,
      cb: (players: PlayerState[]) => void
    ): Unsubscribe
  }
}
