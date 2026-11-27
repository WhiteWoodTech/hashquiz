# Quiz Info Lobby Pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher le titre, la description, les tags, les métriques et la distribution de difficulté du quiz sur les pages lobby host et player.

**Architecture:** Enrichir les messages WS `host_connected` et `joined` avec un objet `QuizInfo` calculé côté serveur. Les stores Pinia host et player stockent ces métadonnées. Les composants `LobbyView` les affichent.

**Tech Stack:** TypeScript strict, Bun test, Vue 3 + Pinia + UnoCSS, tokens CSS `--hq-*`

---

## File Map

| Fichier | Action | Rôle |
|---|---|---|
| `packages/core/src/types.ts` | Modify | Ajouter interface `QuizInfo` |
| `packages/core/src/index.ts` | Modify | Exporter `QuizInfo` |
| `packages/server/src/server.ts` | Modify | Ajouter `buildQuizInfo()` + enrichir `host_connected` et `joined` |
| `apps/host/src/stores/game.ts` | Modify | Ajouter `quizMeta` ref, le populer depuis `host_connected` |
| `apps/player/src/stores/game.ts` | Modify | Ajouter `quizMeta` ref, le populer depuis `joined` |
| `apps/host/src/views/LobbyView.vue` | Modify | Ajouter panneau info quiz au-dessus du layout existant |
| `apps/player/src/views/LobbyView.vue` | Modify | Refonte avec métadonnées quiz + section attente |

---

## Task 1 : Créer la branche feature

**Files:** aucun fichier modifié

- [ ] **Créer la branche depuis `main`**

```bash
git checkout main
git checkout -b feat/quiz-info-lobby-pages
```

Expected: `Switched to a new branch 'feat/quiz-info-lobby-pages'`

---

## Task 2 : Ajouter `QuizInfo` dans `@hashquiz/core`

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Écrire le test unitaire**

Créer `packages/core/tests/quiz-info.test.ts` :

```ts
import { describe, test, expect } from 'bun:test'
import type { QuizInfo } from '../src/types'

describe('QuizInfo type', () => {
  test('accepts full object', () => {
    const info: QuizInfo = {
      title: 'Mon Quiz',
      description: 'Une description',
      tags: ['ts', 'vue'],
      totalQuestions: 10,
      targetDifficulty: 'hard',
      difficultyDistribution: { easy: 20, medium: 20, hard: 60 },
    }
    expect(info.title).toBe('Mon Quiz')
    expect(info.difficultyDistribution.hard).toBe(60)
  })

  test('accepts minimal object (no description, no targetDifficulty)', () => {
    const info: QuizInfo = {
      title: 'Quiz',
      tags: [],
      totalQuestions: 5,
      difficultyDistribution: { easy: 100, medium: 0, hard: 0 },
    }
    expect(info.targetDifficulty).toBeUndefined()
    expect(info.description).toBeUndefined()
  })
})
```

- [ ] **Lancer le test pour confirmer qu'il échoue**

```bash
cd /path/to/hashquiz
bun test packages/core/tests/quiz-info.test.ts
```

Expected: erreur `Cannot find name 'QuizInfo'`

- [ ] **Ajouter `QuizInfo` dans `packages/core/src/types.ts`**

Ajouter à la fin du fichier (après `GameState`) :

```ts
export interface QuizInfo {
  title: string
  description?: string
  tags: string[]
  totalQuestions: number
  targetDifficulty?: 'easy' | 'medium' | 'hard'
  difficultyDistribution: {
    easy: number    // pourcentage 0–100
    medium: number
    hard: number
  }
}
```

- [ ] **Exporter depuis `packages/core/src/index.ts`**

`packages/core/src/index.ts` est déjà `export * from './types'` — l'export est automatique, rien à ajouter.

- [ ] **Lancer le test pour confirmer qu'il passe**

```bash
bun test packages/core/tests/quiz-info.test.ts
```

Expected: `2 pass, 0 fail`

- [ ] **Lancer la suite complète**

```bash
bun test
```

