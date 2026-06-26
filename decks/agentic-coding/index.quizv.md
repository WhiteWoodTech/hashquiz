---
title: Agentic Coding
description: >
  Couvre le context engineering, l'utilisation et la création de skills, commands et subagents,
  l'utilisation de MCP et CLI, le Specification Driven Development (SDD), les frameworks associés
  (SpecKit, Superpowers, BMAD…), les architectures multi-agents, et les outils IDE/CLI
  (Cursor, Claude Code, OpenCode, Vibe…).
theme: default
author: Maxime Lenne
tags: [agentic-coding, context-engineering, subagents, MCP, SDD, CLI, gen-ai]
max-questions: 15
target-difficulty: medium
---

---
type: single
timer: 15
difficulty: easy
tags: [agentic-coding, gen-ai]
---

## Parmi ces profils, lequel correspond à un "AI Builder" selon la taxonomie de la formation ?

- [ ] Un expert qui utilise des outils GenAI no-code pour créer du contenu sans écrire de code
- [x] Un développeur qui code ses applications en s'appuyant sur des agents IA comme Claude Code ou Cursor
- [ ] Un ingénieur qui conçoit des pipelines RAG, fine-tune des modèles et pilote des évaluations
- [ ] Un consultant qui accompagne les entreprises dans leur stratégie de transformation par l'IA

> La formation distingue trois profils : **Métiers** (usagers no-code), **AI Builders** (devs qui codent *avec* des agents IA) et **AI Engineers** (qui *construisent* les agents). Cette session s'adresse aux AI Builders — ceux qui utilisent Claude Code, Cursor ou Copilot pour produire du code, pas ceux qui entraînent des modèles.

---
type: single
timer: 20
difficulty: medium
tags: [agentic-coding, gen-ai]
---

## Dans la boucle ReAct d'un agent IA, quelle est la séquence correcte des étapes ?

- [ ] Action → Pensée → Observation → Réponse finale → Pensée
- [ ] Pensée → Observation → Action → Réponse finale → Pensée
- [x] Pensée → Action → Observation → Pensée → Réponse finale
- [ ] Action → Observation → Pensée → Action → Réponse finale

