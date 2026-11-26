import type { Quiz, Question } from '@quizv/parser'
import type { IRealtimeTransport } from './transport'
import { GameEvents, type StateSnapshot } from './events'
import { calcPoints } from './scoring'
import { serveQuestions, toPublic } from './selection'
import type { GameState, PlayerState, Score, PodiumEntry, QuizInfo } from './types'

interface PendingAnswer {
  playerId: string
  choiceIds: string[]
  answerTimeMs: number
}

interface RevealPayload {
  correct: string[]
  explanation: string | undefined
  scores: Score[]
  choiceCounts: Record<string, number>
}

/**
 * Core game state machine.
 * Lifecycle: lobby → active → finished (→ lobby via reset())
 *
 * The host calls: start() → [per question: revealAnswer(), nextQuestion()] → (auto finish)
 *   → optionally reset() to replay in the same room
 * Players call: submitAnswer()
 */
export class GameEngine {
  readonly state: GameState
  private quiz: Quiz
  private transport: IRealtimeTransport
  private channel: string
  private pendingAnswers: Map<string, PendingAnswer> = new Map()
  private activeQuestions: Question[] = []
  private revealedForIdx: number = -1
  private lastReveal: RevealPayload | null = null
  private podium: PodiumEntry[] | null = null

  constructor(quiz: Quiz, transport: IRealtimeTransport, joinCode: string) {
    this.quiz = quiz
    this.transport = transport
    this.channel = `game:${joinCode}`
    this.state = {
      sessionId: crypto.randomUUID(),
      joinCode,
      status: 'lobby',
      players: new Map(),
      currentQuestionIdx: 0,
      totalQuestions: quiz.questions.length,
    }
  }

  /**
   * Add a player, or re-attach an existing one (preserving score).
   * Returns true if this was a rejoin of a known player (broadcasts player_rejoined),
   * false for a fresh player (broadcasts player_joined).
   */
  addPlayer(player: PlayerState): boolean {
    const existing = this.state.players.get(player.id)
    if (existing) {
      // Preserve server-authoritative score and joinedAt; update mutable identity fields
      // and clear any disconnect marker so the grace timer is effectively cancelled.
      existing.pseudo = player.pseudo
      existing.email  = player.email
      delete existing.disconnectedAt
      void this.transport.broadcast(this.channel, GameEvents.playerRejoined(player.id))
      return true
    }
    this.state.players.set(player.id, player)
    void this.transport.broadcast(this.channel, GameEvents.playerJoined(player))
    return false
  }

  /** Mark a player as disconnected without removing them, so grace-period cleanup can handle it. */
  markPlayerDisconnected(playerId: string, atMs: number = Date.now()): void {
    const p = this.state.players.get(playerId)
    if (p) p.disconnectedAt = atMs
  }

  /** Remove a player (disconnected past grace period, or kicked) */
  removePlayer(playerId: string): void {
    if (!this.state.players.has(playerId)) return
    this.state.players.delete(playerId)
    void this.transport.broadcast(this.channel, GameEvents.playerLeft(playerId))
  }

  /** Transition lobby → active, broadcast game_started + first question_started event */
  async start(): Promise<void> {
    if (this.state.status !== 'lobby') return
    this.state.status = 'active'
    // Shuffle each question's choices once at start so the correct answer's letter varies
    // between games but stays frozen for the whole session (cohérent across host/player/rejoin).
    this.activeQuestions = serveQuestions(this.quiz)
    this.state.totalQuestions = this.activeQuestions.length
    await this.transport.broadcast(this.channel, GameEvents.gameStarted())
    await this._broadcastCurrentQuestion()
  }

  private async _broadcastCurrentQuestion(): Promise<void> {
    this.pendingAnswers.clear()
    this.lastReveal = null
    const q = this.activeQuestions[this.state.currentQuestionIdx]!
    const oneShoot = this.quiz.meta.oneShoot ?? true
    const deadlineMs = Date.now() + q.timer * 1000
    this.state.currentQuestionDeadlineMs = deadlineMs
    await this.transport.broadcast(
      this.channel,
      GameEvents.questionStarted(
        toPublic(q, this.state.currentQuestionIdx, oneShoot),
        this.state.currentQuestionIdx,
        deadlineMs,
      ),
    )
  }

  /**
   * Record a player's answer for the current question.
   * Safe to call multiple times; only the first submission is recorded.
   * Refused once the answer has been revealed for this question.
   */
  submitAnswer(playerId: string, choiceIds: string[], answerTimeMs: number): void {
    if (this.revealedForIdx === this.state.currentQuestionIdx) return  // already revealed
    if (this.pendingAnswers.has(playerId)) return                      // already answered
    this.pendingAnswers.set(playerId, { playerId, choiceIds, answerTimeMs })
    void this.transport.broadcast(this.channel, GameEvents.answerSubmitted(playerId))
  }

