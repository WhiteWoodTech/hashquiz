export interface PlayerState {
  id: string
  pseudo: string
  email: string
  score: number
  joinedAt: number  // Unix ms
  /** Unix ms when the socket closed; absent while connected. Used for grace-period cleanup. */
  disconnectedAt?: number
}

export interface Score {
  playerId: string
  pseudo: string
  score: number
  delta: number     // points gained this round
}

export interface PodiumEntry {
  rank: number
  playerId: string
  pseudo: string
  score: number
}

/** Question as sent to players (no isCorrect info) */
export interface QuestionPublic {
  idx: number
  type: 'single' | 'multiple'
  timer: number
  difficulty: 'easy' | 'medium' | 'hard'
  text: string
  choices: Array<{ id: string; text: string }>  // isCorrect stripped
  oneShoot: boolean
  tags: string[]
}

export type GameStatus = 'idle' | 'lobby' | 'active' | 'finished'

export interface GameState {
  sessionId: string
  joinCode: string
  status: GameStatus
  players: Map<string, PlayerState>
  currentQuestionIdx: number
  totalQuestions: number
  /** Unix ms at which the current question's timer expires. Absent outside the question phase. */
  currentQuestionDeadlineMs?: number
}

export interface QuizInfo {
  title: string
  description?: string
  tags: string[]
  totalQuestions: number
  targetDifficulty?: 'easy' | 'medium' | 'hard'
  /** Each value is a percentage in [0, 100]; the three values must sum to 100 */
  difficultyDistribution: {
    easy: number
    medium: number
    hard: number
  }
  /** Questions in the deck; above `totalQuestions` when a game plays only part of them. */
  poolSize?: number
  /** Questions drawn at random from the deck (max-questions, max-time or target-difficulty), not a fixed list. */
  randomDraw?: boolean
  /** one-shoot: the first answer is final. */
  oneShoot?: boolean
}
