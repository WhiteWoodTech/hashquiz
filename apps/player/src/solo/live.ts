import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'

export interface LivePlayer { key: string; pseudo: string; index: number; total: number; score: number }
type Me = Omit<LivePlayer, 'key'>

/** Who is playing this deck right now, via Realtime presence. */
export class SoloLive {
  /** This client's presence key, to tell our own row apart from the others. */
  readonly key = Math.random().toString(36).slice(2, 12)
  private channel: RealtimeChannel
  private listeners: Array<(players: LivePlayer[]) => void> = []
  private subscribed: Promise<void> | null = null
  /**
   * One row per presence key, rebuilt from join/leave events. `presenceState()` is not used: realtime-js 2.106
   * strips `phx_ref` from stored metas, so leaves never prune it and every track() adds a stale row.
   */
  private rows = new Map<string, Me>()
  private joinedInDiff = new Set<string>()

  constructor(private client: SupabaseClient, deckId: string) {
    this.channel = client.channel(`solo:${deckId}`, { config: { presence: { key: this.key } } })
    this.channel
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        const m = newPresences.at(-1) as unknown as Me | undefined
        if (!m) return
        this.rows.set(key, { pseudo: m.pseudo, index: m.index, total: m.total, score: m.score })
        this.joinedInDiff.add(key)
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        // An update arrives as join + leave of the same key in one diff: keep the joined row.
        if (!this.joinedInDiff.has(key)) this.rows.delete(key)
      })
      .on('presence', { event: 'sync' }, () => {
        this.joinedInDiff.clear()
        this.emit()
      })
  }

  private emit(): void {
    const players = [...this.rows].map(([key, m]) => ({ key, ...m }))
    for (const cb of this.listeners) cb(players)
  }

  /** Subscribes (once) to see who is playing, without being listed. */
  watch(): Promise<void> {
    this.subscribed ??= new Promise<void>((resolve, reject) => {
      this.channel.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') resolve()
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(`presence ${status}`))
      })
    })
    return this.subscribed
  }

  async join(me: Me): Promise<void> {
    await this.watch()
    await this.channel.track(me)
  }

  async update(me: Me): Promise<void> {
    await this.channel.track(me)
  }

  /** Stops being listed but keeps watching the others. */
  async untrack(): Promise<void> {
    await this.channel.untrack()
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
