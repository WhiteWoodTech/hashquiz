import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import type { LivePlayer, LiveState as Me, SoloLivePort } from '@quizv/core'

/**
 * Resolves once the Realtime socket is idle or open, i.e. not mid-reconnect. Phoenix disconnects on `pagehide`
 * and reconnects on `pageshow`; a channel created while the old connection is still closing gets errored by
 * that close and rejoined, and the server answers the duplicate join by dropping the topic (track() then gets
 * "unmatched topic" and the player is never listed). Gives up after `maxMs`.
 */
export async function realtimeSettled(
  client: Pick<SupabaseClient, 'realtime'>,
  maxMs = 3_000,
  stepMs = 50,
): Promise<void> {
  for (let waited = 0; waited < maxMs; waited += stepMs) {
    const state = client.realtime.connectionState()
    if (state !== 'connecting' && state !== 'closing') return
    await new Promise(r => setTimeout(r, stepMs))
  }
}

/** Who is playing this deck right now, via Realtime presence. */
/** Minimum delay between two channel rebuilds (see `SoloLive.rebuild`). */
export const REBUILD_MIN_MS = 2_000

export class SoloLive implements SoloLivePort {
  /** This client's presence key, to tell our own row apart from the others. */
  readonly key = Math.random().toString(36).slice(2, 12)
  private readonly topic: string
  private channel!: RealtimeChannel
  private listeners: Array<(players: LivePlayer[]) => void> = []
  private subscribed: Promise<void> | null = null
  /** Last tracked state, re-tracked after a rebuild; null when not listed. */
  private me: Me | null = null
  private left = false
  private rebuilding = false
  private lastRebuild = Number.NEGATIVE_INFINITY
  /**
   * One row per presence key, rebuilt from join/leave events. `presenceState()` is not used: realtime-js 2.106
   * strips `phx_ref` from stored metas, so leaves never prune it and every track() adds a stale row.
   */
  private rows = new Map<string, Me>()
  private joinedInDiff = new Set<string>()

  /**
   * Throws when a channel for this deck is still open on the client: realtime-js would hand it back, and
   * adding listeners to an already joined channel throws. Await the previous instance's leave() first.
   */
  constructor(private client: SupabaseClient, deckId: string) {
    this.topic = `solo:${deckId}`
    if (client.getChannels().some(c => c.topic === `realtime:${this.topic}`)) {
      throw new Error(`presence channel ${this.topic} is still open`)
    }
    this.open()
  }

  private open(): void {
    const ch = this.client.channel(this.topic, { config: { presence: { key: this.key } } })
    this.channel = ch
    ch
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        if (ch !== this.channel) return
        const m = newPresences.at(-1) as unknown as Me | undefined
        if (!m) return
        this.rows.set(key, { pseudo: m.pseudo, index: m.index, total: m.total, score: m.score })
        this.joinedInDiff.add(key)
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (ch !== this.channel) return
        // An update arrives as join + leave of the same key in one diff: keep the joined row.
        if (!this.joinedInDiff.has(key)) this.rows.delete(key)
      })
      .on('presence', { event: 'sync' }, () => {
        if (ch !== this.channel) return
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
    const ch = this.channel
    this.subscribed ??= new Promise<void>((resolve, reject) => {
      ch.subscribe((status: string) => {
        if (ch !== this.channel) return
        if (status === 'SUBSCRIBED') resolve()
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(`presence ${status}`))
        if (status === 'CHANNEL_ERROR') void this.rebuild()
      })
    })
    return this.subscribed
  }

  /**
   * Replaces an errored channel with a fresh one instead of letting phoenix rejoin it. After a socket reconnect
   * (phoenix disconnects on `pagehide` and reconnects on `pageshow`), the close of the old connection can error a
   * channel that already joined on the new one; its automatic rejoin is a duplicate join, which the Realtime
   * server answers by dropping the topic: no presence in or out, and track() gets "unmatched topic".
   * Also called when track() is refused (see `track`).
   */
  private async rebuild(): Promise<void> {
    if (this.left || this.rebuilding || Date.now() - this.lastRebuild < REBUILD_MIN_MS) return
    this.rebuilding = true
    this.lastRebuild = Date.now()
    try {
      const old = this.channel
      try { await this.client.removeChannel(old) } catch { /* unusable anyway */ }
      await realtimeSettled(this.client)
      if (this.left) return
      this.rows.clear()
      this.joinedInDiff.clear()
      this.subscribed = null
      this.open()
      await this.watch()
      if (this.me) await this.channel.track(this.me)
    } catch {
      // The next CHANNEL_ERROR (after REBUILD_MIN_MS) tries again; phoenix keeps retrying the join meanwhile.
    } finally {
      this.rebuilding = false
    }
  }

  async join(me: Me): Promise<void> {
    this.me = me
    await this.watch()
    await this.track(me)
  }

  async update(me: Me): Promise<void> {
    this.me = me
    await this.track(me)
  }

  /**
   * A track() refused by the server ("unmatched topic") means the server no longer has our channel although the
   * client thinks it is joined (e.g. phoenix replaced the socket after a pagehide/pageshow without erroring the
   * channel): rebuild it, which re-tracks the latest state.
   */
  private async track(me: Me): Promise<void> {
    const status = await this.channel.track(me)
    if (status === 'error') await this.rebuild()
  }

  /** Stops being listed but keeps watching the others. */
  async untrack(): Promise<void> {
    this.me = null
    await this.channel.untrack()
  }

  /**
   * Leaves the channel; the server drops our presence with it, so no untrack() is needed (on a channel that
   * never joined, untrack() would wait for its push timeout). Never rejects. Resolves once the client no
   * longer holds the channel, so a new SoloLive on the same deck can be created.
   */
  async leave(): Promise<void> {
    this.left = true
    this.me = null
    try {
      await this.client.removeChannel(this.channel)
    } catch {
      // Removal failed: the channel is unusable anyway.
    }
  }

  onChange(cb: (players: LivePlayer[]) => void): () => void {
    this.listeners.push(cb)
    return () => { this.listeners = this.listeners.filter(l => l !== cb) }
  }
}
