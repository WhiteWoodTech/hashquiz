# Design : `one-shoot` + `max-questions` / `max-time`

Date: 2026-03-31

## Résumé

Deux nouvelles fonctionnalités configurables dans le frontmatter quiz :

1. **`one-shoot`** — contrôle si la sélection d'une réponse est irréversible ou modifiable jusqu'à expiration du timer.
2. **`max-questions` / `max-time`** — limite le nombre de questions jouées par sélection aléatoire depuis le pool du fichier.

---

## 1. Paramètre `one-shoot`

### Frontmatter

```yaml
---
title: Mon Quiz
one-shoot: true   # défaut: true
---
```

### Valeurs

| Valeur | Comportement |
|--------|-------------|
| `true` (défaut) | **Single** : 1er clic → `submitAnswer()` immédiat, tous les boutons disabled, timing affiché. **Multiple** : toggle libre + bouton "Valider" pour soumettre ; à timer=0 sans validation → auto-submit ce qui est sélectionné (ou "No answer" si rien). |
| `false` | Comportement actuel post-cf5e126 : toggle libre pour single et multiple, auto-submit à timer=0. |

### Propagation

`one-shoot` est une propriété quiz-level. Elle doit atteindre `QuestionView.vue` :

```
QuizMeta.oneShoot (boolean)
  → toPublic(question, idx, oneShoot) dans game.ts
  → QuestionPublic.oneShoot
  → GameEvent question_started { question: QuestionPublic }
  → game store → game.question.oneShoot
  → QuestionView.vue
```

### Changements par fichier

**`packages/parser/src/types.ts`**

- `QuizMeta` : ajouter `oneShoot?: boolean`

**`packages/parser/src/parse-meta.ts`**

- Parser `one-shoot` → `oneShoot: data['one-shoot'] !== false` (défaut `true`)

**`packages/core/src/types.ts`**

- `QuestionPublic` : ajouter `oneShoot: boolean`

**`packages/core/src/game.ts`**

- `toPublic(question, idx, oneShoot)` reçoit `oneShoot` depuis `this.quiz.meta.oneShoot ?? true`

**`apps/player/src/views/QuestionView.vue`**

- Lire `game.question.oneShoot`
- Scinder `toggleChoice()` en deux branches selon le mode :
  - `oneShoot=true + single` : soumettre immédiatement au 1er clic
  - `oneShoot=true + multiple` : toggle + bouton Valider (+ auto-submit à timer=0)
  - `oneShoot=false` : comportement toggle actuel (inchangé)
- Afficher bouton "Valider" conditionnel : `oneShoot && type==='multiple' && !answered && !timerExpired`

---

## 2. Paramètres `max-questions` / `max-time`

### Frontmatter

```yaml
---
title: Mon Quiz
max-questions: 10       # OU max-time (mutuellement exclusifs)
max-time: 5             # minutes (entier sans suffix = minutes)
max-time: 5m            # explicite minutes
max-time: 300s          # explicite secondes
---
```

### Règles

- `max-questions` et `max-time` sont **mutuellement exclusifs** → erreur de validation si les deux sont présents.
- Si `max-questions > nombre total de questions` → toutes les questions jouées (pas d'erreur).
- Si `max-time` dépasse la somme de tous les timers → toutes les questions jouées.
- Si aucun des deux → toutes les questions, dans l'ordre du fichier.

### Algorithme de sélection (côté serveur, `GameEngine.start()`)

```
1. subset = shuffle(quiz.questions)           // ordre aléatoire
2. si max-questions:
     subset = subset.slice(0, max-questions)
   si max-time:
     prendre les questions de subset dans l'ordre tant que Σ timer ≤ maxTimeSec
3. trier subset par index original dans quiz.questions  // restaure l'ordre du fichier
4. this.activeQuestions = subset              // utilisé à la place de quiz.questions
```

L'ordre du fichier est **préservé après sélection aléatoire**.

### Format `max-time`

| Valeur frontmatter | Interprétation |
|--------------------|----------------|
| `5` | 5 minutes = 300s |
| `"5m"` | 5 minutes = 300s |
| `"300s"` | 300 secondes |

### Changements par fichier

**`packages/parser/src/types.ts`**

- `QuizMeta` : ajouter `maxQuestions?: number`, `maxTimeSec?: number`

**`packages/parser/src/parse-meta.ts`**

- Parser `max-questions` → `maxQuestions`
- Parser `max-time` : détecter suffix `m`/`s`, défaut minutes → convertir en secondes → `maxTimeSec`
- Pas de validation ici (les erreurs de validation cross-champs sont dans le validateur existant)

**`packages/parser/src/index.ts`** (ou validateur)

- Ajouter règle : `maxQuestions` et `maxTimeSec` mutuellement exclusifs → `ValidationError`

**`packages/core/src/game.ts`**

- `GameEngine` : ajouter `private activeQuestions: Question[]`
- Dans `start()` : appeler `selectQuestions()` avant `_broadcastCurrentQuestion()`
- `selectQuestions()` : implémente l'algorithme ci-dessus
- `toPublic`, `_broadcastCurrentQuestion`, `revealAnswer`, `nextQuestion` utilisent `activeQuestions` à la place de `quiz.questions`
- `state.totalQuestions` mis à jour avec `activeQuestions.length`

---

## Exemple frontmatter complet

```yaml
---
title: AI Dev Quiz
description: Quiz IA pour développeurs
theme: default
author: QuizV
tags: [ia, llm, agents]
one-shoot: true
max-questions: 10
---
```

---

## Non-inclus (hors scope)

- Seed de randomisation (reproductibilité) — YAGNI
- Affichage du nombre de questions restantes côté player — YAGNI
- Sélection par tags/difficulté — YAGNI
