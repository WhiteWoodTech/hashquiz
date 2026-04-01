export interface PlayerState {
  id: string
  pseudo: string
  email: string
  score: number
  joinedAt: number  // Unix ms
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
}

export type GameStatus = 'idle' | 'lobby' | 'active' | 'finished'

export interface GameState {
  sessionId: string
  joinCode: string
  status: GameStatus
  players: Map<string, PlayerState>
  currentQuestionIdx: number
  totalQuestions: number
}

export interface QuizInfo {
  title: string
  description?: string
  tags: string[]
  totalQuestions: number
  targetDifficulty?: 'easy' | 'medium' | 'hard'
  difficultyDistribution: {
    easy: number    // pourcentage 0–100
    medium: number
    hard: number
  }
}
