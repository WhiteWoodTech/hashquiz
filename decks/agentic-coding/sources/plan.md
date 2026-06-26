# Agentic Coding — Plan

**Target questions:** 30 (15 affichées via `max-questions`)
**Estimated duration:** 660 secondes (~11 min pour les 30 · ~5,5 min pour les 15 affichées)
**Language:** Français
**Difficulty mix:** 20% easy (6), 50% medium (15), 30% hard (9)
**Question types:** 70% single (21), 30% multiple (9)

---

## Sources Used

- `01-intro.md` — Positionnement AI Builder, rappels GenAI/LLM/agent, boucle ReAct, tools, MCP intro
- `02-stack.md` — Cursor vs Claude Code, 4 modes Cursor, workflow Explore→Plan→Code→Commit, Plan Mode, Worktree, Sandbox, modèles, Cloud Agents
- `03-contexte.md` — Prompt vs Context Engineering, contexte statique/dynamique, 4 échecs (Missing/Polluted/Stale/Conflicting), CLAUDE.md hiérarchique, @import vs lien, Auto-Memory, ADRs
- `04-extensions.md` — 3 primitives (Skills/Commands/Subagents), format SKILL.md, champ description, slash commands, variables $ARGUMENTS/$1/$2, Agent Skills standard ouvert, agents intégrés
- `05-hooks.md` — Types de hooks (Stop, permission_prompt, elicitation_dialog, PreToolUse, PostToolUse), setup, async:true, exemples macOS
- `06-mcp.md` — Architecture 3 acteurs, transport stdio vs HTTP/SSE, MCP vs CLI, serveurs populaires
- `07-spec-driven.md` — Spec-First, PRD agentic, frameworks SDD (Superpowers, SpecKit, BMAD, OpenSpec, Kiro, GSD, Task Master), matrice de choix
- `08-verification.md` — 8 piliers (Testing, Doc, Code Quality, Build, Dev Env, Observability, Security, Standards), scoring (Basic/Ready/Advanced), priorités
- `09-multi-agents.md` — Subagent vs Multi-agent, Task tool, patterns (review multi-agent), Managed Agents, workflows dynamiques vs statiques

---

## Difficulty Distribution

| Difficulty | Count | Percentage |
|------------|-------|------------|
| easy       | 6     | 20%        |
| medium     | 15    | 50%        |
| hard       | 9     | 30%        |

---

## Tag Coverage

| Tag | Questions |
|-----|-----------|
| agentic-coding | Q1, Q2, Q3, Q4, Q5, Q6, Q7, Q11, Q12, Q13, Q14, Q28, Q29, Q30 |
| context-engineering | Q7, Q8, Q9, Q10 |
| subagents | Q11, Q28, Q29, Q30 |
| MCP | Q17, Q18, Q19, Q20 |
| SDD | Q21, Q22, Q23, Q24 |
| CLI | Q4, Q5, Q19 |
| gen-ai | Q1, Q2, Q3 |

---

## Questions

### Q1 — Qu'est-ce qu'un "AI Builder" ?

- **Type:** single
- **Difficulty:** easy
- **Timer:** 15s
- **Tags:** [agentic-coding, gen-ai]
- **Source:** 01-intro.md
- **Key concept:** Positionnement dans la taxonomie : AI Builder = dev qui code *avec* des agents IA, distinct du profil Métiers (usager no-code) et de l'AI Engineer (qui construit les agents)
- **Notes:** Proposer les 3 profils comme distracteurs potentiels — un doit être clairement correct

### Q2 — Séquence de la boucle ReAct

- **Type:** single
- **Difficulty:** medium
- **Timer:** 20s
- **Tags:** [agentic-coding, gen-ai]
- **Source:** 01-intro.md
- **Key concept:** Pensée (Reasoning) → Action (Tool call) → Observation (Tool result) → Pensée… → Réponse finale. Tester le bon ordre parmi 4 séquences alternatives
- **Notes:** Les distracteurs intervertissent Action/Observation ou insèrent Réponse en milieu de cycle

