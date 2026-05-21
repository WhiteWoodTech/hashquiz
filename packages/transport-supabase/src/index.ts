import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js'
import type { IRealtimeTransport, Unsubscribe, GameEvent, PlayerState } from '@quizv/core'

export interface SupabaseTransportOptions {
  url?: string
  anonKey?: string
  /** Optional injected client (used for tests). */
  client?: SupabaseClient
}

export class SupabaseTransport implements IRealtimeTransport {
  private client: SupabaseClient
  private channels: Map<string, RealtimeChannel> = new Map()

  constructor(opts: SupabaseTransportOptions) {
    if (opts.client) {
      this.client = opts.client
    } else {
      if (!opts.url || !opts.anonKey) {
        throw new Error('SupabaseTransport requires url + anonKey when no client is provided')
      }
      this.client = createClient(opts.url, opts.anonKey)
    }
  }

  private getChannel(name: string): RealtimeChannel {
    let ch = this.channels.get(name)
    if (!ch) {
      ch = this.client.channel(name, { config: { broadcast: { self: true } } })
      ch.subscribe()
      this.channels.set(name, ch)
    }
    return ch
  }

  async broadcast(channel: string, event: GameEvent): Promise<void> {
    const ch = this.getChannel(channel)
    await ch.send({ type: 'broadcast', event: 'gameEvent', payload: event })
  }

  subscribe(_channel: string, _cb: (event: GameEvent) => void): Unsubscribe {
    throw new Error('not implemented')
  }

  presence = {
    track: async (_channel: string, _state: PlayerState): Promise<void> => {
      throw new Error('not implemented')
    },
    untrack: async (_channel: string): Promise<void> => {
      throw new Error('not implemented')
    },
    list: (_channel: string): PlayerState[] => {
      throw new Error('not implemented')
    },
    onChange: (_channel: string, _cb: (players: PlayerState[]) => void): Unsubscribe => {
      throw new Error('not implemented')
    },
  }
}
