# QuizV Format Specification (`.quizv.md`)

Complete reference for the `.quizv.md` file format, derived from the `@quizv/parser` package.

## File Structure

A `.quizv.md` file consists of a **quiz-level frontmatter** block followed by **question blocks** separated by `---`:

```markdown
---
title: Quiz Title
description: Optional description
theme: default
author: Author Name
tags: [tag1, tag2]
---

---
type: single
timer: 20
difficulty: easy
tags: [topic]
---

## Question text here

- [ ] Wrong answer
- [x] Correct answer
- [ ] Another wrong answer

> Explanation text (optional)
```

## Quiz-Level Frontmatter

| Field | Frontmatter Key | Type | Required | Default | Notes |
|-------|----------------|------|----------|---------|-------|
| title | `title` | string | Yes | — | Must not be empty |
| description | `description` | string | No | — | Descriptive text |
| theme | `theme` | string | Yes | `'default'` | Theme identifier |
| author | `author` | string | No | — | Author name |
| tags | `tags` | string[] | Yes | `[]` | Array of tags |
| oneShoot | `one-shoot` | boolean | No | `true` | Prevent immediate retake |
| maxQuestions | `max-questions` | number | No | — | Max questions to display (positive) |
| maxTimeSec | `max-time` | number/string | No | — | Time limit: bare number or `'Xm'` = minutes, `'Xs'` = seconds |
| targetDifficulty | `target-difficulty` | string | No | — | `'easy'`, `'medium'`, or `'hard'` |

**Constraints:**

- `max-questions` and `max-time` are **mutually exclusive** — use only one
- Invalid `target-difficulty` values are silently ignored

## Question-Level Frontmatter

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| type | `'single'` \| `'multiple'` | No | Inferred | Auto-inferred from number of correct answers |
| timer | number | No | `20` | Time limit in seconds |
| difficulty | `'easy'` \| `'medium'` \| `'hard'` | No | `'medium'` | Difficulty level |
| tags | string[] | No | `[]` | Question-specific tags |

**Type inference:** If `type` is omitted, the parser counts correct answers:

- 1 correct answer -> `'single'`
- 2+ correct answers -> `'multiple'`

## Question Body Format

Each question block contains:

1. **Heading** (`##`): The question text (`##` heading)
2. **Choices** (GFM task list):
   - `- [ ] Text` for wrong answers
   - `- [x] Text` for correct answers
3. **Explanation** (optional blockquote): `> Text` lines joined with spaces

## Validation Rules

| Rule | Constraint | Enforced by |
|------|-----------|-------------|
| Quiz title | Must not be empty | Parser |
| At least one question | `questions.length > 0` | Parser |
| Mutually exclusive limits | Cannot set both `max-questions` AND `max-time` | Parser |
| Correct answers | Each question must have at least 1 correct answer | Parser |
| Minimum choices | Each question must have at least 2 choices | Parser |
| **Exact choice count** | **Each question MUST have exactly 4 choices** | **Authoring convention (UI is 2×2 grid)** |
| At least one distractor | Each question keeps **≥1 wrong choice** (so ≤3 correct out of 4) | Authoring convention |
| Multi-select phrasing | If the question says "select N" / "sélectionnez N", then `N < 4` | Authoring convention |

The "exact choice count" rule is **not** enforced by the parser — verify manually before committing:

```bash
awk '/^##[^#]/ { if (q) print q ": " n; q=$0; n=0 } /^- \[[ x]\]/ { n++ } END { if (q) print q ": " n }' \
  <file> | grep -v ": 4$"
```

Empty output means every question has exactly 4 choices.

## Choice IDs

Choices are auto-assigned IDs sequentially: `'a'`, `'b'`, `'c'`, `'d'`, `'e'`, `'f'`, then string indices.

## Validation Command

```bash
bun run packages/server/src/cli.ts check <file>
```