Expected: tous les tests passent (aucune régression).

- [ ] **Commit**

```bash
git add packages/core/src/types.ts packages/core/tests/quiz-info.test.ts
git commit -m "✨ Core: add QuizInfo type"
```

---

## Task 3 : Implémenter `buildQuizInfo()` dans le serveur

**Files:**
- Modify: `packages/server/src/server.ts`

La fonction calcule `QuizInfo` depuis un objet `Quiz` (type `@hashquiz/parser`).

### Logique de calcul de `difficultyDistribution`

**Sans `targetDifficulty`** : compter les questions brutes.

**Avec `targetDifficulty`** : appliquer l'algorithme théorique :
1. `guardrailN` = nombre de tags uniques qui ont au moins 1 question `hard` (plafonné à `totalN`)
2. `slots` = `totalN - guardrailN`
3. `targetSlots` = `Math.round(slots * 0.6)`
4. `belowSlots` = `slots - targetSlots`
5. Répartir `belowSlots` proportionnellement aux counts des questions en-dessous de la cible dans le pool

- [ ] **Écrire les tests**

Créer `packages/server/tests/build-quiz-info.test.ts` :

```ts
import { describe, test, expect } from 'bun:test'
import { buildQuizInfo } from '../src/server'
import type { Quiz } from '@hashquiz/parser'

const makeQuiz = (overrides: Partial<Quiz['meta']> = {}, questions: Quiz['questions'] = []): Quiz => ({
  meta: { title: 'Test', theme: 'default', tags: [], oneShoot: true, ...overrides },
  questions,
})

const q = (difficulty: 'easy' | 'medium' | 'hard', tags: string[] = []) => ({
  type: 'single' as const,
  timer: 20,
  difficulty,
  tags,
  text: 'Q?',
  choices: [{ id: 'a', text: 'A', isCorrect: true }],
})

describe('buildQuizInfo — no targetDifficulty', () => {
  test('raw distribution, all questions', () => {
    const quiz = makeQuiz({}, [q('easy'), q('easy'), q('medium'), q('hard')])
    const info = buildQuizInfo(quiz)
    expect(info.title).toBe('Test')
    expect(info.totalQuestions).toBe(4)
    expect(info.targetDifficulty).toBeUndefined()
    expect(info.difficultyDistribution.easy).toBe(50)
    expect(info.difficultyDistribution.medium).toBe(25)
    expect(info.difficultyDistribution.hard).toBe(25)
  })

  test('respects maxQuestions for totalQuestions', () => {
    const quiz = makeQuiz({ maxQuestions: 2 }, [q('easy'), q('medium'), q('hard')])
    const info = buildQuizInfo(quiz)
    expect(info.totalQuestions).toBe(2)
  })

  test('description and tags forwarded', () => {
    const quiz = makeQuiz({ description: 'Desc', tags: ['ts', 'vue'] }, [q('easy')])
    const info = buildQuizInfo(quiz)
    expect(info.description).toBe('Desc')
    expect(info.tags).toEqual(['ts', 'vue'])
  })
})

describe('buildQuizInfo — with targetDifficulty', () => {
  test('hard target: guardrail hard + 60% hard + 40% below', () => {
    // 6 questions : 2 hard (tag=a, tag=b), 2 medium, 2 easy — no maxQuestions
    const questions = [
      q('hard', ['a']), q('hard', ['b']),
      q('medium'), q('medium'),
      q('easy'), q('easy'),
    ]
    const quiz = makeQuiz({ targetDifficulty: 'hard' }, questions)
    const info = buildQuizInfo(quiz)
    expect(info.targetDifficulty).toBe('hard')
    // guardrailN = 2 (tags a et b), slots = 4, targetSlots = round(4*0.6)=2, belowSlots=2
    // hardN = guardrailN(2) + targetSlots(2) = 4 → 4/6 ≈ 67%
    expect(info.difficultyDistribution.hard).toBeCloseTo(67, 0)
    expect(info.difficultyDistribution.easy + info.difficultyDistribution.medium).toBeCloseTo(33, 0)
  })

  test('medium target: guardrail hard + 60% medium + 40% easy', () => {
    const questions = [
      q('hard', ['a']),
      q('medium'), q('medium'), q('medium'),
      q('easy'), q('easy'),
    ]
    const quiz = makeQuiz({ targetDifficulty: 'medium', maxQuestions: 5 }, questions)
    const info = buildQuizInfo(quiz)
    expect(info.targetDifficulty).toBe('medium')
    // guardrailN = min(1 tag with hard, 5) = 1, slots = 4
    // targetSlots = round(4*0.6)=2, belowSlots=2
    // mediumN = 2, hardN = 1 (guardrail only)
    expect(info.difficultyDistribution.hard).toBeCloseTo(20, 0)   // 1/5
    expect(info.difficultyDistribution.medium).toBeCloseTo(40, 0) // 2/5
    expect(info.difficultyDistribution.easy).toBeCloseTo(40, 0)   // 2/5
  })
})
```

