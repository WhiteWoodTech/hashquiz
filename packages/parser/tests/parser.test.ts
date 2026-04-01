import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseQuizFile, validateQuiz } from '../src/index'

const fixture = (name: string) =>
  readFileSync(join(import.meta.dir, 'fixtures', name), 'utf-8')

describe('parseQuizFile', () => {
  test('parses quiz meta from first frontmatter block', () => {
    const quiz = parseQuizFile(fixture('valid.quizv.md'))
    expect(quiz.meta.title).toBe('Demo Quiz')
    expect(quiz.meta.description).toBe('A test quiz')
    expect(quiz.meta.theme).toBe('default')
    expect(quiz.meta.author).toBe('Test')
    expect(quiz.meta.tags).toEqual(['test'])
  })

  test('parses correct number of questions', () => {
    const quiz = parseQuizFile(fixture('valid.quizv.md'))
    expect(quiz.questions).toHaveLength(2)
  })

  test('parses single-choice question', () => {
    const quiz = parseQuizFile(fixture('valid.quizv.md'))
    const q = quiz.questions[0]!
    expect(q.type).toBe('single')
    expect(q.timer).toBe(20)
    expect(q.difficulty).toBe('easy')
    expect(q.tags).toEqual(['basics'])
    expect(q.text).toBe('What color is the sky?')
    expect(q.choices).toHaveLength(4)
    expect(q.choices.filter(c => c.isCorrect)).toHaveLength(1)
    expect(q.choices.find(c => c.isCorrect)?.text).toBe('Blue')
  })

  test('parses multiple-choice question', () => {
    const quiz = parseQuizFile(fixture('valid.quizv.md'))
    const q = quiz.questions[1]!
    expect(q.type).toBe('multiple')
    expect(q.choices.filter(c => c.isCorrect)).toHaveLength(3)
  })

  test('parses explanation from blockquote', () => {
    const quiz = parseQuizFile(fixture('valid.quizv.md'))
    expect(quiz.questions[0]!.explanation).toBe(
      'The sky is blue due to Rayleigh scattering.'
    )
  })

  test('assigns sequential choice ids a/b/c/d', () => {
    const quiz = parseQuizFile(fixture('valid.quizv.md'))
    const ids = quiz.questions[0]!.choices.map(c => c.id)
    expect(ids).toEqual(['a', 'b', 'c', 'd'])
  })

  test('infers type:multiple when multiple [x] present and type not set', () => {
    const quiz = parseQuizFile(fixture('multi-correct.quizv.md'))
    expect(quiz.questions[0]!.type).toBe('multiple')
  })

  test('defaults missing optional meta fields', () => {
    const quiz = parseQuizFile(fixture('missing-title.quizv.md'))
    expect(quiz.meta.tags).toEqual([])
    expect(quiz.meta.author).toBeUndefined()
  })
})

describe('validateQuiz', () => {
  test('returns valid:true for valid quiz', () => {
    const quiz = parseQuizFile(fixture('valid.quizv.md'))
    const result = validateQuiz(quiz)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  test('returns error when title is missing', () => {
    const quiz = parseQuizFile(fixture('missing-title.quizv.md'))
    const result = validateQuiz(quiz)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.field === 'title')).toBe(true)
  })

  test('returns error when no questions', () => {
    const quiz = parseQuizFile('---\ntitle: Empty\ntheme: default\ntags: []\n---\n')
    const result = validateQuiz(quiz)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.field === 'questions')).toBe(true)
  })

  test('returns error when both max-questions and max-time are set', () => {
    const content = `---
title: T
theme: default
tags: []
max-questions: 3
max-time: 5m
---
---
type: single
timer: 20
difficulty: easy
---
# Q?
- [x] A
- [ ] B
`
    const quiz = parseQuizFile(content)
    const result = validateQuiz(quiz)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.field === 'max-questions')).toBe(true)
  })

  test('returns error when question has no correct answer', () => {
    const content = `---
title: Bad Quiz
theme: default
tags: []
---

---
type: single
timer: 20
difficulty: easy
---

# No correct answer?

- [ ] Option A
- [ ] Option B
`
    const quiz = parseQuizFile(content)
    const result = validateQuiz(quiz)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.field === 'choices' && e.questionIndex === 0)).toBe(true)
  })
})

