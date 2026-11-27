# Design: Quiz Info on Lobby Pages

**Date:** 2026-04-01
**Branch:** `feat/quiz-info-lobby-pages` (à créer depuis `main`)

## Contexte

Les pages d'attente (lobby) côté host et player n'affichent aucune métadonnée du quiz.
L'objectif est d'y ajouter : titre, description, tags, métriques (nombre de questions, nombre de tags, difficulté cible), et distribution visuelle des niveaux de difficulté.

Référence visuelle : `quiz-ia-dev.html` à la racine du projet.

---

## Approche retenue

**Enrichir les messages WebSocket existants** (`host_connected` et `joined`) avec un objet `QuizInfo`.
Pas de nouvel événement protocolaire — les métadonnées sont statiques et n'ont pas besoin d'être broadcastées séparément.

---

## 1. Nouveau type `QuizInfo` — `@hashquiz/core`

Fichier : `packages/core/src/types.ts`

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

Exporter depuis `packages/core/src/index.ts`.

---

## 2. Calcul de `QuizInfo` — `packages/server/src/server.ts`

Ajouter une fonction pure `buildQuizInfo(quiz: Quiz): QuizInfo` dans `server.ts`.

### Logique de `difficultyDistribution`

**Si `targetDifficulty` n'est pas défini** : distribution brute des questions du fichier.

```
easy%   = questions.filter(easy).length   / total * 100
medium% = questions.filter(medium).length / total * 100
hard%   = questions.filter(hard).length   / total * 100
```

**Si `targetDifficulty` est défini** : distribution théorique basée sur l'algorithme de sélection 60/40 + guardrail :

```
totalN        = min(maxQuestions ?? ∞, questions.length)
uniqueTags    = nb de tags uniques ayant au moins 1 question hard
guardrailN    = min(uniqueTags, totalN)         // 1 hard par tag
slots         = totalN - guardrailN
targetSlots   = round(slots * 0.6)
belowSlots    = slots - targetSlots

// Exemple targetDifficulty = 'hard'
hardN   = guardrailN + targetSlots
medN+easyN = belowSlots  // répartis proportionnellement depuis le pool

// Pour easy/medium target, hard = guardrailN uniquement
```

La répartition `below` (medium + easy pour target=hard, easy pour target=medium) est calculée proportionnellement au nombre de questions disponibles dans chaque pool.

`totalQuestions` = `min(maxQuestions ?? ∞, questions.length)` (ignorer `maxTimeSec` qui est inconnu avant le jeu).

---

## 3. Protocole WebSocket

### `host_connected` (server → host)

```ts
interface HostConnectedMsg {
  type: 'host_connected'
  joinCode: string
  totalQuestions: number
  playerUrl: string
  quizMeta: QuizInfo   // ← ajout
}
```

### `joined` (server → player)

```ts
interface JoinedMsg {
  type: 'joined'
  player: { id: string }
  quizMeta: QuizInfo   // ← ajout
}
```

---

## 4. Store host — `apps/host/src/stores/game.ts`

Ajouter :
```ts
import type { QuizInfo } from '@hashquiz/core'

const quizMeta = ref<QuizInfo | null>(null)
```

Populer dans le handler `host_connected` :
```ts
quizMeta.value = msg.quizMeta
```

Exposer dans le `return` du store.

---

## 5. Store player — `apps/player/src/stores/game.ts`

Même pattern :
```ts
import type { QuizInfo } from '@hashquiz/core'

const quizMeta = ref<QuizInfo | null>(null)
```

Populer dans le handler `joined` :
```ts
quizMeta.value = msg.quizMeta
```

Exposer dans le `return` du store.

---

## 6. UI — Host Lobby (`apps/host/src/views/LobbyView.vue`)

Ajouter un panneau info quiz **au-dessus** du layout QR code / joueurs existant.

### Structure visuelle

```
┌─────────────────────────────────────────────┐
│  AI Dev Quiz               [🎯 HARD]        │   ← titre + badge targetDifficulty (si défini)
│  Quiz sur l'IA et le dev...                 │   ← description (si définie)
│                                             │
│  [ia] [llm] [prompt] [agents] [rag]         │   ← tags chips
│                                             │
│  12 questions  •  6 tags  •  🎯 hard        │   ← métriques
│  ░░░░████████████░░░░  20% / 60% / 20%      │   ← barre de distribution
└─────────────────────────────────────────────┘

[QR code]     [Join code / players / Start]
```

### Barre de distribution

Barre segmentée horizontale 3 couleurs :
- easy → `--hq-correct` (vert)
- medium → `--hq-warning` (orange)
- hard → `--hq-error` (rouge)

Légende inline : `easy 20% · medium 20% · hard 60%`

Le panneau info n'est rendu que si `game.quizMeta !== null`.

---

## 7. UI — Player Lobby (`apps/player/src/views/LobbyView.vue`)

Remplacer la vue minimaliste par un affichage complet, inspiré de `quiz-ia-dev.html`.

### Structure visuelle

```
[badge: 🧠 <title>]

<title>                          [🎯 HARD]
<description>

[tag1] [tag2] [tag3] [tag4]

[ 12 questions ]  [ 6 tags ]  [ 🎯 hard ]

████████░░░░░░░░  easy 20% · medium 20% · hard 60%

─────────────────────────────────────────────
⏳ En attente du host...  •  3 joueurs connectés
```

Affichage conditionnel : si `game.quizMeta === null`, afficher uniquement le spinner d'attente (état transitoire pendant la connexion).

---

## Fichiers modifiés

| Fichier | Type de changement |
|---|---|
| `packages/core/src/types.ts` | Ajout `QuizInfo` |
| `packages/core/src/index.ts` | Export `QuizInfo` |
| `packages/server/src/server.ts` | `buildQuizInfo()` + enrichissement des messages WS |
| `apps/host/src/stores/game.ts` | Ajout `quizMeta` ref |
| `apps/player/src/stores/game.ts` | Ajout `quizMeta` ref |
| `apps/host/src/views/LobbyView.vue` | Panneau info quiz |
| `apps/player/src/views/LobbyView.vue` | Refonte complète |

---

## Hors scope

- Nouveau champ frontmatter
- Animation / transition de la barre de distribution
- Affichage des métadonnées sur d'autres vues (question, podium)
- Tests unitaires pour `buildQuizInfo` (peuvent être ajoutés ultérieurement)
