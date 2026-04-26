---
description: Generate quiz questions in index.quizv.md from an existing plan.md
argument-hint: "[deck-slug]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

# Generate Quiz Questions

Generate the full quiz content in `index.quizv.md` from an existing `plan.md`.

## Instructions

Read the skill reference first: load `skills/building-quizv-decks/references/quizv-format.md` from `${CLAUDE_PLUGIN_ROOT}`.

### Step 1 — Detect the Deck

Find the target deck:

1. Check if the user has a file open in the IDE that is inside a `decks/<slug>/` directory — use that deck
2. If `$ARGUMENTS` is provided, treat it as the deck slug and look for `decks/<slug>/`
3. Otherwise, list available decks in `decks/` and ask the user which one to generate

Verify that `decks/<slug>/index.quizv.md` exists.

### Step 2 — Read Plan and Context

1. **Read `decks/<slug>/plan.md`** — this is the primary guide for question generation.
If no plan exists, warn the user and suggest running `/quizv:plan` first. If they want to proceed without a plan,
ask them what questions they want and generate directly.
2. **Read the frontmatter** of `index.quizv.md` to get quiz metadata
3. **Read source files** in `decks/<slug>/sources/` for accurate content to base questions on

### Step 3 — Generate Questions

Write the complete `index.quizv.md` file with:

1. **Keep the existing frontmatter** exactly as-is from the scaffold
2. **Generate each question** following the plan, in order

For each question, follow this exact format:

```markdown

---
type: {single|multiple}
timer: {seconds}
difficulty: {easy|medium|hard}
tags: [{tag1}, {tag2}]
---

## {Question text}

- [ ] {Wrong answer}
- [x] {Correct answer}
- [ ] {Wrong answer}
- [ ] {Wrong answer}

> {Explanation text — always include one}
```

### Question Quality Rules

1. **Exactly match the `.quizv.md` format** — frontmatter, `##` heading, GFM task list, blockquote
2. **Every question MUST have an explanation** in a blockquote (`> ...`)
3. **Minimum 2 choices**, typically 4 for single-choice
4. **At least 1 correct answer** per question
5. **For `multiple` type**: have 2-3 correct answers out of 4-5 options
6. **Explanations should be educational** — explain WHY the correct answer is right and why others are wrong
7. **Avoid ambiguous wording** — questions should have clear, defensible correct answers
8. **Match the language** defined in the quiz frontmatter for all content
9. **Use bold** (`**...**`) in explanations to highlight key terms
10. **Distractors should be plausible** — avoid obviously wrong answers

### Separator Rules

- Each question block starts with `---` on its own line (question frontmatter opening)
- Question frontmatter closes with `---` on its own line
- There must be a blank line between the quiz frontmatter closing `---` and the first question's `---`
- There must be a blank line after the explanation blockquote and before the next question's `---`

### Step 4 — Validate

After writing the file, run the validation command:

```bash
bun run packages/server/src/cli.ts check decks/<slug>/index.quizv.md
```

If validation fails, fix the issues and re-validate.

### Step 5 — Summary

Report to the user:

- Number of questions generated
- Difficulty breakdown
- Validation result
- Suggest running the dev server to preview: `bun run packages/server/src/cli.ts dev decks/<slug>/index.quizv.md`
