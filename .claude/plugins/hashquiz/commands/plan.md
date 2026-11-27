---
description: Plan quiz content from sources and generate a plan.md for a HashQuiz deck
argument-hint: "[deck-slug]"
allowed-tools: Read, Write, Bash, Glob, Grep, AskUserQuestion, WebSearch, WebFetch
---

# Plan Quiz Content

Generate a `plan.md` document that structures the quiz before generating questions.

## Instructions

Read the skill references first: load `skills/building-hashquiz-decks/references/hashquiz-format.md`
and `skills/building-hashquiz-decks/references/plan-template.md` from `${CLAUDE_PLUGIN_ROOT}`.

### Step 1 — Detect the Deck

Find the target deck:

1. Check if the user has a file open in the IDE that is inside a `decks/<slug>/` directory — use that deck
2. If `$ARGUMENTS` is provided, treat it as the deck slug and look for `decks/<slug>/`
3. Otherwise, list available decks in `decks/` and ask the user which one to plan

Verify that `decks/<slug>/index.hashquiz.md` exists. If not, suggest running `/hashquiz:new` first.

### Step 2 — Read Context

1. **Read the frontmatter** of `decks/<slug>/index.hashquiz.md` to understand title, description, tags, language,
and any constraints (max-questions, max-time, target-difficulty)
2. **Read all files in `decks/<slug>/sources/`** to understand the source material available.
Read every file fully — these are the primary content for quiz questions.
3. **Detect the language** from the frontmatter or content. All plan content should be written in this language.

### Step 3 — Ask Complementary Questions

Ask the user **one at a time**:

1. **Number of questions**: How many questions should this quiz have? (suggest a number based on source material volume)
2. **Difficulty distribution**: What mix of difficulty? (suggest a default like 30% easy, 50% medium, 20% hard)
3. **Question types**: Mostly single-choice, multiple-choice, or a mix?
4. **Focus areas**: Any topics to prioritize or avoid?
5. **Additional context**: Anything else to consider? (audience level, trick questions, etc.)

### Step 4 — Assess Source Sufficiency

After reading sources and gathering user input,
assess whether the sources provide enough material for the target number of questions.

If sources seem insufficient:

- Tell the user which topics lack coverage
- **Propose** doing web research to fill gaps (do NOT search without asking)
- If the user agrees, use WebSearch/WebFetch to gather supplementary information
- Note which questions will be based on web research in the plan

### Step 5 — Generate Plan

Create `decks/<slug>/sources/plan.md` following the template from `references/plan-template.md`.

For each planned question:

- Write a clear summary that is specific enough to generate the question without ambiguity
- Specify the source (which document or web research)
- Include the key concept being tested
- Assign appropriate difficulty, timer, type, and tags

### Step 6 — Review

Present a summary to the user:

- Total questions planned
- Difficulty breakdown
- Tag/topic coverage
- Any gaps or concerns

Ask the user to review `sources/plan.md` and make adjustments before proceeding to `/hashquiz:create`.
