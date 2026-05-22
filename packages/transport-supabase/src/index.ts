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
  private eventSubs: Map<string, Set<(event: GameEvent) => void>> = new Map()
  private presenceSubs: Map<string, Set<(players: PlayerState[]) => void>> = new Map()

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
      ch.on('broadcast', { event: 'gameEvent' }, ({ payload }: { payload: GameEvent }) => {
        const subs = this.eventSubs.get(name)
        if (subs) for (const cb of subs) cb(payload)
      })
      ch.on('presence', { event: 'sync' }, () => {
        const subs = this.presenceSubs.get(name)
        if (subs) {
          const players = this.flattenPresence(name)
          for (const cb of subs) cb(players)
        }
      })
      ch.subscribe()
      this.channels.set(name, ch)
    }
    return ch
  }

  async broadcast(channel: string, event: GameEvent): Promise<void> {
    const ch = this.getChannel(channel)
    await ch.send({ type: 'broadcast', event: 'gameEvent', payload: event })
  }

  subscribe(channel: string, cb: (event: GameEvent) => void): Unsubscribe {
    this.getChannel(channel)
    if (!this.eventSubs.has(channel)) this.eventSubs.set(channel, new Set())
    this.eventSubs.get(channel)!.add(cb)
    return () => {
      this.eventSubs.get(channel)?.delete(cb)
    }
  }

  private flattenPresence(channel: string): PlayerState[] {
    const ch = this.channels.get(channel)
    if (!ch) return []
    const state = ch.presenceState() as Record<string, PlayerState[]>
    return Object.values(state).flat()
  }

  presence = {
    track: async (channel: string, state: PlayerState): Promise<void> => {
      const ch = this.getChannel(channel)
      await ch.track(state)
    },
    untrack: async (channel: string): Promise<void> => {
      const ch = this.channels.get(channel)
      if (ch) await ch.untrack()
    },
    list: (channel: string): PlayerState[] => {
      this.getChannel(channel)
      return this.flattenPresence(channel)
    },
    onChange: (channel: string, cb: (players: PlayerState[]) => void): Unsubscribe => {
      this.getChannel(channel)
      if (!this.presenceSubs.has(channel)) this.presenceSubs.set(channel, new Set())
      this.presenceSubs.get(channel)!.add(cb)
      return () => {
        this.presenceSubs.get(channel)?.delete(cb)
      }
    },
  }
}
