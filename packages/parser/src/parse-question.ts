import matter from 'gray-matter'
import type { Question, Choice } from './types'

const CHOICE_IDS = ['a', 'b', 'c', 'd', 'e', 'f']

/**
 * Parse one question block (frontmatter + markdown body).
 *
 * Format:
 *   ---
 *   type: single
 *   timer: 20
 *   difficulty: easy
 *   ---
 *
 *   # Question text
 *
 *   - [ ] Wrong answer
 *   - [x] Correct answer
 *
 *   > Explanation text
 */
export function parseQuestion(rawBlock: string): Question {
  // Block may start with `---` frontmatter or be plain markdown if no frontmatter
  let frontmatterData: Record<string, unknown> = {}
  let body = rawBlock

  if (rawBlock.startsWith('---')) {
    // gray-matter handles the frontmatter + rest
    const result = matter(rawBlock)
    frontmatterData = result.data as Record<string, unknown>
    body = result.content.trim()
  }

  // Extract question heading (first # line)
  const headingMatch = body.match(/^# (.+)$/m)
  const questionText = headingMatch ? headingMatch[1]!.trim() : ''

  // Extract choices from GFM task list items
  const choiceRegex = /^-\s+\[(x| )\]\s+(.+)$/gm
  const choices: Choice[] = []
  let match: RegExpExecArray | null
  let idx = 0
  while ((match = choiceRegex.exec(body)) !== null) {
    choices.push({
      id: CHOICE_IDS[idx] ?? String(idx),
      text: match[2]!.trim(),
      isCorrect: match[1] === 'x',
    })
    idx++
  }

  // Extract explanation from blockquote (> lines)
  const blockquoteRegex = /^>\s+(.+)$/gm
  const explanationLines: string[] = []
  while ((match = blockquoteRegex.exec(body)) !== null) {
    explanationLines.push(match[1]!.trim())
  }
  const explanation = explanationLines.length > 0 ? explanationLines.join(' ') : undefined

  // Determine type: use frontmatter if set, otherwise infer from choices
  const correctCount = choices.filter(c => c.isCorrect).length
  const inferredType: 'single' | 'multiple' = correctCount > 1 ? 'multiple' : 'single'
  const type: 'single' | 'multiple' =
    frontmatterData['type'] === 'multiple' || frontmatterData['type'] === 'single'
      ? (frontmatterData['type'] as 'single' | 'multiple')
      : inferredType

  const timer = typeof frontmatterData['timer'] === 'number' ? frontmatterData['timer'] : 20
  const difficulty =
    frontmatterData['difficulty'] === 'easy' ||
    frontmatterData['difficulty'] === 'medium' ||
    frontmatterData['difficulty'] === 'hard'
      ? (frontmatterData['difficulty'] as 'easy' | 'medium' | 'hard')
      : 'medium'
  const tags = Array.isArray(frontmatterData['tags'])
    ? (frontmatterData['tags'] as string[])
    : []

  return { type, timer, difficulty, tags, text: questionText, choices, explanation }
}
