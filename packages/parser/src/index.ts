import { splitBlocks } from './split'
import { parseMeta } from './parse-meta'
import { parseQuestion } from './parse-question'
import type { Quiz, ValidationResult } from './types'

export type { Quiz, QuizMeta, Question, Choice, ValidationResult, ValidationError } from './types'

/**
 * Parse a full .quizv.md file content into a typed Quiz object.
 * Throws if the file cannot be parsed at all.
 */
export function parseQuizFile(content: string): Quiz {
  const blocks = splitBlocks(content)

  if (blocks.length === 0) {
    return { meta: { title: '', theme: 'default', tags: [] }, questions: [] }
  }

  const [metaBlock, ...questionBlocks] = blocks as [string, ...string[]]
  const meta = parseMeta(metaBlock)
  const questions = questionBlocks.map(parseQuestion)

  return { meta, questions }
}

/**
 * Validate a parsed Quiz and return a result with any errors found.
 */
export function validateQuiz(quiz: Quiz): ValidationResult {
  const errors: Array<{ questionIndex?: number; field: string; message: string }> = []

  if (!quiz.meta.title) {
    errors.push({ field: 'title', message: 'Quiz must have a title' })
  }

  if (quiz.questions.length === 0) {
    errors.push({ field: 'questions', message: 'Quiz must have at least one question' })
  }

  if (quiz.meta.maxQuestions !== undefined && quiz.meta.maxTimeSec !== undefined) {
    errors.push({
      field: 'max-questions',
      message: 'max-questions and max-time are mutually exclusive — use only one',
    })
  }

  for (const [i, q] of quiz.questions.entries()) {
    const correctCount = q.choices.filter(c => c.isCorrect).length
    if (correctCount === 0) {
      errors.push({
        questionIndex: i,
        field: 'choices',
        message: `Question ${i + 1} has no correct answer`,
      })
    }
    if (q.choices.length < 2) {
      errors.push({
        questionIndex: i,
        field: 'choices',
        message: `Question ${i + 1} must have at least 2 choices`,
      })
    }
    if (q.choices.length > 4) {
      errors.push({
        questionIndex: i,
        field: 'choices',
        message: `Question ${i + 1} has ${q.choices.length} choices; QuizV supports at most 4`,
      })
    }
  }

  return { valid: errors.length === 0, errors }
}
