import type { GameEvent, PlayerState } from '@quizv/core'

type BroadcastCb = (msg: { payload: GameEvent }) => void
type PresenceCb = () => void

export class FakeChannel {
  public sent: Array<{ type: string; event: string; payload: GameEvent }> = []
  public tracked: PlayerState[] = []
  public presence: Record<string, PlayerState[]> = {}
  private broadcastListeners: BroadcastCb[] = []
  private presenceListeners: PresenceCb[] = []

  on(kind: 'broadcast' | 'presence', _filter: object, cb: BroadcastCb | PresenceCb): this {
    if (kind === 'broadcast') this.broadcastListeners.push(cb as BroadcastCb)
    else this.presenceListeners.push(cb as PresenceCb)
    return this
  }

  subscribe(): this {
    return this
  }

  async send(msg: { type: string; event: string; payload: GameEvent }): Promise<void> {
    this.sent.push(msg)
    // No self-echo: self: false means the sender does not receive its own broadcasts via the channel.
  }

  /** Simulate a broadcast arriving from another client (for tests). */
  simulateIncoming(payload: GameEvent): void {
    for (const cb of this.broadcastListeners) cb({ payload })
  }

  async track(state: PlayerState): Promise<void> {
    this.tracked.push(state)
    this.presence[state.id] = [state]
    for (const cb of this.presenceListeners) cb()
  }

  async untrack(): Promise<void> {
    this.tracked = []
    this.presence = {}
    for (const cb of this.presenceListeners) cb()
  }

  presenceState(): Record<string, PlayerState[]> {
    return this.presence
  }
}

export class FakeSupabase {
  public channels: Record<string, FakeChannel> = {}
  channel(name: string): FakeChannel {
    if (!this.channels[name]) this.channels[name] = new FakeChannel()
    return this.channels[name]
  }
  removeChannel(_ch: FakeChannel): Promise<void> {
    return Promise.resolve()
  }
}