### Q3 — Tools d'un coding agent (sélectionnez 3)

- **Type:** multiple
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [agentic-coding, gen-ai]
- **Source:** 01-intro.md
- **Key concept:** Read, Edit/Write, Grep/Glob, Bash, WebFetch, MCP, Task sont les 7 tools cités. Choisir 3 vrais parmi 4 propositions dont 1 distractor inventé (ex: "Email", "Push")
- **Notes:** Sélectionner 3 tools clairement distincts (ex: Bash, MCP, Task) + 1 distractor plausible

### Q4 — Philosophie de Claude Code

- **Type:** single
- **Difficulty:** easy
- **Timer:** 15s
- **Tags:** [agentic-coding, CLI]
- **Source:** 02-stack.md
- **Key concept:** Claude Code = CLI-first (terminal interactif). Cursor = IDE-first (fork VS Code). Tester la bonne étiquette
- **Notes:** Distracteurs : "IDE-first", "Sandbox-first", "Cloud-first"

### Q5 — Modes Cursor sans modification de fichiers (sélectionnez 2)

- **Type:** multiple
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [agentic-coding, CLI]
- **Source:** 02-stack.md
- **Key concept:** Ask (lecture seule, exploration) et Plan (plans détaillés, sans modifier fichiers) ne touchent pas les fichiers. Agent et Debug éditent
- **Notes:** 4 modes proposés : Ask ✓, Plan ✓, Agent ✗, Debug ✗

### Q6 — Première étape du workflow Anthropic

- **Type:** single
- **Difficulty:** medium
- **Timer:** 20s
- **Tags:** [agentic-coding]
- **Source:** 02-stack.md
- **Key concept:** Explore (demander à l'agent d'explorer sans modifier) est la 1ère étape — avant Plan, Code, Commit. Erreur classique : sauter directement à Code
- **Notes:** Distracteurs : Plan, Code, Commit

### Q7 — Prompt Engineering vs Context Engineering

- **Type:** single
- **Difficulty:** medium
- **Timer:** 20s
- **Tags:** [context-engineering, agentic-coding]
- **Source:** 03-contexte.md
- **Key concept:** L'unité de travail change : prompt (guidage mot à mot, 2022-2024) → contexte (structuré, versionné, partagé, 2025-2026). "Le contexte est le nouveau code"
- **Notes:** Distracteurs : confondre prompt engineering = "mauvaise pratique" (faux), ou dire que context engineering = "no prompt" (faux)

### Q8 — Type d'échec : agent qui utilise une API obsolète

- **Type:** single
- **Difficulty:** medium
- **Timer:** 20s
- **Tags:** [context-engineering]
- **Source:** 03-contexte.md
- **Key concept:** Stale = contexte périmé, info obsolète, agent ignore les changements récents. À distinguer de Missing (absent), Polluted (bruité), Conflicting (contradictoire)
- **Notes:** Présenter le symptôme concret "utilise l'ancienne API au lieu de la version migrée"

### Q9 — Composants du contexte statique repo (sélectionnez 2)

- **Type:** multiple
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [context-engineering, agentic-coding]
- **Source:** 03-contexte.md
- **Key concept:** CLAUDE.md et .mcp.json font partie du contexte "Repo · partagé via Git". Auto-Memory (~/.claude/projects/) = personnel. System prompt = Anthropic
- **Notes:** 4 choices : CLAUDE.md ✓, .mcp.json ✓, ~/.claude/CLAUDE.md ✗ (personnel), System prompt ✗ (Anthropic)

### Q10 — @import direct vs lien markdown dans CLAUDE.md