describe('parseMeta — new fields', () => {
  test('one-shoot defaults to true when absent', () => {
    const quiz = parseQuizFile(fixture('valid.quizv.md'))
    expect(quiz.meta.oneShoot).toBe(true)
  })

  test('one-shoot: false is parsed correctly', () => {
    const content = `---
title: T
theme: default
tags: []
one-shoot: false
---
---
type: single
timer: 20
difficulty: easy
---
# Q?
- [x] A
- [ ] B
`
    const quiz = parseQuizFile(content)
    expect(quiz.meta.oneShoot).toBe(false)
  })

  test('max-questions is parsed as number', () => {
    const content = `---
title: T
theme: default
tags: []
max-questions: 5
---
---
type: single
timer: 20
difficulty: easy
---
# Q?
- [x] A
- [ ] B
`
    const quiz = parseQuizFile(content)
    expect(quiz.meta.maxQuestions).toBe(5)
  })

  test('max-time integer (no suffix) parsed as minutes to seconds', () => {
    const content = `---
title: T
theme: default
tags: []
max-time: 5
---
---
type: single
timer: 20
difficulty: easy
---
# Q?
- [x] A
- [ ] B
`
    const quiz = parseQuizFile(content)
    expect(quiz.meta.maxTimeSec).toBe(300)
  })

  test('max-time with m suffix parsed as seconds', () => {
    const content = `---
title: T
theme: default
tags: []
max-time: 3m
---
---
type: single
timer: 20
difficulty: easy
---
# Q?
- [x] A
- [ ] B
`
    const quiz = parseQuizFile(content)
    expect(quiz.meta.maxTimeSec).toBe(180)
  })

  test('max-time with s suffix parsed as seconds directly', () => {
    const content = `---
title: T
theme: default
tags: []
max-time: 90s
---
---
type: single
timer: 20
difficulty: easy
---
# Q?
- [x] A
- [ ] B
`
    const quiz = parseQuizFile(content)
    expect(quiz.meta.maxTimeSec).toBe(90)
  })

  test('max-questions undefined when absent', () => {
    const quiz = parseQuizFile(fixture('valid.quizv.md'))
    expect(quiz.meta.maxQuestions).toBeUndefined()
  })

  test('max-time undefined when absent', () => {
    const quiz = parseQuizFile(fixture('valid.quizv.md'))
    expect(quiz.meta.maxTimeSec).toBeUndefined()
  })

  test('target-difficulty is parsed as enum value', () => {
    const content = `---
title: T
theme: default
tags: []
target-difficulty: hard
---
---
type: single
timer: 20
difficulty: easy
---
# Q?
- [x] A
- [ ] B
`
    const quiz = parseQuizFile(content)
    expect(quiz.meta.targetDifficulty).toBe('hard')
  })

  test('target-difficulty: medium is parsed', () => {
    const content = `---
title: T
theme: default
tags: []
target-difficulty: medium
---
---
type: single
timer: 20
difficulty: easy
---
# Q?
- [x] A
- [ ] B
`
    const quiz = parseQuizFile(content)
    expect(quiz.meta.targetDifficulty).toBe('medium')
  })

  test('target-difficulty undefined when absent', () => {
    const quiz = parseQuizFile(fixture('valid.quizv.md'))
    expect(quiz.meta.targetDifficulty).toBeUndefined()
  })

  test('target-difficulty invalid value is ignored (undefined)', () => {
    const content = `---
title: T
theme: default
tags: []
target-difficulty: extreme
---
---
type: single
timer: 20
difficulty: easy
---
# Q?
- [x] A
- [ ] B
`
    const quiz = parseQuizFile(content)
    expect(quiz.meta.targetDifficulty).toBeUndefined()
  })
})