  /**
   * Score all answers, update player scores, broadcast answer_revealed.
   * Returns the Score[] for the current question.
   */
  async revealAnswer(): Promise<Score[]> {
    if (this.state.status !== 'active') return []
    const q = this.activeQuestions[this.state.currentQuestionIdx]!
    const correctIds = q.choices.filter(c => c.isCorrect).map(c => c.id)
    const scores: Score[] = []

    for (const [, player] of this.state.players) {
      const pending = this.pendingAnswers.get(player.id)
      const rawMs = pending?.answerTimeMs ?? q.timer * 1000
      const answerTimeMs = Math.min(q.timer * 1000, Math.max(0, rawMs))
      const timeRemaining = Math.max(0, q.timer - answerTimeMs / 1000)

      const isCorrect = pending
        ? correctIds.every(id => pending.choiceIds.includes(id)) &&
          pending.choiceIds.every(id => correctIds.includes(id))
        : false

      const delta = calcPoints(timeRemaining, isCorrect)
      player.score += delta
      scores.push({ playerId: player.id, pseudo: player.pseudo, score: player.score, delta })
    }

    // Tally votes per choice id
    const choiceCounts: Record<string, number> = {}
    for (const [, pending] of this.pendingAnswers) {
      for (const id of pending.choiceIds) {
        choiceCounts[id] = (choiceCounts[id] ?? 0) + 1
      }
    }

    this.lastReveal = { correct: correctIds, explanation: q.explanation, scores, choiceCounts }
    this.revealedForIdx = this.state.currentQuestionIdx
    delete this.state.currentQuestionDeadlineMs

    await this.transport.broadcast(
      this.channel,
      GameEvents.answerRevealed(correctIds, q.explanation, scores, choiceCounts)
    )
    return scores
  }

  /**
   * Advance to the next question, or finish the game if no more questions.
   */
  async nextQuestion(): Promise<void> {
    if (this.state.status !== 'active') return
    const nextIdx = this.state.currentQuestionIdx + 1
    if (nextIdx >= this.activeQuestions.length) {
      await this._finishGame()
    } else {
      this.state.currentQuestionIdx = nextIdx
      await this._broadcastCurrentQuestion()
    }
  }

  private async _finishGame(): Promise<void> {
    this.state.status = 'finished'
    delete this.state.currentQuestionDeadlineMs
    const podium: PodiumEntry[] = Array.from(this.state.players.values())
      .sort((a, b) => b.score - a.score)
      .map((p, i) => ({ rank: i + 1, playerId: p.id, pseudo: p.pseudo, score: p.score }))
    this.podium = podium
    await this.transport.broadcast(this.channel, GameEvents.gameEnded(podium))
  }

  /**
   * Transition finished → lobby so the same room can play again ("Rejouer").
   * Keeps the join code and every known player (score reset to 0, disconnect markers kept
   * so grace-period cleanup still applies); clears all per-game state. No-op unless finished.
   */
  async reset(): Promise<void> {
    if (this.state.status !== 'finished') return
    this.state.status = 'lobby'
    this.state.currentQuestionIdx = 0
    this.state.totalQuestions = this.quiz.questions.length
    delete this.state.currentQuestionDeadlineMs
    for (const player of this.state.players.values()) player.score = 0
    this.pendingAnswers.clear()
    this.activeQuestions = []
    this.revealedForIdx = -1
    this.lastReveal = null
    this.podium = null
    await this.transport.broadcast(this.channel, GameEvents.gameReset())
  }

  /**
   * Build a snapshot of the current game state targeted at a specific player.
   * Used to re-hydrate a reconnecting player's UI.
   */
  buildSnapshot(playerId: string, quizMeta: QuizInfo): StateSnapshot {
    const player = this.state.players.get(playerId)
    const totalScore = player?.score ?? 0
    const playerCount = Array.from(this.state.players.values())
      .filter(p => !p.disconnectedAt).length
    const status = this.state.status
    const currentIdx = this.state.currentQuestionIdx
    const oneShoot = this.quiz.meta.oneShoot ?? true

    if (status === 'finished') {
      return {
        phase: 'finished',
        quizMeta,
        totalScore,
        playerCount,
        ...(this.podium ? { podium: this.podium } : {}),
      }
    }

    if (status === 'active') {
      const isRevealed = this.revealedForIdx === currentIdx
      const q = this.activeQuestions[currentIdx]
      const question = q ? toPublic(q, currentIdx, oneShoot) : undefined

      if (isRevealed && this.lastReveal) {
        return {
          phase: 'revealed',
          quizMeta,
          totalScore,
          playerCount,
          ...(question ? { question, questionIdx: currentIdx } : {}),
          reveal: this.lastReveal,
        }
      }

      return {
        phase: 'question',
        quizMeta,
        totalScore,
        playerCount,
        ...(question ? { question, questionIdx: currentIdx } : {}),
        ...(this.state.currentQuestionDeadlineMs !== undefined
          ? { deadlineMs: this.state.currentQuestionDeadlineMs }
          : {}),
      }
    }

    // lobby or idle
    return { phase: 'lobby', quizMeta, totalScore, playerCount }
  }
}
