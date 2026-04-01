import matter from 'gray-matter'
import type { QuizMeta } from './types'

function parseMaxTime(raw: unknown): number | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw === 'number') return raw * 60          // bare number = minutes
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (trimmed.endsWith('s')) {
      const n = parseInt(trimmed, 10)
      return isNaN(n) ? undefined : n
    }
    if (trimmed.endsWith('m')) {
      const n = parseInt(trimmed, 10)
      return isNaN(n) ? undefined : n * 60
    }
    const n = parseInt(trimmed, 10)
    return isNaN(n) ? undefined : n * 60                // no suffix = minutes
  }
  return undefined
}

/**
 * Parse the quiz-level frontmatter block (first `---` block in the file).
 * The raw block may or may not have leading/trailing `---` lines.
 * gray-matter expects a string starting with `---` and ending with `---`.
 */
export function parseMeta(rawBlock: string): QuizMeta {
  // Ensure the block is wrapped in frontmatter delimiters
  let wrapped: string
  if (rawBlock.startsWith('---')) {
    // Has opening delimiter — check if it also has a structural closing delimiter
    // Only the first occurrence of a bare `---` line after line 0 counts.
    const lines = rawBlock.split('\n')
    const hasClosing = lines.slice(1).findIndex(l => l === '---') !== -1
    wrapped = hasClosing ? rawBlock : `${rawBlock}\n---`
  } else {
    wrapped = `---\n${rawBlock}\n---`
  }
  const { data } = matter(wrapped)

  return {
    title: typeof data['title'] === 'string' ? data['title'] : '',
    description: typeof data['description'] === 'string' ? data['description'] : undefined,
    theme: typeof data['theme'] === 'string' ? data['theme'] : 'default',
    author: typeof data['author'] === 'string' ? data['author'] : undefined,
    tags: Array.isArray(data['tags']) ? (data['tags'] as string[]) : [],
    oneShoot: data['one-shoot'] !== false,
    maxQuestions:
      typeof data['max-questions'] === 'number' && data['max-questions'] > 0
        ? data['max-questions']
        : undefined,
    maxTimeSec: parseMaxTime(data['max-time']),
    targetDifficulty: ['easy', 'medium', 'hard'].includes(data['target-difficulty'] as string)
      ? (data['target-difficulty'] as 'easy' | 'medium' | 'hard')
      : undefined,
  }
}