- [ ] **Lancer le test pour confirmer qu'il échoue**

```bash
bun test packages/server/tests/build-quiz-info.test.ts
```

Expected: `Cannot find module` ou `buildQuizInfo is not exported`

- [ ] **Implémenter `buildQuizInfo` dans `packages/server/src/server.ts`**

Ajouter **avant** la classe `HashQuizServer` (après les imports) :

```ts
import type { Quiz } from '@hashquiz/parser'
import type { QuizInfo } from '@hashquiz/core'
```

Ces imports sont déjà présents — vérifier et ne pas dupliquer. Ajouter `QuizInfo` à l'import existant de `@hashquiz/core` si nécessaire.

Puis ajouter la fonction :

```ts
export function buildQuizInfo(quiz: Quiz): QuizInfo {
  const { title, description, tags, maxQuestions, targetDifficulty } = quiz.meta
  const all = quiz.questions
  const totalN = maxQuestions !== undefined
    ? Math.min(maxQuestions, all.length)
    : all.length

  let dist: { easy: number; medium: number; hard: number }

  if (!targetDifficulty) {
    // Distribution brute
    const counts = { easy: 0, medium: 0, hard: 0 }
    for (const q of all) counts[q.difficulty]++
    const total = all.length || 1
    dist = {
      easy:   Math.round(counts.easy   / total * 100),
      medium: Math.round(counts.medium / total * 100),
      hard:   Math.round(counts.hard   / total * 100),
    }
  } else {
    // Distribution théorique 60/40 + guardrail
    const RANK: Record<'easy' | 'medium' | 'hard', number> = { easy: 0, medium: 1, hard: 2 }
    const targetRank = RANK[targetDifficulty]

    // Guardrail : 1 hard question par tag unique ayant au moins 1 question hard
    const uniqueTagsWithHard = new Set(
      all.filter(q => q.difficulty === 'hard').flatMap(q => q.tags)
    )
    const guardrailN = Math.min(uniqueTagsWithHard.size, totalN)

    const slots         = Math.max(0, totalN - guardrailN)
    const targetSlots   = Math.round(slots * 0.6)
    const belowSlots    = slots - targetSlots

    // Pour les slots "below target" : répartir proportionnellement
    const belowPool = all.filter(q => RANK[q.difficulty] < targetRank)
    const belowTotal = belowPool.length || 1
    const belowCounts: Record<string, number> = { easy: 0, medium: 0, hard: 0 }
    for (const q of belowPool) belowCounts[q.difficulty]++

    const easyBelow   = Math.round(belowCounts['easy']   / belowTotal * belowSlots)
    const mediumBelow = belowSlots - easyBelow

    // Guardrail + targetSlots = all hard (quand target=hard)
    // Si target = medium : hard = guardrail only, medium += targetSlots, easy += belowSlots
    // Si target = easy   : easy += targetSlots + belowSlots (pas de below easy), hard = guardrail
    const hardN   = guardrailN + (targetDifficulty === 'hard'   ? targetSlots : 0)
    const mediumN = (targetDifficulty === 'medium' ? targetSlots : 0)
                  + (targetDifficulty === 'hard'   ? mediumBelow : 0)
    const easyN   = (targetDifficulty === 'easy'   ? targetSlots + belowSlots : 0)
                  + (targetDifficulty === 'medium'  ? easyBelow  : 0)
                  + (targetDifficulty === 'hard'    ? easyBelow  : 0)

    const total = (hardN + mediumN + easyN) || 1
    dist = {
      easy:   Math.round(easyN   / total * 100),
      medium: Math.round(mediumN / total * 100),
      hard:   Math.round(hardN   / total * 100),
    }
  }

  return { title, description, tags, totalQuestions: totalN, targetDifficulty, difficultyDistribution: dist }
}
```

