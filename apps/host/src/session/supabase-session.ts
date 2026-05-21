import { GameEngine } from '@quizv/core'
import type { GameEvent, IRealtimeTransport, PlayerState } from '@quizv/core'
import type { Quiz } from '@quizv/parser'

export type HostEvent =
  | GameEvent
  | { type: 'host_ready'; joinCode: string; totalQuestions: number; playerUrl: string; quizMeta: Quiz['meta'] }

export interface HostSessionOptions {
  quiz: Quiz
  transport: IRealtimeTransport
  joinCode: string
  origin: string
}

/**
 * Owns the GameEngine in the host browser and bridges it with the transport channel.
 * Emits a single stream of events (HostEvent) the Pinia store can consume.
 */
export class SupabaseHostSession {
  private engine: GameEngine
  private transport: IRealtimeTransport
  private channel: string
  private listeners: Array<(e: HostEvent) => void> = []
  private offBroadcast?: () => void
  private offPresence?: () => void

  constructor(opts: HostSessionOptions) {
    this.transport = opts.transport
    this.channel = `game:${opts.joinCode}`
    this.engine = new GameEngine(opts.quiz, opts.transport, opts.joinCode)

    // Forward all events on the channel back to listeners, and feed answers into the engine
    this.offBroadcast = this.transport.subscribe(this.channel, event => {
      this.emit(event)
      if (event.type === 'answer_submit') {
        this.engine.submitAnswer(event.playerId, event.choiceIds, event.timeRemaining)
        this.emit({ type: 'answer_submitted', playerId: event.playerId })
      }
    })

    this.offPresence = this.transport.presence.onChange(this.channel, players => {
      this.syncPlayers(players)
    })

    // Emit ready event on next tick so listeners can register first
    queueMicrotask(() => {
      this.emit({
        type: 'host_ready',
        joinCode: opts.joinCode,
        totalQuestions: opts.quiz.questions.length,
        playerUrl: `${opts.origin}/?code=${opts.joinCode}`,
        quizMeta: opts.quiz.meta,
      })
    })
  }

  private syncPlayers(presence: PlayerState[]): void {
    const known = new Set(this.engine.state.players.keys())
    for (const p of presence) {
      if (!known.has(p.id)) this.engine.addPlayer(p)
      known.delete(p.id)
    }
    for (const goneId of known) this.engine.removePlayer(goneId)
  }

  on(cb: (e: HostEvent) => void): () => void {
    this.listeners.push(cb)
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb)
    }
  }

  private emit(e: HostEvent): void {
    for (const l of this.listeners) l(e)
  }

  async start(): Promise<void> { await this.engine.start() }
  async reveal(): Promise<void> { await this.engine.revealAnswer() }
  async next(): Promise<void> { await this.engine.nextQuestion() }

  dispose(): void {
    this.offBroadcast?.()
    this.offPresence?.()
  }
}
