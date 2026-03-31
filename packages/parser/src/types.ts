export interface QuizMeta {
  title: string
  description?: string
  theme: string
  author?: string
  tags: string[]
}

export interface Choice {
  id: string        // 'a' | 'b' | 'c' | 'd' | 'e'
  text: string
  isCorrect: boolean
}

export interface Question {
  type: 'single' | 'multiple'
  timer: number
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
  text: string          // raw markdown (heading text)
  choices: Choice[]
  explanation?: string  // text from blockquote, raw markdown
}

export interface Quiz {
  meta: QuizMeta
  questions: Question[]
}

export interface ValidationError {
  questionIndex?: number
  field: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}
