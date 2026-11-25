import type { PlayerState, QuestionPublic, Score, PodiumEntry, QuizInfo } from './types'

export interface StateSnapshot {
  phase: 'lobby' | 'question' | 'revealed' | 'finished'
  quizMeta: QuizInfo
  totalScore: number
  playerCount: number
  question?: QuestionPublic
  questionIdx?: number
  /** Unix ms when the timer for `question` will expire. Late submissions allowed before this. */
  deadlineMs?: number
  /** Set when phase is 'revealed' — last reveal payload so the UI can render feedback on rejoin. */
  reveal?: { correct: string[]; explanation: string | undefined; scores: Score[]; choiceCounts: Record<string, number> }
  /** Set when phase is 'finished'. */
  podium?: PodiumEntry[]
}

export type GameEvent =
  | { type: 'player_joined';    player: PlayerState }
  | { type: 'player_rejoined';  playerId: string }
  | { type: 'player_left';      playerId: string }
  | { type: 'game_started' }
  | { type: 'question_started'; question: QuestionPublic; idx: number; deadlineMs: number }
  | { type: 'timer_tick';       remaining: number }
  | { type: 'answer_submit';    playerId: string; choiceIds: string[]; timeRemaining: number }
  | { type: 'answer_submitted'; playerId: string }
  | { type: 'answer_revealed';  correct: string[]; explanation: string | undefined; scores: Score[]; choiceCounts: Record<string, number> }
  | { type: 'next_question';    idx: number }
  | { type: 'game_ended';       podium: PodiumEntry[] }
  /** Host chose "Rejouer": back to the lobby of the same room, scores reset to 0. */
  | { type: 'game_reset' }
  | { type: 'state_request';    playerId: string }
  | { type: 'state_snapshot';   playerId: string; snapshot: StateSnapshot }

/** Type-safe event builder helpers */
export const GameEvents = {
  playerJoined: (player: PlayerState): GameEvent => ({ type: 'player_joined', player }),
  playerRejoined: (playerId: string): GameEvent => ({ type: 'player_rejoined', playerId }),
  playerLeft: (playerId: string): GameEvent => ({ type: 'player_left', playerId }),
  gameStarted: (): GameEvent => ({ type: 'game_started' }),
  questionStarted: (question: QuestionPublic, idx: number, deadlineMs: number): GameEvent =>
    ({ type: 'question_started', question, idx, deadlineMs }),
  timerTick: (remaining: number): GameEvent => ({ type: 'timer_tick', remaining }),
  answerSubmit: (playerId: string, choiceIds: string[], timeRemaining: number): GameEvent =>
    ({ type: 'answer_submit', playerId, choiceIds, timeRemaining }),
  answerSubmitted: (playerId: string): GameEvent => ({ type: 'answer_submitted', playerId }),
  answerRevealed: (
    correct: string[],
    explanation: string | undefined,
    scores: Score[],
    choiceCounts: Record<string, number>
  ): GameEvent => ({ type: 'answer_revealed', correct, explanation, scores, choiceCounts }),
  nextQuestion: (idx: number): GameEvent => ({ type: 'next_question', idx }),
  gameEnded: (podium: PodiumEntry[]): GameEvent => ({ type: 'game_ended', podium }),
  gameReset: (): GameEvent => ({ type: 'game_reset' }),
  stateRequest: (playerId: string): GameEvent => ({ type: 'state_request', playerId }),
  stateSnapshot: (playerId: string, snapshot: StateSnapshot): GameEvent =>
    ({ type: 'state_snapshot', playerId, snapshot }),
} as const
