import type { PlayerState, QuestionPublic, Score, PodiumEntry } from './types'

export type GameEvent =
  | { type: 'player_joined';    player: PlayerState }
  | { type: 'player_left';      playerId: string }
  | { type: 'game_started' }
  | { type: 'question_started'; question: QuestionPublic; idx: number }
  | { type: 'timer_tick';       remaining: number }
  | { type: 'answer_submitted'; playerId: string }
  | { type: 'answer_revealed';  correct: string[]; explanation: string | undefined; scores: Score[] }
  | { type: 'next_question';    idx: number }
  | { type: 'game_ended';       podium: PodiumEntry[] }

/** Type-safe event builder helpers */
export const GameEvents = {
  playerJoined: (player: PlayerState): GameEvent => ({ type: 'player_joined', player }),
  playerLeft: (playerId: string): GameEvent => ({ type: 'player_left', playerId }),
  gameStarted: (): GameEvent => ({ type: 'game_started' }),
  questionStarted: (question: QuestionPublic, idx: number): GameEvent =>
    ({ type: 'question_started', question, idx }),
  timerTick: (remaining: number): GameEvent => ({ type: 'timer_tick', remaining }),
  answerSubmitted: (playerId: string): GameEvent => ({ type: 'answer_submitted', playerId }),
  answerRevealed: (
    correct: string[],
    explanation: string | undefined,
    scores: Score[]
  ): GameEvent => ({ type: 'answer_revealed', correct, explanation, scores }),
  nextQuestion: (idx: number): GameEvent => ({ type: 'next_question', idx }),
  gameEnded: (podium: PodiumEntry[]): GameEvent => ({ type: 'game_ended', podium }),
} as const
