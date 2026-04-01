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
    tags: question.tags,
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

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j]!, a[i]!]
    }
    return a
  }

  private selectQuestions(): Question[] {
    const { maxQuestions, maxTimeSec, targetDifficulty } = this.quiz.meta
    const all = this.quiz.questions

    if (!maxQuestions && !maxTimeSec && !targetDifficulty) return all

    const DIFF_RANK: Record<'easy' | 'medium' | 'hard', number> = { easy: 0, medium: 1, hard: 2 }

    // ── Difficulty-aware path ───────────────────────────────────────────────
    if (targetDifficulty) {
      const targetRank = DIFF_RANK[targetDifficulty]

      // Step 1: Hard guardrail — 1 hard question per tag (deduplicated by object ref)
      const guardrailSet = new Set<Question>()
      const uniqueTags = [...new Set(all.flatMap(q => q.tags))]
      for (const tag of uniqueTags) {
        const hardForTag = this.shuffle(
          all.filter(q => q.difficulty === 'hard' && q.tags.includes(tag)),
        )
        for (const q of hardForTag) {
          if (!guardrailSet.has(q)) { guardrailSet.add(q); break }
        }
      }
      const guardrail = [...guardrailSet]

      // Step 2: Pools from the remaining questions (not in guardrail)
      const pool       = all.filter(q => !guardrailSet.has(q))
      const targetPool = this.shuffle(pool.filter(q => q.difficulty === targetDifficulty))
      const belowPool  = this.shuffle(pool.filter(q => DIFF_RANK[q.difficulty] < targetRank))
      const abovePool  = this.shuffle(pool.filter(q => DIFF_RANK[q.difficulty] > targetRank))

      // Step 3: Determine total N (count limit)
      const totalN = maxQuestions !== undefined
        ? Math.min(maxQuestions, all.length)
        : all.length  // for max-time or unbounded: start with all, trim later

      // Step 4: Fill slots with 60/40 split
      const slots        = Math.max(0, totalN - guardrail.length)
      const targetCount  = Math.round(slots * 0.6)
      const belowCount   = slots - targetCount
      const targetSample = targetPool.slice(0, targetCount)
      const belowSample  = belowPool.slice(0, belowCount)

      // Step 5: Fallback — fill shortfall from remaining target/below (never above)
      const usedSet   = new Set<Question>([...guardrail, ...targetSample, ...belowSample])
      const shortfall = slots - targetSample.length - belowSample.length
      const fallback  = this.shuffle(
        [...targetPool, ...belowPool].filter(q => !usedSet.has(q)),
      )
      const extra = fallback.slice(0, Math.max(0, shortfall))

      let selected = [...guardrail, ...targetSample, ...belowSample, ...extra]

      // Step 6: Apply time budget if set (sort easy-first so short warmups get priority)
      if (maxTimeSec !== undefined) {
        selected.sort((a, b) => DIFF_RANK[a.difficulty] - DIFF_RANK[b.difficulty])
        let total = 0
        selected = selected.filter(q => {
          if (total + q.timer <= maxTimeSec) { total += q.timer; return true }
          return false
        })
      }

      // Step 7: Final sort — difficulty ascending (easy → medium → hard)
      selected.sort((a, b) => DIFF_RANK[a.difficulty] - DIFF_RANK[b.difficulty])
      return selected
    }

    // ── Original path: no targetDifficulty ─────────────────────────────────
    const indices = all.map((_, i) => i)
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[indices[i], indices[j]] = [indices[j]!, indices[i]!]
    }

    let selectedIndices: number[]
    if (maxQuestions !== undefined) {
      selectedIndices = indices.slice(0, maxQuestions)
    } else {
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

    selectedIndices.sort((a, b) => a - b)
    return selectedIndices.map(i => all[i]!)
  }

  /** Transition lobby → active, broadcast game_started + first question_started event */
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
