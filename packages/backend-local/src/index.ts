import type { IRealtimeTransport, Unsubscribe, GameEvent, PlayerState } from '@hashquiz/core'

type ChannelSubscribers = Set<(event: GameEvent) => void>
type PresenceStore = Map<string, PlayerState>
type PresenceSubscribers = Set<(players: PlayerState[]) => void>

/**
 * In-process transport for standalone mode.
 * Uses Bun WebSocket topics for broadcast when a server is attached,
 * and an in-memory pub/sub for direct process use (e.g. in tests).
 *
 * Usage:
 *   const transport = new LocalTransport()
 *   // Optionally attach a Bun server for external WS clients:
 *   transport.attachServer(server)
 */
export class LocalTransport implements IRealtimeTransport {
  private subscribers: Map<string, ChannelSubscribers> = new Map()
  private presenceStore: Map<string, PresenceStore> = new Map()
  private presenceSubscribers: Map<string, PresenceSubscribers> = new Map()
  private bunServer: { publish(topic: string, data: string): void } | null = null

  /** Attach a Bun server so broadcast also publishes to WS clients */
  attachServer(server: { publish(topic: string, data: string): void }): void {
    this.bunServer = server
  }

  async broadcast(channel: string, event: GameEvent): Promise<void> {
    const payload = JSON.stringify(event)

    // Notify in-process subscribers (e.g. GameEngine itself)
    const subs = this.subscribers.get(channel)
    if (subs) {
      for (const cb of subs) cb(event)
    }

    // Publish to connected WebSocket clients (external players)
    this.bunServer?.publish(channel, payload)
  }

  subscribe(channel: string, cb: (event: GameEvent) => void): Unsubscribe {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set())
    }
    this.subscribers.get(channel)!.add(cb)
    return () => {
      this.subscribers.get(channel)?.delete(cb)
    }
  }

  presence = {
    track: async (channel: string, state: PlayerState): Promise<void> => {
      if (!this.presenceStore.has(channel)) {
        this.presenceStore.set(channel, new Map())
      }
      this.presenceStore.get(channel)!.set(state.id, state)
      this._notifyPresenceSubscribers(channel)
    },

    untrack: async (channel: string): Promise<void> => {
      // Without a player ID, we can't remove a specific entry.
      // The server should call removePlayer before this.
      this._notifyPresenceSubscribers(channel)
    },

    list: (channel: string): PlayerState[] => {
      return Array.from(this.presenceStore.get(channel)?.values() ?? [])
    },

    onChange: (
      channel: string,
      cb: (players: PlayerState[]) => void
    ): Unsubscribe => {
      if (!this.presenceSubscribers.has(channel)) {
        this.presenceSubscribers.set(channel, new Set())
      }
      this.presenceSubscribers.get(channel)!.add(cb)
      return () => {
        this.presenceSubscribers.get(channel)?.delete(cb)
      }
    },
  }

  private _notifyPresenceSubscribers(channel: string): void {
    const players = this.presence.list(channel)
    const subs = this.presenceSubscribers.get(channel)
    if (subs) {
      for (const cb of subs) cb(players)
    }
  }
}