- **Type:** single
- **Difficulty:** hard
- **Timer:** 30s
- **Tags:** [context-engineering]
- **Source:** 03-contexte.md
- **Key concept:** @import = contenu injecté à chaque session (coûteux mais fiable, toujours sous les yeux de l'agent). Lien markdown = lu à la demande via Read (économique, peut être ignoré). Règle : @ pour conventions critiques, lien pour doc volumineuse
- **Notes:** Distracteurs : inverser les caractéristiques (coût/fiabilité), ou prétendre que les deux sont équivalents

### Q11 — Primitive d'extension auto-invoquée

- **Type:** single
- **Difficulty:** easy
- **Timer:** 15s
- **Tags:** [agentic-coding, subagents]
- **Source:** 04-extensions.md
- **Key concept:** Les Skills sont auto-invoquées par Claude selon leur description. Les Slash Commands nécessitent `/nom`. Les Subagents sont invoqués via Task
- **Notes:** Distracteurs : Slash Commands, Subagents, Hooks

### Q12 — Champ critique dans le frontmatter d'un SKILL.md

- **Type:** single
- **Difficulty:** medium
- **Timer:** 20s
- **Tags:** [agentic-coding]
- **Source:** 04-extensions.md
- **Key concept:** Le champ `description` est critique — c'est lui qui déclenche l'activation automatique. Une description trop générique → la skill ne se déclenche jamais
- **Notes:** Distracteurs : name, allowed-tools, examples

### Q13 — Emplacement des skills dans le standard Agent Skills ouvert

- **Type:** single
- **Difficulty:** hard
- **Timer:** 30s
- **Tags:** [agentic-coding]
- **Source:** 04-extensions.md
- **Key concept:** Le standard ouvert (adopté par 35+ plateformes) stocke les skills dans `.agents/skills/`, distinct de `.claude/skills/` (Claude Code) ou `~/.claude/skills/` (perso). Installable via `npx skills install`
- **Notes:** Distracteurs : .claude/skills/, ~/.agents/, .skills/ (inventé)

### Q14 — Variables d'une slash command (sélectionnez 2)

- **Type:** multiple
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [agentic-coding]
- **Source:** 04-extensions.md
- **Key concept:** $ARGUMENTS contient tout le texte après /cmd. $1, $2 sont les arguments positionnels. Exclure $ENV et $CONTEXT (non documentés)
- **Notes:** 4 choices : $ARGUMENTS ✓, $1 ✓, $ENV ✗, $CONTEXT ✗

### Q15 — Hook déclenché en fin de tâche

- **Type:** single
- **Difficulty:** easy
- **Timer:** 15s
- **Tags:** [agentic-coding]
- **Source:** 05-hooks.md
- **Key concept:** `Stop` se déclenche quand la tâche est terminée. `permission_prompt` = validation humaine requise. `elicitation_dialog` = besoin d'info. Distinguer les 3 types principaux
- **Notes:** Distracteurs : permission_prompt, elicitation_dialog, PostToolUse

### Q16 — Hook pour lancer un formatter automatiquement après édition

- **Type:** single
- **Difficulty:** medium
- **Timer:** 20s
- **Tags:** [agentic-coding]
- **Source:** 05-hooks.md
- **Key concept:** PostToolUse avec matcher "Edit" permet de lancer prettier/eslint/format auto après chaque modification de fichier par l'agent
- **Notes:** Distracteurs : PreToolUse (avant, pas après), Stop (fin de tâche), Notification (générique)

### Q17 — Comportement de `async: true` dans un hook

- **Type:** single
- **Difficulty:** hard
- **Timer:** 30s
- **Tags:** [agentic-coding]
- **Source:** 05-hooks.md
- **Key concept:** `async: true` signifie que le hook s'exécute en parallèle sans bloquer l'agent — l'agent continue pendant que la commande shell tourne. Sans async, l'agent attend la fin du hook
- **Notes:** Distracteurs : "le hook s'exécute avant l'agent", "le hook est optionnel", "le hook s'exécute en arrière-plan sur un serveur distant"

### Q18 — Analogie populaire pour MCP

- **Type:** single
- **Difficulty:** easy
- **Timer:** 15s
- **Tags:** [MCP]
- **Source:** 06-mcp.md (et 01-intro.md)
- **Key concept:** "USB-C pour les LLM" — une interface standard pour connecter tous les services à n'importe quel LLM
- **Notes:** Distracteurs : "Bluetooth pour les agents", "REST pour l'IA", "Docker pour les modèles"

### Q19 — Quand préférer le CLI plutôt qu'un MCP (sélectionnez 2)

- **Type:** multiple
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [MCP, CLI]
- **Source:** 06-mcp.md
- **Key concept:** CLI préféré pour scripts CI/CD (pas besoin d'hôte MCP) et output lisible par humain (logs, URLs). MCP préféré quand l'agent décide et chaîne des appels autonomes
- **Notes:** 4 choices : scripts CI/CD ✓, output lisible humain ✓, l'agent chaîne plusieurs appels ✗ (→ MCP), résultats structurés JSON ✗ (→ MCP)

### Q20 — Transport MCP pour un serveur local

- **Type:** single
- **Difficulty:** hard
- **Timer:** 30s
- **Tags:** [MCP]
- **Source:** 06-mcp.md
- **Key concept:** Un serveur MCP local (sur la même machine) utilise stdio (subprocess, stdin/stdout). Un serveur distant utilise HTTP/SSE. La distinction impacte uniquement la config (.mcp.json)
- **Notes:** Distracteurs : HTTP/SSE (distant), WebSocket (non utilisé dans MCP), gRPC (inventé)

### Q21 — Rapport de coût erreur specs vs code

- **Type:** single
- **Difficulty:** easy
- **Timer:** 15s
- **Tags:** [SDD]
- **Source:** 07-spec-driven.md
- **Key concept:** Une erreur détectée dans le code coûte 10x plus qu'une erreur détectée dans les specs. Review specs (200 lignes, 20-30 min) vs review code (2000 lignes, 2-4h)
- **Notes:** Distracteurs : 2x, 5x, 20x

### Q22 — Framework SDD AI-agnostic

- **Type:** single
- **Difficulty:** medium
- **Timer:** 20s
- **Tags:** [SDD]
- **Source:** 07-spec-driven.md
- **Key concept:** SpecKit est décrit comme "AI agnostic" — compatible Claude, Cursor, Copilot, Gemini CLI et 35+ plateformes. Superpowers est spécifique à la marketplace Anthropic/Claude Code
- **Notes:** Distracteurs : Superpowers (marketplace Anthropic), BMAD (enterprise), Task Master (Cursor-centric)

### Q23 — Frameworks recommandés pour utilisateurs Claude Code cycle complet (sélectionnez 2)

- **Type:** multiple
- **Difficulty:** hard
- **Timer:** 30s
- **Tags:** [SDD, agentic-coding]
- **Source:** 07-spec-driven.md
- **Key concept:** Matrice de décision "Utilisateurs Claude Code" → Superpowers (process : brainstorming→plan→review→git) + SpecKit (spec : specify→plan→implement→issues). Complémentaires
- **Notes:** 4 choices : Superpowers ✓, SpecKit ✓, BMAD ✗ (enterprise), Task Master ✗ (Cursor-centric)

### Q24 — Contexte idéal pour BMAD Method

- **Type:** single
- **Difficulty:** hard
- **Timer:** 30s
- **Tags:** [SDD]
- **Source:** 07-spec-driven.md
- **Key concept:** BMAD = framework enterprise avec 21 rôles spécialisés, audit trails complets, traçabilité. Idéal pour contextes réglementés (finance, santé, défense)
- **Notes:** Distracteurs : solo dev greenfield, startup vélocité, projet brownfield existant

### Q25 — Karpathy : Software 2.0 automatise ce qu'on peut...

- **Type:** single
- **Difficulty:** medium
- **Timer:** 20s
- **Tags:** [agentic-coding]
- **Source:** 08-verification.md
- **Key concept:** "Software 2.0 easily automates what you can **verify**." (Karpathy). Software 1.0 automatise ce qu'on peut *spécifier*. La vérification est le vrai levier de l'autonomie agent
- **Notes:** Distracteurs : spécifier, tester, documenter

### Q26 — Les 2 premiers piliers de priorité (sélectionnez 2)

- **Type:** multiple
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [agentic-coding]
- **Source:** 08-verification.md
- **Key concept:** Priorités 1 et 2 : Testing (sans tests, l'agent ne peut rien vérifier) et Build Systems (sans builds fiables, cycles gaspillés sur erreurs fantômes). Code Quality = 3, Documentation = 4
- **Notes:** 4 choices : Testing ✓, Build Systems ✓, Observability ✗ (pilier 6), Security ✗ (pilier 7)

### Q27 — Score "Advanced" de la verification infrastructure

- **Type:** single
- **Difficulty:** hard
- **Timer:** 30s
- **Tags:** [agentic-coding]
- **Source:** 08-verification.md
- **Key concept:** Advanced = 57-80 points (>70%) → haute autonomie agent possible avec supervision minimale. Ready = 33-56 (40-70%). Basic = 0-32 (<40%) = supervision lourde
- **Notes:** Distracteurs : >50 points, >60 points, >75 points — tester la valeur exacte (>70% = 57/80)

### Q28 — Caractéristiques du workflow multi-agent vs subagent (sélectionnez 2)

- **Type:** multiple
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [subagents, agentic-coding]
- **Source:** 09-multi-agents.md
- **Key concept:** Multi-agent = plusieurs subagents en parallèle + N appels modèle simultanés. Contexte isolé et retour résumé sont communs aux deux (ne discriminent pas)
- **Notes:** 4 choices : plusieurs agents en parallèle ✓, N appels modèle simultanés ✓, contexte isolé ✗ (commun aux deux), retour résumé ✗ (commun aux deux)

### Q29 — Workflow dynamique vs statique (DAG)

- **Type:** single
- **Difficulty:** hard
- **Timer:** 30s
- **Tags:** [subagents, agentic-coding]
- **Source:** 09-multi-agents.md
- **Key concept:** Workflow dynamique : le main agent décide à l'exécution quel subagent invoquer selon le contexte (spawn security si OWASP détecté, etc.). Workflow statique (DAG) = graphe figé à l'avance (LangGraph, Airflow)
- **Notes:** Distracteurs : "les workflows dynamiques n'utilisent pas de subagents", "les workflows dynamiques sont moins coûteux", "les workflows dynamiques ne peuvent pas utiliser des worktrees"

### Q30 — Éléments d'un bon prompt Task tool (sélectionnez 3)

- **Type:** multiple
- **Difficulty:** hard
- **Timer:** 30s
- **Tags:** [subagents, agentic-coding]
- **Source:** 09-multi-agents.md
- **Key concept:** "Briefer comme un collègue qui vient d'arriver" : contexte (ce qu'il faut savoir), objectif (ce qu'il doit faire), format de sortie (ex: "sous 200 mots"). Le subagent ne voit pas la conversation principale
- **Notes:** 4 choices : contexte ✓, objectif ✓, format de sortie ✓, référence au contexte de la session principale ✗ (le subagent ne la voit pas)

---

## Review Checklist

- [x] Questions couvrent toutes les 9 sections sources
- [x] Répartition de difficulté : 6 easy · 15 medium · 9 hard
- [x] Aucune question dupliquée ou trop similaire
- [x] Tags cohérents et alignés avec le frontmatter du deck
- [x] Timers réalistes par difficulté (15s easy · 20-25s medium · 30s hard)
- [x] Mix 70% single / 30% multiple respecté (21 single · 9 multiple)
- [x] Chaque multiple-choice a exactement 4 choix avec ≥1 distractor
- [x] Sélections multiple < 4 (sélectionnez 2 ou 3 au max)

---

_Plan créé : 2026-06-26_
_Ready for quiz generation: [ ]_
