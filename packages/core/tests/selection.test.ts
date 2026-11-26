import { describe, test, expect } from 'bun:test'
import type { Quiz, Question } from '@quizv/parser'
import { serveQuestions } from '../src/selection'

const makeQuestion = (n: number): Question => ({
  type: 'single',
  timer: 20,
  difficulty: 'easy',
  tags: [],
  text: `Q${n}?`,
  choices: [
    { id: 'a', text: `Q${n}-A`, isCorrect: false },
    { id: 'b', text: `Q${n}-B`, isCorrect: true },
    { id: 'c', text: `Q${n}-C`, isCorrect: false },
    { id: 'd', text: `Q${n}-D`, isCorrect: false },
  ],
})

const makeQuiz = (extra: Partial<Quiz['meta']> = {}): Quiz => ({
  meta: { title: 'Test', theme: 'default', tags: [], oneShoot: true, ...extra },
  questions: [1, 2, 3, 4, 5].map(makeQuestion),
})

describe('serveQuestions', () => {
  test('serveQuestions keeps provenance', () => {
    const quiz = makeQuiz()
    for (let run = 0; run < 20; run++) {
      for (const q of serveQuestions(quiz)) {
        const original = quiz.questions[q.deckIndex]!
        expect(q.choiceOrder).toHaveLength(q.choices.length)
        q.choices.forEach((c, i) => {
          const src = original.choices[q.choiceOrder[i]!]!
          expect(src.text).toBe(c.text)
          expect(src.isCorrect).toBe(c.isCorrect)
          expect(c.id).toBe(['a', 'b', 'c', 'd'][i]!)
        })
      }
    }
  })

  test('serveQuestions respects max-questions', () => {
    const served = serveQuestions(makeQuiz({ maxQuestions: 2 }))
    expect(served).toHaveLength(2)
    expect(new Set(served.map(q => q.deckIndex)).size).toBe(2)
  })
})
