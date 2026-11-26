import type { Quiz } from '@quizv/parser'
import type { QuestionPublic } from './types'
import { calcPoints } from './scoring'
import { serveQuestions, toPublic, type ServedQuestion } from './selection'

export type SoloStatus = 'idle' | 'question' | 'revealed' | 'finished'

export interface SoloAnswer {
  deckIndex: number
  /** Original choice indices (as authored in the deck), sorted ascending. Empty on timeout. */
  choices: number[]
  answerTimeMs: number
}

export interface SoloResult {
  isCorrect: boolean
  points: number
  /** Shown (renamed) choice ids. */
  correctIds: string[]
  explanation?: string
  answered: boolean
  answerTimeMs: number
}

export interface SoloRunSubmission {
  deckId: string
  deckVersion: string
  pseudo: string
  /** One per served question, in play order. */
  answers: SoloAnswer[]
}

interface SoloOptions {
  quiz: Quiz
  deckId: string
  deckVersion: string
  pseudo: string
  now?: () => number
}

/**
 * Pure state machine driving a solo run: start() → [answer()|timeout() → next()]* → finished.
 * Time spent on the correction screen is never counted: the clock restarts at each next().
 */
export class SoloSession {
  private readonly quiz: Quiz
  private readonly deckId: string
  private readonly deckVersion: string
  private readonly pseudo: string
  private readonly now: () => number

  private served: ServedQuestion[] = []
  private _status: SoloStatus = 'idle'
  private _index = 0
  private shownAt = 0
  private _score = 0
  private _correctCount = 0
  private _totalTimeMs = 0
  private _lastResult: SoloResult | null = null
  private answers: SoloAnswer[] = []

  constructor(opts: SoloOptions) {
    this.quiz = opts.quiz
    this.deckId = opts.deckId
    this.deckVersion = opts.deckVersion
    this.pseudo = opts.pseudo
    this.now = opts.now ?? Date.now
  }

  get status(): SoloStatus { return this._status }
  get index(): number { return this._index }
  get total(): number { return this.served.length }
  get score(): number { return this._score }
  get correctCount(): number { return this._correctCount }
  get totalTimeMs(): number { return this._totalTimeMs }
  get lastResult(): SoloResult | null { return this._lastResult }

  /** Current question without `isCorrect`; null outside the question and correction phases. */
  get question(): QuestionPublic | null {
    const q = this.served[this._index]
    if (!q || (this._status !== 'question' && this._status !== 'revealed')) return null
    return toPublic(q, this._index, this.quiz.meta.oneShoot)
  }

  /** Absolute time (per the injected clock) at which the current question times out. */
  get deadlineMs(): number | null {
    const q = this.served[this._index]
    if (!q || this._status !== 'question') return null
    return this.shownAt + q.timer * 1000
  }

  start(): void {
    if (this._status !== 'idle') return
    this.served = serveQuestions(this.quiz)
    if (this.served.length === 0) {
      this._status = 'finished'
      return
    }
    this._index = 0
    this.show()
  }

  answer(choiceIds: string[]): void {
    if (this._status !== 'question') return
    const q = this.served[this._index]!
    const timerMs = Math.round(q.timer * 1000)
    const elapsed = Math.round(Math.min(timerMs, Math.max(0, this.now() - this.shownAt)))
    const correctIds = q.choices.filter(c => c.isCorrect).map(c => c.id)
    // Same exact-match rule as GameEngine.revealAnswer
    const isCorrect =
      correctIds.every(id => choiceIds.includes(id)) &&
      choiceIds.every(id => correctIds.includes(id))
    const choices = q.choices
      .map((c, i) => (choiceIds.includes(c.id) ? q.choiceOrder[i]! : -1))
      .filter(i => i >= 0)
      .sort((a, b) => a - b)
    this.reveal(q, { isCorrect, answered: true, elapsed, correctIds, choices })
  }

  timeout(): void {
    if (this._status !== 'question') return
    const q = this.served[this._index]!
    const correctIds = q.choices.filter(c => c.isCorrect).map(c => c.id)
    this.reveal(q, { isCorrect: false, answered: false, elapsed: Math.round(q.timer * 1000), correctIds, choices: [] })
  }

  next(): void {
    if (this._status !== 'revealed') return
    if (this._index + 1 >= this.served.length) {
      this._status = 'finished'
      return
    }
    this._index++
    this.show()
  }

  toSubmission(): SoloRunSubmission {
    if (this._status !== 'finished') throw new Error('Solo run is not finished')
    return {
      deckId: this.deckId,
      deckVersion: this.deckVersion,
      pseudo: this.pseudo,
      answers: this.answers.map(a => ({ ...a, choices: [...a.choices] })),
    }
  }

  private show(): void {
    this.shownAt = this.now()
    this._lastResult = null
    this._status = 'question'
  }

  private reveal(
    q: ServedQuestion,
    r: { isCorrect: boolean; answered: boolean; elapsed: number; correctIds: string[]; choices: number[] },
  ): void {
    const points = calcPoints(Math.max(0, q.timer - r.elapsed / 1000), r.isCorrect)
    this._score += points
    if (r.isCorrect) this._correctCount++
    this._totalTimeMs += r.elapsed
    this.answers.push({ deckIndex: q.deckIndex, choices: r.choices, answerTimeMs: r.elapsed })
    this._lastResult = {
      isCorrect: r.isCorrect,
      points,
      correctIds: r.correctIds,
      explanation: q.explanation,
      answered: r.answered,
      answerTimeMs: r.elapsed,
    }
    this._status = 'revealed'
  }
}