- [ ] **Lancer les tests pour confirmer qu'ils passent**

```bash
bun test packages/server/tests/build-quiz-info.test.ts
```

Expected: `5 pass, 0 fail`

- [ ] **Lancer la suite complète**

```bash
bun test
```

Expected: tous les tests passent.

- [ ] **Commit**

```bash
git add packages/server/src/server.ts packages/server/tests/build-quiz-info.test.ts
git commit -m "✨ Server: add buildQuizInfo() utility"
```

---

## Task 4 : Enrichir les messages WebSocket `host_connected` et `joined`

**Files:**
- Modify: `packages/server/src/server.ts`

- [ ] **Modifier le handler `open` du WebSocket dans `HashQuizServer.start()`**

Localiser le bloc `if (role === 'host')` dans `websocket.open` et remplacer par :

```ts
if (role === 'host') {
  const localIP = getLocalIP()
  ws.send(JSON.stringify({
    type: 'host_connected',
    joinCode: self.joinCode,
    totalQuestions: self.engine.state.totalQuestions,
    playerUrl: `http://${localIP}:3032?code=${self.joinCode}`,
    quizMeta: self.quizMeta,
  }))
}
```

- [ ] **Ajouter `quizMeta` comme propriété de `HashQuizServer`**

Dans le corps de la classe, après `private quizFile: string`, ajouter :

```ts
private quizMeta: QuizInfo
```

Dans le constructeur, après `this.engine = new GameEngine(...)`, ajouter :

```ts
this.quizMeta = buildQuizInfo(quiz)
```

- [ ] **Enrichir le message `joined`**

Localiser `ws.send(JSON.stringify({ type: 'joined', player }))` et remplacer par :

```ts
ws.send(JSON.stringify({ type: 'joined', player, quizMeta: self.quizMeta }))
```

- [ ] **Vérifier que le build TypeScript ne signale pas d'erreur**

```bash
cd /path/to/hashquiz
bun run --cwd packages/server tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Lancer la suite complète**

```bash
bun test
```

Expected: tous les tests passent.

- [ ] **Commit**

```bash
git add packages/server/src/server.ts
git commit -m "✨ Server: send quizMeta in host_connected and joined messages"
```

---

## Task 5 : Mettre à jour le store host

**Files:**
- Modify: `apps/host/src/stores/game.ts`

- [ ] **Ajouter `quizMeta` au store**

Ouvrir `apps/host/src/stores/game.ts`.

Ajouter l'import en tête :

```ts
import type { QuizInfo } from '@hashquiz/core'
```

Mettre à jour l'interface `HostConnectedMsg` :

```ts
interface HostConnectedMsg {
  type: 'host_connected'
  joinCode: string
  totalQuestions: number
  playerUrl: string
  quizMeta: QuizInfo
}
```

Ajouter la ref dans le store (après `const podium = ref<PodiumEntry[]>([])`):

```ts
const quizMeta = ref<QuizInfo | null>(null)
```

Populer dans le handler `host_connected` (après `phase.value = 'lobby'`, avant `return`):

```ts
quizMeta.value = msg.quizMeta
```

Exposer dans le `return` (ajouter `quizMeta` à la liste) :

