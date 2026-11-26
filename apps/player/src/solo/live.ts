import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'

export interface LivePlayer { key: string; pseudo: string; index: number; total: number; score: number }
type Me = Omit<LivePlayer, 'key'>

/** Who is playing this deck right now, via Realtime presence. */
export class SoloLive {
  private channel: RealtimeChannel
  private key = Math.random().toString(36).slice(2, 12)
  private listeners: Array<(players: LivePlayer[]) => void> = []

  constructor(private client: SupabaseClient, deckId: string) {
    this.channel = client.channel(`solo:${deckId}`, { config: { presence: { key: this.key } } })
    this.channel.on('presence', { event: 'sync' }, () => this.emit())
  }

  private emit(): void {
    const state = this.channel.presenceState() as Record<string, Me[]>
    const players = Object.entries(state).flatMap(([key, metas]) =>
      metas.map(m => ({ key, pseudo: m.pseudo, index: m.index, total: m.total, score: m.score })),
    )
    for (const cb of this.listeners) cb(players)
  }

  async join(me: Me): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.channel.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') resolve()
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(`presence ${status}`))
      })
    })
    await this.channel.track(me)
  }

  async update(me: Me): Promise<void> {
    await this.channel.track(me)
  }

  async leave(): Promise<void> {
    await this.channel.untrack()
    await this.client.removeChannel(this.channel)
  }

  onChange(cb: (players: LivePlayer[]) => void): () => void {
    this.listeners.push(cb)
    return () => { this.listeners = this.listeners.filter(l => l !== cb) }
  }
}
