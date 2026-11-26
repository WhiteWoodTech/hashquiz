import type { Quiz, Question } from '@quizv/parser'
import type { QuestionPublic } from './types'

/** A question as served to players, with provenance back to the authored deck. */
export interface ServedQuestion extends Question {
  /** Index of the question in `quiz.questions`. */
  deckIndex: number
  /** `choiceOrder[i]` = original index of the choice shown at position `i` (ids already renamed a/b/c/d). */
  choiceOrder: number[]
}

/** Position-keyed IDs reassigned to choices after shuffling. Questions are capped at 4 choices. */
const POSITIONAL_IDS = ['a', 'b', 'c', 'd'] as const

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

export function selectQuestions(quiz: Quiz): Question[] {
  const { maxQuestions, maxTimeSec, targetDifficulty } = quiz.meta
  const all = quiz.questions

  if (!maxQuestions && !maxTimeSec && !targetDifficulty) return all

  const DIFF_RANK: Record<'easy' | 'medium' | 'hard', number> = { easy: 0, medium: 1, hard: 2 }

  // ── Difficulty-aware path ───────────────────────────────────────────────
  if (targetDifficulty) {
    const targetRank = DIFF_RANK[targetDifficulty]

    // Step 1: Hard guardrail — 1 hard question per tag (deduplicated by object ref)
    const guardrailSet = new Set<Question>()
    const uniqueTags = [...new Set(all.flatMap(q => q.tags))]
    for (const tag of uniqueTags) {
      const hardForTag = shuffle(
        all.filter(q => q.difficulty === 'hard' && q.tags.includes(tag)),
      )
      for (const q of hardForTag) {
        if (!guardrailSet.has(q)) { guardrailSet.add(q); break }
      }
    }
    const guardrail = [...guardrailSet]

    // Step 2: Pools from the remaining questions (not in guardrail)
    const pool       = all.filter(q => !guardrailSet.has(q))
    const targetPool = shuffle(pool.filter(q => q.difficulty === targetDifficulty))
    const belowPool  = shuffle(pool.filter(q => DIFF_RANK[q.difficulty] < targetRank))
    const abovePool  = shuffle(pool.filter(q => DIFF_RANK[q.difficulty] > targetRank))

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
    const fallback  = shuffle(
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

/**
 * Shuffle a question's choices and reassign positional IDs (a/b/c/d) so the badge letter
 * displayed by the UI keeps matching the visual position while the correct answer's letter
 * varies between games. Also returns the permutation applied (shown position -> original index).
 */
function shuffleWithOrder(question: Question): { question: Question; order: number[] } {
  const order = question.choices.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j]!, order[i]!]
  }
  const renamed = order.map((o, i) => ({ ...question.choices[o]!, id: POSITIONAL_IDS[i] ?? question.choices[o]!.id }))
  return { question: { ...question, choices: renamed }, order }
}

/** Pure: returns a new Question with shuffled choices, leaves the input untouched. */
export function shuffleChoices(question: Question): Question {
  return shuffleWithOrder(question).question
}

/** Select questions per the quiz meta, shuffle each one's choices, and record provenance. */
export function serveQuestions(quiz: Quiz): ServedQuestion[] {
  return selectQuestions(quiz).map(q => {
    const { question, order } = shuffleWithOrder(q)
    return { ...question, deckIndex: quiz.questions.indexOf(q), choiceOrder: order }
  })
}

/** Maps a Question to QuestionPublic (strips isCorrect from choices) */
export function toPublic(question: Question, idx: number, oneShoot: boolean): QuestionPublic {
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
