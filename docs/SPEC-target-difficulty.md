# Design spec: `target-difficulty`

Date: 2026-04-01

## Résumé

Nouveau paramètre frontmatter `target-difficulty` qui contrôle le mix de difficulté
des questions sélectionnées : 60 % au niveau cible, 40 % en dessous (warmup),
avec au moins 1 question `hard` garantie par tag.

---

## Paramètre frontmatter

```yaml
target-difficulty: hard   # easy | medium | hard — optionnel
```

Valeurs : `'easy' | 'medium' | 'hard'`. Absent = pas de filtre par difficulté.

---

## Algorithme de sélection

S'intègre dans `selectQuestions()` de `GameEngine`, après calcul de `N`
(nombre total de questions issu de `max-questions`, `max-time`, ou longueur totale).

### Étape 1 — Hard guardrail par tag

Pour chaque tag unique présent dans le pool qui dispose d'au moins une question
`hard` → réserver aléatoirement 1 question `hard` de ce tag.
Ces questions sont garanties dans la sélection finale, quelles que soient les contraintes
de quota.

### Étape 2 — Slots restants (`N − guardrail`)

- 60 % des slots restants → questions au niveau `target-difficulty`
  (exclut les guardrails déjà pris)
- 40 % des slots restants → questions strictement en dessous de `target-difficulty`
  (easy si target=medium ; easy + medium si target=hard)

Règle `target-difficulty: easy` : aucun niveau en dessous → 100 % easy
et guardrails hard inclus en sus.

### Étape 3 — Ordering

Trier le résultat final par difficulté croissante : `easy → medium → hard`.
Les questions warmup arrivent naturellement en début de partie.

### Étape 4 — Fallback best-effort

Si le pool ne contient pas assez de questions au bon niveau pour respecter
exactement 60/40, remplir les slots manquants avec des questions disponibles
(tout niveau), sans erreur. Pas d'erreur de validation pour ce cas.

---

## Interaction avec `max-questions` / `max-time`

`target-difficulty` filtre à l'intérieur de `selectQuestions()`, après que `N`
est déterminé :

1. Calculer `N` (max-questions, max-time, ou longueur totale)
2. Appliquer target-difficulty pour composer le mix des `N` questions

---

## Exemples

### Pool : 4 easy, 4 medium, 4 hard (tags: ia, prompt, agents, rag — 1 hard chacun)

`target-difficulty: hard`, `max-questions: 10`

- Guardrail : 4 × 1 hard (1 par tag) → 4 questions réservées
- Slots restants : 10 − 4 = 6
  - 60 % → 3-4 hard supplémentaires (si dispo)
  - 40 % → 2-3 easy/medium
- Ordering : easy → medium → hard
- Résultat : 2-3 warmup en début, puis montée vers hard

### `target-difficulty: easy`

- Guardrail : 1 hard par tag (même si target=easy)
- Slots restants : 100 % easy
- Ordering : easy en premier, hard à la fin

---

## Fichiers touchés

| Fichier | Changement |
|---------|-----------|
| `packages/parser/src/types.ts` | `QuizMeta.targetDifficulty?: 'easy' \| 'medium' \| 'hard'` |
| `packages/parser/src/parse-meta.ts` | Parser `target-difficulty` → `targetDifficulty` |
| `packages/parser/tests/parser.test.ts` | Tests parsing du nouveau champ |
| `packages/core/src/game.ts` | `selectQuestions()` — logique hard guardrail + 60/40 + ordering |
| `packages/core/tests/game.test.ts` | Tests sélection par difficulté |

---

## Hors scope

- Ratio 60/40 configurable — YAGNI
- Garantie d'au moins 1 easy/medium par tag — YAGNI
- Affecter le score selon la difficulté — YAGNI