> La boucle **ReAct** (Reasoning + Acting) alterne : **Pensée** (l'agent raisonne), **Action** (appel d'un outil : Read, Bash, MCP…), **Observation** (le résultat de l'outil), puis retour à la Pensée. Ce cycle se répète jusqu'à ce que l'agent ait assez d'éléments pour formuler sa **Réponse finale**. L'erreur classique est d'inverser Action et Observation.

---
type: multiple
timer: 25
difficulty: medium
tags: [agentic-coding, gen-ai]
---

## Parmi les outils suivants, lesquels sont des tools natifs d'un coding agent moderne ? (sélectionnez 3)

- [x] `Bash` — exécuter une commande shell dans le terminal
- [x] `WebFetch` — télécharger et lire le contenu d'une URL distante
- [x] `Task` — déléguer une tâche à un subagent en contexte isolé
- [ ] `Deploy` — publier et déployer automatiquement une application en production

> Les tools natifs d'un coding agent incluent **Read**, **Edit/Write**, **Grep/Glob**, **Bash**, **WebFetch**, **MCP** et **Task**. Il n'existe pas de tool `Deploy` intégré — le déploiement se fait via Bash (scripts CI/CD) ou un serveur MCP dédié. `Task` est le tool qui permet au main agent de déléguer à un **subagent** en contexte isolé.

---
type: single
timer: 15
difficulty: easy
tags: [agentic-coding, CLI]
---

## Claude Code est qualifié de "CLI-first". Quelle philosophie caractérise à l'opposé l'outil Cursor ?

- [x] IDE-first — un fork de VS Code avec l'IA intégrée à toutes les zones d'édition
- [ ] Cloud-first — un agent hébergé tournant sur des VMs distantes sans machine locale
- [ ] Mobile-first — une interface optimisée pour les appareils tactiles et petits écrans
- [ ] API-first — un framework sans interface graphique, piloté entièrement via des appels REST

> **Cursor** est **IDE-first** : c'est un fork de VS Code qui intègre l'IA dans les 4 zones de l'éditeur (Sidebar, Editor, Panel, IA), avec des raccourcis comme `Cmd+K` (inline edit) et `Cmd+I` (Composer). **Claude Code** est **CLI-first** : un terminal interactif lancé via `claude`, optimisé pour les tâches longues et autonomes. Les deux philosophies se complètent plutôt qu'elles ne s'excluent.

---
type: multiple
timer: 25
difficulty: medium
tags: [agentic-coding, CLI]
---

## Dans Cursor, quels modes n'éditent pas les fichiers de votre projet ? (sélectionnez 2)

- [x] Ask — mode d'exploration et de questions en lecture seule sur la codebase
- [x] Plan — mode qui génère des plans détaillés sans modifier aucun fichier
- [ ] Agent — mode qui planifie et implémente, les fichiers sont édités par défaut
- [ ] Debug — mode spécialisé dans le diagnostic et la correction de bugs

> Cursor propose 4 modes : **Ask** (lecture seule, exploration), **Plan** (génère un plan sans toucher aux fichiers), **Agent** (planifie ET implémente — édite les fichiers) et **Debug** (diagnostique et corrige les bugs — édite aussi). Seuls Ask et Plan sont garantis non-destructifs. En Claude Code, l'équivalent du mode Plan est activé via `Shift+Tab`.

---
type: single
timer: 20
difficulty: medium
tags: [agentic-coding]
---

## Dans le workflow recommandé par Anthropic, quelle est la toute première étape avant d'écrire du code ?

- [ ] Plan — rédiger un plan détaillé des fichiers à créer et des modifications à apporter
- [x] Explore — demander à l'agent d'explorer le code sans apporter aucune modification
- [ ] Code — implémenter directement la fonctionnalité demandée étape par étape
- [ ] Commit — valider et commiter le contexte existant avant de démarrer une nouvelle tâche

> Le workflow officiel Anthropic suit l'ordre **Explore → Plan → Code → Commit**. L'étape **Explore** est souvent sautée par réflexe d'aller vite — c'est une erreur. Explore + Plan représentent 30-40 % du temps total mais évitent 80 % des bugs. Sauter Explore, c'est demander à l'agent de coder sans qu'il comprenne la structure du projet.

---
type: single
timer: 20
difficulty: medium
tags: [context-engineering, agentic-coding]
---

## Quelle est la différence fondamentale entre Prompt Engineering (2022-2024) et Context Engineering (2025-2026) ?

- [ ] En Prompt Engineering, le modèle est fine-tuné pour chaque projet ; en Context Engineering, il reste généraliste
- [x] En Prompt Engineering, le prompt est l'unité de travail guidé mot à mot ; en Context Engineering, le contexte est versionné, structuré et partagé
- [ ] En Prompt Engineering, l'agent travaille seul ; en Context Engineering, plusieurs agents collaborent en parallèle
- [ ] En Prompt Engineering, on utilisait des modèles faibles ; en Context Engineering, seuls les modèles forts sont utilisables

> Le glissement est profond : en 2022-2024 on **tuning** le wording du prompt car les modèles étaient faibles. En 2025-2026, les modèles sont forts — ce qui les limite c'est le **contexte**. Le Context Engineering, c'est construire `CLAUDE.md`, des skills, des ADRs, des specs versionnées. *« Le contexte est le nouveau code. »*

---
type: single
timer: 20
difficulty: medium
tags: [context-engineering]
---

## Un agent utilise une ancienne version d'une API alors que la migration est terminée depuis deux semaines. Quel type d'échec de contexte est-ce ?

- [ ] Missing — le contexte est absent, l'agent invente des informations inexistantes
- [ ] Polluted — le contexte est surchargé, l'agent mélange plusieurs approches contradictoires
- [x] Stale — le contexte est périmé, l'agent ignore les changements récents du projet
- [ ] Conflicting — deux sources de contexte se contredisent, l'agent alterne entre deux approches

> La taxonomie des **4 échecs de contexte** : **Missing** (l'agent hallucine — il n'a rien), **Polluted** (trop d'info — il se noie), **Stale** (info obsolète — il vit dans le passé), **Conflicting** (deux sources contradictoires — il hésite). Ici, l'API est migrée mais le contexte ne le sait pas encore → **Stale**. Remède : mettre à jour le CLAUDE.md ou les ADRs après chaque migration.

---
type: multiple
timer: 25
difficulty: medium
tags: [context-engineering, agentic-coding]
---

## Parmi les éléments suivants, lesquels font partie du contexte statique partagé avec l'équipe via Git ? (sélectionnez 2)

- [x] `CLAUDE.md` racine — conventions et commandes du projet commités dans le dépôt
- [x] `.mcp.json` — déclaration des serveurs MCP commités dans le dépôt
- [ ] `~/.claude/CLAUDE.md` — préférences personnelles hors dépôt, propres à l'utilisateur
- [ ] System prompt Anthropic — comportements imposés par le fournisseur du modèle

> Le contexte se divise en trois sources : **Anthropic** (system prompt, imposé), **Repo partagé via Git** (`CLAUDE.md`, `AGENTS.md`, `.claude/skills/`, `.mcp.json`) et **Personnel hors repo** (`~/.claude/CLAUDE.md`, Auto-Memory). Seule la source "Repo" est commitable et donc partagée avec l'équipe — c'est le vrai onboarding agentique.

---
type: single
timer: 30
difficulty: hard
tags: [context-engineering]
---

## Dans un CLAUDE.md, quelle est la différence entre un `@import` direct d'un fichier et un lien markdown vers ce même fichier ?

- [ ] L'`@import` est lu à la demande lors d'une session active ; le lien est injecté automatiquement au démarrage
- [x] L'`@import` injecte le contenu à chaque session (coûteux mais fiable) ; le lien est lu à la demande (économique mais peut être ignoré)
- [ ] L'`@import` et le lien markdown ont le même effet sur le contexte ; la distinction est purement stylistique
- [ ] L'`@import` ne fonctionne qu'avec des fichiers JSON ; le lien markdown accepte tous types de fichiers

> **`@import`** = le contenu est injecté dans le contexte à chaque conversation, même si non pertinent. Fiable, mais coûteux en tokens. **Lien markdown** = l'agent lit le fichier via `Read` seulement s'il le juge pertinent. Économique, mais l'agent peut « oublier » de consulter. **Règle de pouce** : `@import` pour les conventions critiques (sécurité, style strict) — lien doux pour la doc volumineuse ou rarement utile.

---
type: single
timer: 15
difficulty: easy
tags: [agentic-coding, subagents]
---

## Quelle primitive d'extension de Claude Code est activée automatiquement par l'agent, sans intervention explicite de l'utilisateur ?

- [x] Les Skills — déclenchées selon le contexte de la conversation via leur champ `description`
- [ ] Les Slash Commands — déclenchées manuellement par l'utilisateur via `/nom-de-la-commande`
- [ ] Les Subagents — invoqués explicitement via le Task tool pour des tâches déléguées
- [ ] Les Hooks — déclenchés par des événements du cycle de vie de l'agent

> Les **Skills** sont des packages de capacités **auto-invoquées** : Claude analyse leur champ `description` et décide seul de les activer selon le contexte de la conversation. Les **Slash Commands** nécessitent un déclenchement manuel (`/fix-issue 42`). Les **Subagents** sont invoqués par le Task tool. Les **Hooks** réagissent à des événements système, pas au contexte conversationnel.

---
type: single
timer: 20
difficulty: medium
tags: [agentic-coding]
---

## Dans le frontmatter d'un fichier SKILL.md, quel champ est décrit comme "critique" car il déclenche l'activation automatique de la skill ?

- [ ] `name` — l'identifiant unique de la skill dans le projet
- [x] `description` — le texte que Claude analyse pour décider d'activer la skill
- [ ] `allowed-tools` — la liste des outils que la skill est autorisée à utiliser
- [ ] `examples` — les fichiers d'exemples fournis pour calibrer l'activation

> Le champ **`description`** est le seul que Claude lit pour décider si la skill est pertinente au contexte courant. Une description trop générique → la skill ne se déclenche jamais. Une bonne description contient un **verbe d'action**, un **déclencheur précis** et un **cas d'usage** (ex : *"Use when the user asks 'how does this work?'"*). Les autres champs (`name`, `allowed-tools`) structurent l'exécution mais ne pilotent pas le déclenchement.

---
type: single
timer: 30
difficulty: hard
tags: [agentic-coding]
---

## Dans le standard ouvert "Agent Skills" (adopté par 35+ plateformes en 2026), où sont stockées les skills d'équipe partagées ?

- [ ] `.claude/skills/` — dossier spécifique à Claude Code dans le dépôt Git
- [ ] `~/.claude/skills/` — dossier de skills personnelles dans le répertoire home
- [x] `.agents/skills/` — dossier du standard ouvert multi-plateformes commité dans le dépôt
- [ ] `.vscode/skills/` — dossier d'extension VS Code réutilisé comme convention commune

> Le standard ouvert **Agent Skills** (convergence 2025-2026) adopte `.agents/skills/` comme emplacement commun, compatible avec Claude Code, Cursor, Copilot, Continue, Cody, Aider et 35+ plateformes. Installable via `npx skills install org/skill-name`. À ne pas confondre avec `.claude/skills/` (spécifique Claude Code) ou `~/.claude/skills/` (skills personnelles). L'objectif : un même dossier de skills dans le repo fonctionne dans tous les outils de l'équipe.

---
type: multiple
timer: 25
difficulty: medium
tags: [agentic-coding]
---

## Dans une slash command Claude Code, quelles variables sont disponibles pour accéder aux arguments de l'utilisateur ? (sélectionnez 2)

- [x] `$ARGUMENTS` — contient tout le texte saisi après le nom de la commande
- [x] `$1` — contient le premier argument positionnel après le nom de la commande
- [ ] `$ENV` — contient les variables d'environnement du shell courant au moment de l'appel
- [ ] `$CONTEXT` — contient le texte du contexte de session actif de Claude Code

> Les slash commands exposent deux types de variables : **`$ARGUMENTS`** capture tout le texte après `/cmd` (ex: `/fix-issue 42 urgent` → `$ARGUMENTS = "42 urgent"`), et **`$1`, `$2`...** pour les arguments positionnels individuels. `$ENV` et `$CONTEXT` ne sont pas des variables de commandes documentées — elles n'existent pas dans ce contexte. Les variables permettent de paramétrer les workflows d'équipe sans réécrire les prompts.

---
type: single
timer: 15
difficulty: easy
tags: [agentic-coding]
---

## Quel type de hook Claude Code se déclenche lorsque l'agent a terminé l'intégralité de sa tâche ?

- [ ] `permission_prompt` — déclenché quand l'agent demande une autorisation à l'utilisateur
- [ ] `elicitation_dialog` — déclenché quand l'agent a besoin d'informations supplémentaires
- [x] `Stop` — déclenché quand l'agent a terminé et rend la main à l'utilisateur
- [ ] `PreToolUse` — déclenché juste avant l'exécution de chaque appel à un outil

> Les principaux types de hooks : **`Stop`** (tâche terminée → notifier l'utilisateur), **`permission_prompt`** (validation humaine requise → bloquer en attente d'accord), **`elicitation_dialog`** (info manquante → demander à l'utilisateur), **`PreToolUse`** (avant un outil → possibilité de bloquer), **`PostToolUse`** (après un outil → formatter, lint…). `Stop` est le hook idéal pour envoyer une notification macOS ou jouer un son quand l'agent a fini.

---
type: single
timer: 20
difficulty: medium
tags: [agentic-coding]
---

## Quel type de hook faut-il configurer pour lancer automatiquement un formatter (ex: `prettier`) après chaque modification de fichier par l'agent ?

- [ ] `PreToolUse` avec matcher `Edit` — s'exécute juste avant chaque modification de fichier
- [x] `PostToolUse` avec matcher `Edit` — s'exécute juste après chaque modification de fichier
- [ ] `Stop` avec matcher `*` — s'exécute une seule fois en fin de tâche pour tous les fichiers
- [ ] `Notification` avec matcher `Edit` — envoie une alerte à chaque modification de fichier

> **`PostToolUse`** avec matcher `"Edit"` est déclenché immédiatement après chaque appel à l'outil Edit. C'est le hook idéal pour les automatismes **post-édition** : `prettier --write`, `eslint --fix`, rebuild incrémental… `PreToolUse` s'exécute *avant* (utile pour bloquer une commande `rm -rf`). `Stop` ne se déclenche qu'une fois à la fin — trop tard pour formatter fichier par fichier.

---
type: single
timer: 30
difficulty: hard
tags: [agentic-coding]
---

## Dans la configuration d'un hook Claude Code, que signifie le paramètre `async: true` ?

- [ ] Le hook s'exécute avant que l'agent commence sa tâche et peut annuler l'action en cours
- [ ] Le hook s'exécute sur un serveur distant sans consommer de ressources sur la machine locale
- [ ] Le hook est facultatif et ne bloque pas la session si la commande shell échoue
- [x] Le hook s'exécute en parallèle de l'agent sans le bloquer, l'agent continue immédiatement

> Sans `async: true`, le hook est **synchrone** : l'agent attend la fin de la commande shell avant de continuer — ce qui peut ralentir ou bloquer le workflow. Avec **`async: true`**, la commande s'exécute **en parallèle** : l'agent continue pendant que la notif macOS, le son synthétique ou le script s'exécutent. Indispensable pour les notifications qui ne doivent pas perturber le débit de l'agent.

---
type: single
timer: 15
difficulty: easy
tags: [MCP]
---

## Quelle analogie populaire est utilisée pour décrire MCP (Model Context Protocol) et sa valeur ?

- [ ] « Le Bluetooth pour les agents IA » — une connexion sans fil entre modèles et services
- [ ] « Le REST pour l'intelligence artificielle » — une API standardisée pour interroger les LLMs
- [x] « L'USB-C pour les LLMs » — une interface universelle pour brancher n'importe quel service
- [ ] « Le Docker pour les modèles » — un système de containerisation des capacités des agents

> L'analogie **"USB-C pour les LLMs"** illustre la proposition de valeur de MCP : avant MCP, chaque intégration (Jira, GitHub, Figma, Sentry…) nécessitait du code custom à maintenir — problème N×M. MCP fournit **1 interface commune** pour N outils, résolvant le problème en N+M connecteurs. Lancé par Anthropic en 2024, le protocole est aujourd'hui adopté par tous les grands acteurs (Google, Microsoft, OpenAI…).

---
type: multiple
timer: 25
difficulty: medium
tags: [MCP, CLI]
---

## Dans quels cas faut-il préférer le CLI (ex: `gh`) plutôt qu'un serveur MCP ? (sélectionnez 2)

- [x] Dans les scripts CI/CD où aucun hôte MCP n'est disponible pour exécuter les commandes
- [x] Quand la sortie doit rester lisible par un humain sous forme de logs ou d'URLs
- [ ] Quand l'agent doit chaîner plusieurs appels autonomes vers le même service externe
- [ ] Quand les résultats doivent être structurés en JSON typé pour être traités par l'agent

> **Règle d'or : MCP si l'agent décide, CLI si le script décide.** Préférer le **CLI** pour : scripts CI/CD (pas besoin d'hôte MCP), output humain-lisible (logs, URLs de PR), et environnements sans agent. Préférer **MCP** pour : résultats structurés JSON que l'agent va parser, enchaînement d'appels autonomes (lire → décider → écrire), erreurs typées récupérables. Éviter de dupliquer : si le MCP GitHub est actif, ne pas aussi appeler `gh` via Bash.

---
type: single
timer: 30
difficulty: hard
tags: [MCP]
---

## Dans l'architecture MCP, quel type de transport est utilisé pour communiquer avec un serveur MCP local (sur la même machine) ?

- [x] `stdio` — communication via stdin/stdout avec un processus enfant sur la même machine
- [ ] `HTTP/SSE` — communication via protocole HTTP avec un service déployé en réseau
- [ ] `WebSocket` — canal bidirectionnel persistant entre l'hôte MCP et le serveur
- [ ] `gRPC` — appels de procédures distantes avec sérialisation Protocol Buffers

> MCP utilise deux transports : **`stdio`** pour les serveurs locaux (le host lance un processus enfant, communique via stdin/stdout — plus simple et sécurisé, pas de port réseau) et **`HTTP/SSE`** pour les serveurs distants déployés sur le réseau. La distinction n'impacte que la configuration dans `.mcp.json` (`command:` pour stdio, `url:` pour HTTP/SSE). `WebSocket` et `gRPC` ne font pas partie du protocole MCP standard.

---
type: single
timer: 15
difficulty: easy
tags: [SDD]
---

## Selon les données du deck (LogRocket/GitLab 2025), combien de fois plus coûteuse est une erreur détectée dans le code plutôt que dans les spécifications ?

- [ ] 2 fois plus coûteuse — un refactoring représente environ le double d'une correction de spec
- [ ] 5 fois plus coûteuse — le coût de correction augmente à chaque phase du cycle de développement
- [x] 10 fois plus coûteuse — réviser 2000 lignes de code prend 6 à 10 fois plus de temps que 200 lignes de spec
- [ ] 20 fois plus coûteuse — le risque de régression s'accumule exponentiellement en production

> Le rapport **10x** illustre l'asymétrie fondamentale du spec-driven development : une review de specs prend 20-30 min sur 200 lignes de markdown, contre 2-4 heures sur 2000 lignes de code. Avec l'IA, ce rapport est encore plus marqué — une erreur de contexte dans la spec génère des centaines de lignes de code hors-sujet à jeter. D'où le principe : **review specs avant de review code**.

---
type: single
timer: 20
difficulty: medium
tags: [SDD]
---

## Quel framework de Spec-Driven Development est qualifié d'"AI agnostic" et compatible avec Claude, Cursor, Copilot et 35+ plateformes ?

- [ ] Superpowers — plugin officiel de la marketplace Anthropic, optimisé pour Claude Code
- [x] SpecKit — toolkit open source utilisable en CLI et intégrable avec tout agent de code
- [ ] BMAD Method — framework enterprise avec 21 rôles spécialisés et audit trails complets
- [ ] Task Master — extension centrée sur Cursor pour la décomposition de tâches en fichiers

> **SpecKit** est explicitement décrit comme **AI agnostic** : il fonctionne avec Claude Code, Cursor, Copilot, Gemini CLI et tous les autres agents. Il inclut 9 skills (`/speckit.specify`, `/speckit.plan`, `/speckit.implement`…) et peut aussi être utilisé en **CLI standalone** en dehors de tout agent. **Superpowers** est spécifique à la marketplace Claude Code. **Task Master** est centré Cursor. **BMAD** vise les contextes enterprise réglementés.

---
type: multiple
timer: 30
difficulty: hard
tags: [SDD, agentic-coding]
---

## Selon la matrice de décision du deck, quels frameworks SDD sont recommandés ensemble pour un utilisateur Claude Code souhaitant couvrir le cycle complet ? (sélectionnez 2)

- [x] Superpowers — couvre le cycle de dev complet côté process (brainstorming, plans, review, git)
- [x] SpecKit — couvre la phase spec côté contenu (PRD, clarification, implémentation, issues GitHub)
- [ ] BMAD Method — recommandé pour les contextes enterprise avec exigences de traçabilité
- [ ] Task Master — recommandé pour les utilisateurs Cursor gérant la décomposition de tâches

> La matrice indique explicitement : pour les **utilisateurs Claude Code**, la combinaison **Superpowers + SpecKit** couvre le cycle complet. **Superpowers** apporte 14 skills de *process* (brainstorming → plan → subagent-driven-dev → code-review → git). **SpecKit** apporte 9 skills de *spec* (specify → clarify → plan → implement → taskstoissues). Les deux sont complémentaires et coexistent dans le même projet Claude Code.

---
type: single
timer: 30
difficulty: hard
tags: [SDD]
---

## Selon le deck, dans quel contexte la méthode BMAD est-elle particulièrement recommandée ?

- [ ] Pour un développeur solo sur un projet greenfield qui veut maximiser sa vélocité individuelle
- [ ] Pour une startup early-stage qui veut itérer rapidement sans alourdir son processus
- [ ] Pour un projet brownfield existant où il faut ajouter des features sur une codebase héritée
- [x] Pour une équipe enterprise dans un domaine réglementé nécessitant audit trails et traçabilité complète

> **BMAD** (Breakthrough Method for Agile Development) est un framework enterprise avec 21 rôles spécialisés (Analyst, PM, Architect, Dev Frontend/Backend, QA, DevOps, Scrum Master…), des **audit trails** complets et une traçabilité à chaque décision. Il cible les secteurs **réglementés** (finance, santé, défense) où chaque choix technique doit être justifiable. Pour un solo dev ou une startup, des frameworks plus légers comme OpenSpec ou SpecKit sont recommandés.

---
type: single
timer: 20
difficulty: medium
tags: [agentic-coding]
---

## Selon la citation d'Andrej Karpathy reprise dans le deck, Software 2.0 automatise facilement ce qu'on peut faire quoi ?

- [ ] Spécifier — définir précisément le comportement attendu sous forme de règles explicites
- [ ] Tester — écrire des cas de test qui couvrent les comportements nominaux et les cas limites
- [x] Vérifier — valider automatiquement qu'un résultat est correct après sa production
- [ ] Documenter — décrire en langage naturel le fonctionnement attendu du système

> La citation de Karpathy : *"Software 1.0 easily automates what you can **specify**. Software 2.0 easily automates what you can **verify**."* L'implication pratique : la limite à l'autonomie d'un agent n'est pas le modèle — c'est votre **verification infrastructure** (tests, builds, linters, observabilité…). Sans capacité de vérification automatique, l'agent produit mais ne peut pas valider, et l'humain doit rester en boucle permanente.

---
type: multiple
timer: 25
difficulty: medium
tags: [agentic-coding]
---

## Selon l'ordre de priorité du deck, quels sont les deux piliers de la verification infrastructure à améliorer en premier ? (sélectionnez 2)

- [x] Testing — sans tests, l'agent ne peut pas vérifier la correction de ce qu'il produit
- [x] Build Systems — sans builds fiables, l'agent gaspille des cycles sur des erreurs fantômes
- [ ] Observability — indispensable en production mais moins critique pour l'autonomie initiale de l'agent
- [ ] Security — important à terme mais n'impacte pas directement l'autonomie immédiate de l'agent

> Les 8 piliers sont ordonnés par **leverage** sur l'autonomie agent. **Testing** (#1) : sans tests, l'agent génère du code non-vérifiable. **Build Systems** (#2) : sans builds fiables, l'agent chasse des erreurs fantômes. **Code Quality** (#3) : sans gates qualité, le code est incohérent. **Documentation** (#4) : sans docs, l'agent improvise. Observability et Security sont importants mais ne sont pas les points de départ prioritaires.

---
type: single
timer: 30
difficulty: hard
tags: [agentic-coding]
---

## Dans le scoring de la verification infrastructure (80 points au total), à partir de quel seuil un projet atteint le niveau "Advanced" permettant une haute autonomie des agents ?

- [ ] À partir de 40 points (>50%) — représente un niveau d'autonomie modérée avec supervision régulière
- [ ] À partir de 48 points (>60%) — représente le seuil optimal recommandé pour les équipes agiles
- [x] À partir de 57 points (>70%) — niveau Advanced où les agents peuvent travailler avec supervision minimale
- [ ] À partir de 72 points (>90%) — niveau expert réservé aux équipes les plus matures du marché

> Le scoring classe les projets en 3 niveaux : **Basic** (0-32 pts, <40%) = output agent non fiable, supervision lourde ; **Ready** (33-56 pts, 40-70%) = agents capables avec supervision ; **Advanced** (57-80 pts, >70%) = haute autonomie possible, supervision minimale. La barre de **57 points** (7 points par pilier sur 8) est atteignable avec un investissement structuré sur Testing, Build, Code Quality et Documentation.

---
type: multiple
timer: 25
difficulty: medium
tags: [subagents, agentic-coding]
---

## Parmi ces caractéristiques, lesquelles distinguent un workflow multi-agent d'un simple recours à un seul subagent ? (sélectionnez 2)

- [x] Plusieurs agents spécialisés travaillent simultanément en parallèle
- [x] Le coût en tokens est multiplié par N, correspondant aux N appels modèle simultanés
- [ ] Chaque agent dispose de son propre contexte isolé du thread principal
- [ ] Le résultat est retourné sous forme de résumé au thread orchestrateur principal

> **Subagent** = 1 agent spécialisé, contexte isolé, séquentiel. **Multi-agent** = N agents en **parallèle**, chacun dans son worktree et son contexte. Les deux partagent l'isolation de contexte et le retour résumé — ce n'est pas ce qui les distingue. Ce qui distingue le multi-agent : le **parallélisme** et le **coût × N** (N appels modèle simultanés). La latence est bornée par le subagent le plus lent, pas par la somme de tous.

---
type: single
timer: 30
difficulty: hard
tags: [subagents, agentic-coding]
---

## Dans un workflow dynamique agent-driven, comment l'orchestration se distingue-t-elle d'un workflow statique de type DAG ?

- [ ] Le workflow dynamique est entièrement prédéfini en amont ; le DAG s'adapte au contexte d'exécution
- [ ] Le workflow dynamique n'utilise pas de subagents ; le DAG orchestre des agents en parallèle
- [x] Le workflow dynamique décide à l'exécution quel subagent invoquer selon le contexte ; le DAG suit un graphe figé à l'avance
- [ ] Le workflow dynamique ne peut pas être reproduit ; le DAG garantit une exécution toujours identique

> Un **DAG statique** (LangGraph, Airflow, n8n) fixe le graphe d'exécution à l'avance : les étapes et leurs dépendances sont connues. Un **workflow dynamique** laisse l'**agent principal décider** à l'exécution : il spawne `security` si OWASP est détecté, `perf` si un benchmark est sous le seuil, re-spawne `code` avec le feedback du reviewer… La flexibilité est énorme mais la traçabilité plus complexe — d'où l'importance des hooks et de l'observabilité.

---
type: multiple
timer: 30
difficulty: hard
tags: [subagents, agentic-coding]
---

## Pour briefer correctement un subagent via le Task tool, quels éléments doit contenir le prompt de délégation ? (sélectionnez 3)

- [x] Le contexte — les informations que le subagent doit connaître pour réaliser la tâche
- [x] L'objectif — ce que le subagent doit produire ou accomplir précisément
- [x] Le format de sortie — la forme attendue du résultat (longueur, structure, format attendu)
- [ ] La référence à la conversation principale — pour que le subagent reprenne le fil des échanges précédents

> Le principe du Task tool : **"Briefer comme un collègue qui vient d'arriver"** — il ne voit pas la conversation principale, il faut tout lui expliquer dans le prompt. Un bon prompt contient : **contexte** (ce qu'il doit savoir), **objectif** (ce qu'il doit faire), **format de sortie** (ex: *"rapport en moins de 200 mots"* pour éviter de polluer le contexte principal). La référence à la conversation principale est impossible — le subagent part d'un contexte vierge par design.
