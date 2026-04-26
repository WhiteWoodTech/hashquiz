---
description: Scaffold a new QuizV deck with frontmatter, assets/, and sources/ directories
argument-hint: "[topic]"
allowed-tools: Read, Write, Bash, Glob, Grep, AskUserQuestion
---

# Scaffold a New QuizV Deck

Create a new quiz deck structure in the `decks/` directory.

## Instructions

Read the skill reference first: load `skills/building-quizv-decks/SKILL.md`
and `skills/building-quizv-decks/references/quizv-format.md` from `${CLAUDE_PLUGIN_ROOT}`.

### Step 1 — Gather Information

Ask the user the following questions **one at a time**.
If the user provided a topic as argument (`$ARGUMENTS`), use it as the title and skip that question.

1. **Title**: What is the title/topic of this quiz?
2. **Description**: A short description (1-2 sentences) of what the quiz covers.
3. **Language**: What language should the quiz be in? (e.g., French, English)
4. **Author**: Who is the author? (default: git user name from `git config user.name`)
5. **Tags**: What tags/topics should be associated? (comma-separated)
6. **Advanced options** (ask as one question, all optional):
   - `one-shoot`: Prevent immediate retake? (default: yes)
   - `max-questions`: Limit displayed questions? (default: show all)
   - `max-time`: Set a global time limit? (default: no limit)
   - `target-difficulty`: Target difficulty? (easy/medium/hard, default: none)

### Step 2 — Generate Slug

Convert the title to a URL-friendly kebab-case slug:

- Lowercase, ASCII only
- Replace spaces and special chars with hyphens
- Remove consecutive hyphens
- Example: "Introduction aux API REST" -> `introduction-aux-api-rest`

Check that `decks/<slug>/` does not already exist. If it does, ask the user for an alternative.

### Step 3 — Create Structure

Create the following files:

**`decks/<slug>/index.quizv.md`** — Quiz frontmatter only (no questions yet):

```markdown
---
title: {title}
description: >
  {description}
theme: default
author: {author}
tags: [{tags}]
{optional fields if set: one-shoot, max-questions, max-time, target-difficulty}
---
```

Notes on frontmatter:

- Use `one-shoot: false` only if the user explicitly disabled it (default is true, omit if true)
- Use hyphenated keys: `max-questions`, `max-time`, `target-difficulty`
- Use YAML array syntax for tags: `[tag1, tag2, tag3]`

**`decks/<slug>/assets/.gitkeep`** — Empty file

**`decks/<slug>/sources/.gitkeep`** — Empty file

### Step 4 — Next Steps

Tell the user:

1. Place source documents (PDFs, notes, articles, briefs) in `decks/<slug>/sources/`
2. Then run `/quizv:plan` to plan the quiz content
3. Or run `/quizv:create` directly to generate questions without a plan

Mention the language that was selected so the user knows all generated content will be in that language.
