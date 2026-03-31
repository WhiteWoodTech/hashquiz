import type { Quiz, Question } from '@quizv/parser'
import type { IRealtimeTransport } from './transport'
import { GameEvents } from './events'
import { calcPoints } from './scoring'
import type { GameState, PlayerState, Score, PodiumEntry, QuestionPublic } from './types'

interface PendingAnswer {
  playerId: string
  choiceIds: string[]
  answerTimeMs: number
}

/** Maps a Question to QuestionPublic (strips isCorrect from choices) */
function toPublic(question: Question, idx: number, oneShoot: boolean): QuestionPublic {
  return {
    idx,
    type: question.type,
    timer: question.timer,
    difficulty: question.difficulty,
    text: question.text,
    choices: question.choices.map(({ id, text }) => ({ id, text })),
    oneShoot,
  }
}

/**
 * Core game state machine.
 * Lifecycle: lobby → active → finished
 *
 * The host calls: start() → [per question: revealAnswer(), nextQuestion()] → (auto finish)
 * Players call: submitAnswer()
 */
export class GameEngine {
  readonly state: GameState
  private quiz: Quiz
  private transport: IRealtimeTransport
  private channel: string
  private pendingAnswers: Map<string, PendingAnswer> = new Map()
  private activeQuestions: Question[] = []

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

  /** Add a player to the session (call during lobby phase) */
  addPlayer(player: PlayerState): void {
    this.state.players.set(player.id, player)
    void this.transport.broadcast(this.channel, GameEvents.playerJoined(player))
  }

  /** Remove a player (disconnected) */
  removePlayer(playerId: string): void {
    this.state.players.delete(playerId)
    void this.transport.broadcast(this.channel, GameEvents.playerLeft(playerId))
  }

  private selectQuestions(): Question[] {
    const { maxQuestions, maxTimeSec } = this.quiz.meta
    const all = this.quiz.questions

    if (maxQuestions === undefined && maxTimeSec === undefined) return all

    // Fisher-Yates shuffle of indices to preserve original objects
    const indices = all.map((_, i) => i)
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[indices[i], indices[j]] = [indices[j]!, indices[i]!]
    }

    let selectedIndices: number[]
    if (maxQuestions !== undefined) {
      selectedIndices = indices.slice(0, maxQuestions)
    } else {
      // max-time: accumulate while timer sum <= maxTimeSec
      selectedIndices = []
      let total = 0
      for (const idx of indices) {
        const timer = all[idx]!.timer
        if (total + timer <= maxTimeSec!) {
          selectedIndices.push(idx)
          total += timer
        }
      }
    }

    // Restore original file order by sorting indices ascending
    selectedIndices.sort((a, b) => a - b)
    return selectedIndices.map(i => all[i]!)
  }

  /** Transition lobby → active, broadcast game_started + first question_started */
  async start(): Promise<void> {
    if (this.state.status !== 'lobby') return
    this.state.status = 'active'
    this.activeQuestions = this.selectQuestions()
    this.state.totalQuestions = this.activeQuestions.length
    await this.transport.broadcast(this.channel, GameEvents.gameStarted())
    await this._broadcastCurrentQuestion()
  }

  private async _broadcastCurrentQuestion(): Promise<void> {
    this.pendingAnswers.clear()
    const q = this.activeQuestions[this.state.currentQuestionIdx]!
    const oneShoot = this.quiz.meta.oneShoot ?? true
    await this.transport.broadcast(
      this.channel,
      GameEvents.questionStarted(
        toPublic(q, this.state.currentQuestionIdx, oneShoot),
        this.state.currentQuestionIdx,
      ),
    )
  }

  /**
   * Record a player's answer for the current question.
   * Safe to call multiple times; only the first submission is recorded.
   */
  submitAnswer(playerId: string, choiceIds: string[], answerTimeMs: number): void {
    if (this.pendingAnswers.has(playerId)) return  // already answered
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
      const answerTimeMs = pending?.answerTimeMs ?? q.timer * 1000
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
      await this.transport.broadcast(this.channel, GameEvents.nextQuestion(nextIdx))
      await this._broadcastCurrentQuestion()
    }
  }

  private async _finishGame(): Promise<void> {
    this.state.status = 'finished'
    const podium: PodiumEntry[] = Array.from(this.state.players.values())
      .sort((a, b) => b.score - a.score)
      .map((p, i) => ({ rank: i + 1, playerId: p.id, pseudo: p.pseudo, score: p.score }))
    await this.transport.broadcast(this.channel, GameEvents.gameEnded(podium))
  }
}