```ts
return {
  phase, joinCode, playerUrl, totalQs, players,
  question, questionIdx, answerCount, correctIds,
  choiceCounts, explanation, scores, podium,
  quizMeta,
  connect, send,
}
```

- [ ] **Vérifier TypeScript**

```bash
bun run --cwd apps/host vue-tsc --noEmit
```

Expected: aucune erreur. (Si `vue-tsc` n'est pas disponible : `bun run --cwd apps/host tsc --noEmit`)

- [ ] **Commit**

```bash
git add apps/host/src/stores/game.ts
git commit -m "✨ Host: add quizMeta to game store"
```

---

## Task 6 : Mettre à jour le store player

**Files:**
- Modify: `apps/player/src/stores/game.ts`

- [ ] **Ajouter `quizMeta` au store**

Ouvrir `apps/player/src/stores/game.ts`.

Ajouter l'import en tête :

```ts
import type { QuizInfo } from '@hashquiz/core'
```

Mettre à jour l'interface `JoinedMsg` :

```ts
interface JoinedMsg { type: 'joined'; player: { id: string }; quizMeta: QuizInfo }
```

Ajouter la ref (après `const connectError = ref('')`):

```ts
const quizMeta = ref<QuizInfo | null>(null)
```

Populer dans le handler `joined` (après `phase.value = 'lobby'`, avant `return`):

```ts
quizMeta.value = msg.quizMeta
```

Exposer dans le `return` :

```ts
return {
  phase, playerId, playerCount, question, questionIdx,
  answered, answerTimeMs, totalScore, lastDelta, podium, connectError,
  quizMeta,
  connect, submitAnswer,
}
```

- [ ] **Commit**

```bash
git add apps/player/src/stores/game.ts
git commit -m "✨ Player: add quizMeta to game store"
```

---

## Task 7 : UI — Host LobbyView

**Files:**
- Modify: `apps/host/src/views/LobbyView.vue`

Ajouter un panneau quiz info **au-dessus** du layout existant. Le panneau n'est rendu que si `game.quizMeta` est non null.

- [ ] **Remplacer le contenu de `LobbyView.vue`**

```vue
<template>
  <div class="lobby">
    <h1 class="lobby__title">HashQuiz</h1>

    <!-- Quiz info panel -->
    <div v-if="game.quizMeta" class="quiz-info">
      <div class="quiz-info__header">
        <div>
          <h2 class="quiz-info__title">{{ game.quizMeta.title }}</h2>
          <p v-if="game.quizMeta.description" class="quiz-info__description">
            {{ game.quizMeta.description }}
          </p>
          <div v-if="game.quizMeta.tags.length" class="quiz-info__tags">
            <span
              v-for="tag in game.quizMeta.tags"
              :key="tag"
              class="quiz-info__tag"
            >{{ tag }}</span>
          </div>
        </div>
        <span
          v-if="game.quizMeta.targetDifficulty"
          :class="['quiz-info__target-badge', `quiz-info__target-badge--${game.quizMeta.targetDifficulty}`]"
        >🎯 {{ game.quizMeta.targetDifficulty.toUpperCase() }}</span>
      </div>

      <div class="quiz-info__metrics">
        <span class="quiz-info__metric">{{ game.quizMeta.totalQuestions }} questions</span>
        <span class="quiz-info__metric">{{ game.quizMeta.tags.length }} tags</span>
      </div>

      <DifficultyBar :distribution="game.quizMeta.difficultyDistribution" />
    </div>

    <div class="lobby__main">
      <div class="lobby__qr">
        <QrCode :value="game.playerUrl" :size="220" />
        <p class="lobby__url">{{ game.playerUrl }}</p>
      </div>

      <div class="lobby__info">
        <div class="lobby__code-box">
          <p class="lobby__code-label">Join code</p>
          <p class="lobby__code">{{ game.joinCode }}</p>
        </div>
        <p class="lobby__count">{{ game.players.length }} player{{ game.players.length !== 1 ? 's' : '' }} connected</p>
        <PlayerList :players="game.players" />
        <button
          class="hq-btn-primary"
          :disabled="game.players.length === 0"
          @click="game.send('host_start')"
        >
          ▶ Start Game
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '../stores/game'
import { QrCode, PlayerList } from '@hashquiz/ui'
import DifficultyBar from '../components/DifficultyBar.vue'
const game = useGameStore()
</script>

<style scoped>
.lobby { max-width: 960px; margin: 0 auto; }
.lobby__title { font-size: 2.5rem; color: var(--hq-accent); margin-bottom: 2rem; }
.lobby__main { display: grid; grid-template-columns: auto 1fr; gap: 3rem; align-items: start; }
.lobby__qr { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
.lobby__url { font-size: 0.75rem; color: var(--hq-text-muted); word-break: break-all; max-width: 220px; text-align: center; }
.lobby__code-box { background: var(--hq-surface); border-radius: var(--hq-radius); padding: 1.25rem; margin-bottom: 1rem; }
.lobby__code-label { margin: 0; color: var(--hq-text-muted); font-size: 0.85rem; }
.lobby__code { margin: 0.25rem 0 0; font-size: 3rem; font-weight: 700; letter-spacing: 0.2em; color: var(--hq-accent); }
.lobby__count { color: var(--hq-text-muted); margin: 0 0 0.75rem; }
.hq-btn-primary {
  margin-top: 1.5rem; width: 100%; padding: 0.9rem;
  background: var(--hq-accent); color: #fff;
  border: none; border-radius: var(--hq-radius); font-size: 1.1rem;
  cursor: pointer; font-family: inherit; font-weight: 600;
  transition: background 0.15s;
}
.hq-btn-primary:hover:not(:disabled) { background: #6d28d9; }
.hq-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

/* Quiz info panel */
.quiz-info {
  background: var(--hq-surface);
  border: 1px solid var(--hq-border);
  border-radius: var(--hq-radius);
  padding: 1.5rem;
  margin-bottom: 2rem;
}
.quiz-info__header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.75rem; }
.quiz-info__title { font-size: 1.4rem; font-weight: 700; margin: 0 0 0.25rem; color: var(--hq-text); }
.quiz-info__description { margin: 0 0 0.75rem; color: var(--hq-text-muted); font-size: 0.9rem; line-height: 1.5; }
.quiz-info__tags { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.25rem; }
.quiz-info__tag {
  background: var(--hq-bg);
  border: 1px solid var(--hq-border);
  border-radius: var(--hq-radius);
  padding: 0.2rem 0.6rem;
  font-size: 0.75rem;
  color: var(--hq-text-muted);
}
.quiz-info__target-badge {
  flex-shrink: 0;
  padding: 0.3rem 0.75rem;
  border-radius: var(--hq-radius);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}
.quiz-info__target-badge--easy   { background: rgba(16,185,129,0.15); color: var(--hq-correct); }
.quiz-info__target-badge--medium { background: rgba(245,158,11,0.15);  color: var(--hq-warning); }
.quiz-info__target-badge--hard   { background: rgba(239,68,68,0.15);   color: var(--hq-error);   }
.quiz-info__metrics { display: flex; gap: 1.5rem; margin-bottom: 0.75rem; }
.quiz-info__metric { font-size: 0.8rem; color: var(--hq-text-muted); }
</style>
```

- [ ] **Créer le composant `DifficultyBar`**

Créer `apps/host/src/components/DifficultyBar.vue` :

```vue
<template>
  <div class="diff-bar">
    <div class="diff-bar__track">
      <div
        class="diff-bar__seg diff-bar__seg--easy"
        :style="{ width: distribution.easy + '%' }"
      />
      <div
        class="diff-bar__seg diff-bar__seg--medium"
        :style="{ width: distribution.medium + '%' }"
      />
      <div
        class="diff-bar__seg diff-bar__seg--hard"
        :style="{ width: distribution.hard + '%' }"
      />
    </div>
    <p class="diff-bar__legend">
      <span class="diff-bar__dot diff-bar__dot--easy" />easy {{ distribution.easy }}%
      <span class="diff-bar__dot diff-bar__dot--medium" />medium {{ distribution.medium }}%
      <span class="diff-bar__dot diff-bar__dot--hard" />hard {{ distribution.hard }}%
    </p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  distribution: { easy: number; medium: number; hard: number }
}>()
</script>

<style scoped>
.diff-bar__track { display: flex; height: 8px; border-radius: 4px; overflow: hidden; background: var(--hq-border); }
.diff-bar__seg { height: 100%; transition: width 0.4s ease; }
.diff-bar__seg--easy   { background: var(--hq-correct); }
.diff-bar__seg--medium { background: var(--hq-warning); }
.diff-bar__seg--hard   { background: var(--hq-error);   }
.diff-bar__legend { margin: 0.4rem 0 0; font-size: 0.75rem; color: var(--hq-text-muted); display: flex; align-items: center; gap: 0.5rem; }
.diff-bar__dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
.diff-bar__dot--easy   { background: var(--hq-correct); }
.diff-bar__dot--medium { background: var(--hq-warning); }
.diff-bar__dot--hard   { background: var(--hq-error);   }
</style>
```

- [ ] **Vérifier que les tokens CSS existent**

Chercher `--hq-correct`, `--hq-warning`, `--hq-error` dans le thème :

```bash
grep -r "\-\-hq-correct\|--hq-warning\|--hq-error" /path/to/hashquiz/packages/theme-default/
```

Si ces tokens n'existent pas, utiliser les valeurs en dur : `#10b981` (correct), `#f59e0b` (warning), `#ef4444` (error).

- [ ] **Commit**

```bash
git add apps/host/src/views/LobbyView.vue apps/host/src/components/DifficultyBar.vue
git commit -m "✨ Host: display quiz info on lobby page"
```

---

## Task 8 : UI — Player LobbyView

**Files:**
- Modify: `apps/player/src/views/LobbyView.vue`

Le composant `DifficultyBar` est dupliqué dans le player app (pas de composant partagé pour éviter un refactor hors scope).

- [ ] **Créer `apps/player/src/components/DifficultyBar.vue`**

Contenu identique à `apps/host/src/components/DifficultyBar.vue` (voir Task 7).

- [ ] **Remplacer `apps/player/src/views/LobbyView.vue`**

```vue
<template>
  <div class="lobby">
    <!-- Quiz info (quand disponible) -->
    <template v-if="game.quizMeta">
      <div class="lobby__badge">🧠 {{ game.quizMeta.title }}</div>

      <div class="lobby__header">
        <div>
          <h1 class="lobby__title">{{ game.quizMeta.title }}</h1>
          <p v-if="game.quizMeta.description" class="lobby__description">
            {{ game.quizMeta.description }}
          </p>
          <div v-if="game.quizMeta.tags.length" class="lobby__tags">
            <span
              v-for="tag in game.quizMeta.tags"
              :key="tag"
              class="lobby__tag"
            >{{ tag }}</span>
          </div>
        </div>
        <span
          v-if="game.quizMeta.targetDifficulty"
          :class="['lobby__target-badge', `lobby__target-badge--${game.quizMeta.targetDifficulty}`]"
        >🎯 {{ game.quizMeta.targetDifficulty.toUpperCase() }}</span>
      </div>

      <div class="lobby__metrics">
        <div class="lobby__metric">
          <strong>{{ game.quizMeta.totalQuestions }}</strong>
          <span>questions</span>
        </div>
        <div class="lobby__metric">
          <strong>{{ game.quizMeta.tags.length }}</strong>
          <span>tags</span>
        </div>
        <div v-if="game.quizMeta.targetDifficulty" class="lobby__metric">
          <strong>🎯</strong>
          <span>{{ game.quizMeta.targetDifficulty }}</span>
        </div>
      </div>

      <DifficultyBar :distribution="game.quizMeta.difficultyDistribution" />

      <div class="lobby__divider" />
    </template>

    <!-- Section attente -->
    <div class="lobby__wait">
      <div class="lobby__icon">⏳</div>
      <h2>En attente du host…</h2>
      <p class="lobby__count">
        {{ game.playerCount }} joueur{{ game.playerCount !== 1 ? 's' : '' }} connecté{{ game.playerCount !== 1 ? 's' : '' }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '../stores/game'
import DifficultyBar from '../components/DifficultyBar.vue'
const game = useGameStore()
</script>

<style scoped>
.lobby {
  max-width: 480px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.lobby__badge {
  display: inline-block;
  align-self: flex-start;
  background: linear-gradient(135deg, var(--hq-accent), var(--hq-accent2, #06b6d4));
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.3rem 0.75rem;
  border-radius: var(--hq-radius);
}

.lobby__header { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; }
.lobby__title { font-size: 1.6rem; font-weight: 700; margin: 0 0 0.25rem; color: var(--hq-text); }
.lobby__description { margin: 0 0 0.75rem; color: var(--hq-text-muted); font-size: 0.875rem; line-height: 1.5; }

.lobby__tags { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.lobby__tag {
  background: var(--hq-surface);
  border: 1px solid var(--hq-border);
  border-radius: var(--hq-radius);
  padding: 0.2rem 0.55rem;
  font-size: 0.72rem;
  color: var(--hq-text-muted);
}

.lobby__target-badge {
  flex-shrink: 0;
  padding: 0.3rem 0.75rem;
  border-radius: var(--hq-radius);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}
.lobby__target-badge--easy   { background: rgba(16,185,129,0.15); color: #10b981; }
.lobby__target-badge--medium { background: rgba(245,158,11,0.15);  color: #f59e0b; }
.lobby__target-badge--hard   { background: rgba(239,68,68,0.15);   color: #ef4444; }

.lobby__metrics { display: flex; gap: 1rem; }
.lobby__metric { display: flex; flex-direction: column; align-items: center; background: var(--hq-surface); border: 1px solid var(--hq-border); border-radius: var(--hq-radius); padding: 0.5rem 1rem; min-width: 70px; }
.lobby__metric strong { font-size: 1.25rem; font-weight: 700; color: var(--hq-accent); line-height: 1; }
.lobby__metric span { font-size: 0.7rem; color: var(--hq-text-muted); margin-top: 0.15rem; }

.lobby__divider { height: 1px; background: var(--hq-border); margin: 0.5rem 0; }

.lobby__wait { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; text-align: center; padding: 1rem 0; }
.lobby__icon { font-size: 2.5rem; }
.lobby__count { color: var(--hq-text-muted); font-size: 0.9rem; }
</style>
```

- [ ] **Commit**

```bash
git add apps/player/src/views/LobbyView.vue apps/player/src/components/DifficultyBar.vue
git commit -m "✨ Player: display quiz info on lobby page"
```

---

## Task 9 : Vérification finale et PR

- [ ] **Lancer la suite de tests complète**

```bash
cd /path/to/hashquiz
bun test
```

Expected: tous les tests passent (27+ tests).

- [ ] **Lancer le linter**

```bash
bun run lint
```

Expected: aucune erreur de lint.

- [ ] **Test manuel en dev**

```bash
bun run packages/server/src/cli.ts dev examples/quiz-ia-dev.hashquiz.md
```

Ouvrir `http://localhost:3031` (host) — vérifier :
- Panneau quiz info visible avec titre, description, tags, badge `🎯 HARD`, métriques, barre de distribution
- QR code et liste joueurs toujours présents en dessous

Ouvrir `http://localhost:3032` dans un second onglet, rejoindre avec un pseudo — vérifier :
- Lobby player affiche titre, description, tags, badge, métriques, barre de distribution
- Section "En attente du host..." visible en dessous

- [ ] **Créer la PR vers `develop`**

```bash
git push -u origin feat/quiz-info-lobby-pages
gh pr create \
  --base develop \
  --title "✨ Quiz info on lobby pages (host + player)" \
  --body "Affiche titre, description, tags, métriques et distribution de difficulté sur les pages lobby host et player. Enrichit les messages WS host_connected et joined avec QuizInfo."
```
