# MCP - deep dive — Plan

**Target questions:** 30
**Estimated duration:** ~735 secondes (~12 min)
**Language:** Français
**Difficulty mix:** 30 % easy, 50 % medium, 20 % hard
**Question types:** Mix — 24 single-choice + 6 multiple-choice
**Audience:** Dev IA / agentic engineers (intermédiaire-senior, sait LLM + tool calling + Python)

---

## Sources Used

- `01-intro.md` — prérequis & objectifs de la session
- `02-pourquoi-mcp.md` — problème N×M, le mantra « MCP n'est pas une API »
- `03-architecture.md` — Host / Client / Server, relation 1:1:1, local vs remote, data layer vs transport layer
- `04-specifications.md` — JSON-RPC 2.0, lifecycle, capabilities negotiation, version 2025-11-25, SDKs
- `05-primitives-server.md` — Tools (modèle), Resources (app), Prompts (utilisateur), Notifications
- `06-primitives-client.md` — Sampling, Elicitation, Roots, Logging, HITL
- `07-extensions.md` — Auth (OAuth 2.1), Apps, Tasks (expérimental)
- `09-fastmcp.md` — FastMCP : décorateurs, hosting, client, ~70 % de l'écosystème
- `10-ecosysteme.md` — Agentic coding, OpenAPI → MCP, frameworks AI clients, checklist SWE
- `12-wrap-up.md` — 3 take-aways
- `structure-links.md` — table des matières / liens officiels

> Couverture solide sur tous les modules — **pas de recherche web nécessaire**.

---

## Difficulty Distribution

| Difficulty | Count | Percentage |
|------------|-------|------------|
| easy       | 9     | 30 %       |
| medium     | 15    | 50 %       |
| hard       | 6     | 20 %       |

---

## Tag Coverage

| Tag           | Questions                              |
|---------------|----------------------------------------|
| intro         | Q1, Q2, Q3                             |
| architecture  | Q4, Q5, Q6, Q7, Q8                     |
| transport     | Q6, Q7                                 |
| spec          | Q9, Q10, Q11, Q12, Q13                 |
| json-rpc      | Q9, Q10                                |
| lifecycle     | Q10, Q11                               |
| capabilities  | Q11, Q12                               |
| server        | Q14, Q15, Q16, Q17, Q18                |
| tools         | Q14, Q15                               |
| resources     | Q16                                    |
| prompts       | Q14                                    |
| notifications | Q17, Q18                               |
| client        | Q19, Q20, Q21, Q22                     |
| sampling      | Q19, Q22                               |
| elicitation   | Q21                                    |
| roots         | Q20                                    |
| security      | Q21, Q22, Q23                          |
| extensions    | Q23, Q24                               |
| auth          | Q23                                    |
| fastmcp       | Q25, Q26, Q27                          |
| ecosystem     | Q28, Q29, Q30                          |
| langchain     | Q29                                    |
| openapi       | Q30                                    |
| swe           | Q27, Q28                               |

---

## Questions

### Q1 — Le problème que résout MCP : N×M → N+M

- **Type:** single
- **Difficulty:** easy
- **Timer:** 20s
- **Tags:** [intro, mcp]
- **Source:** `02-pourquoi-mcp.md` § Le problème : N × M
- **Key concept:** Sans MCP, **N** apps LLM × **M** services = N×M intégrations custom. Avec MCP, **N + M** implémentations parlent toutes le même protocole.
- **Notes:** Bonne réponse : passe de N×M à N+M intégrations. Distracteurs : « N×log(M) », « réduit M à 1 », « unifie les APIs REST sous OpenAPI ».

### Q2 — Analogie courante mais incomplète : « USB-C pour les LLM »

- **Type:** single
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [intro, mcp, protocol]
- **Source:** `02-pourquoi-mcp.md` (slidev notes) — analogie SMTP/IMAP/LSP
- **Key concept:** L'analogie « USB-C pour LLM » est populaire, mais MCP est **plus** qu'un câble : c'est un **protocole stateful** avec lifecycle et négociation, plus proche de **SMTP/IMAP/LSP** que d'USB.
- **Notes:** Bonne réponse pointe la nature stateful / LSP-like. Distracteurs : « équivalent strict d'USB-C », « simple format JSON », « surcouche REST/OpenAPI ».

### Q3 — « MCP n'est pas une API ». Quelle est la formulation correcte ?

- **Type:** single
- **Difficulty:** hard
- **Timer:** 30s
- **Tags:** [intro, mcp, protocol]
- **Source:** `02-pourquoi-mcp.md` slide statement « MCP n'est pas une API. C'est un protocole stateful. »
- **Key concept:** MCP est un **protocole stateful** avec lifecycle, négociation de capabilities et primitives strictes — pas un wrapper REST ni un « OpenAPI pour LLM ».
- **Notes:** Distracteurs subtils : « API REST documentée par OpenAPI », « SDK officiel Anthropic », « format de tool calling unique aux LLM Claude ».

### Q4 — Les trois composants de l'architecture MCP

- **Type:** single
- **Difficulty:** easy
- **Timer:** 20s
- **Tags:** [architecture]
- **Source:** `03-architecture.md` § Trois composants
- **Key concept:** **Host** (l'app IA visible) → **Client** (composant logique interne, 1 par connexion) → **Server** (programme indépendant qui expose les primitives).
- **Notes:** Distracteurs : « broker / producer / consumer », « frontend / backend / DB », « LLM / runtime / API ».

### Q5 — La relation entre Host, Client et Server

- **Type:** single
- **Difficulty:** easy
- **Timer:** 20s
- **Tags:** [architecture]
- **Source:** `03-architecture.md` § Trois composants — relation 1:1:1 sur chaque connexion
- **Key concept:** 1 **host** → N **clients** → N **servers**, mais **chaque client gère exactement 1 server via 1 connexion dédiée** (1:1:1).
- **Notes:** Bonne réponse : 1 client = 1 connexion = 1 server. Distracteurs : « 1 client = N servers », « les servers se voient entre eux », « pas de hiérarchie ».

### Q6 — Transport local : stdio

- **Type:** single
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [architecture, transport]
- **Source:** `03-architecture.md` § Local vs Remote
- **Key concept:** Stdio = process forké par le host, communication via stdin/stdout, **mono-client** (1 server = 1 process), pas de réseau, pas d'auth nécessaire.
- **Notes:** Bonne réponse insiste sur mono-client + process forké. Distracteurs : « multi-client via fichier socket », « stdio = HTTP/2 sur Unix socket », « stdio supporte naturellement plusieurs hosts ».

### Q7 — Transport remote : Streamable HTTP

- **Type:** single
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [architecture, transport]
- **Source:** `03-architecture.md` § Local vs Remote
- **Key concept:** Streamable HTTP = **HTTP POST + Server-Sent Events (SSE) optionnel**, multi-client (1 server sert N hosts), **OAuth 2.1 recommandé** pour l'auth.
- **Notes:** Distracteurs : « WebSocket obligatoire », « gRPC streaming », « HTTP/2 push exclusivement ».

### Q8 — Data layer vs Transport layer

- **Type:** single
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [architecture, layers]
- **Source:** `03-architecture.md` § Deux couches
- **Key concept:** Le **data layer** (JSON-RPC + lifecycle + primitives) est **invariant** quel que soit le transport. Le **transport layer** (stdio / HTTP) est swappable sans toucher au data layer — c'est ce qui rend MCP futur-proof.
- **Notes:** Distracteurs : « les capabilities dépendent du transport », « stdio ne supporte pas les notifications », « OAuth fait partie du data layer ».

### Q9 — Les trois types de messages JSON-RPC 2.0 dans MCP

- **Type:** single
- **Difficulty:** easy
- **Timer:** 20s
- **Tags:** [spec, json-rpc]
- **Source:** `04-specifications.md` § JSON-RPC 2.0 — la grammaire
- **Key concept:** Request (avec `id`) → Response (même `id`) → Notification (**pas d'`id`**, pas de réponse attendue).
- **Notes:** Distracteurs : « event / command / query », « request / ack / nak », « 4 types dont broadcast ».

### Q10 — La séquence obligatoire du lifecycle MCP

- **Type:** single
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [spec, lifecycle]
- **Source:** `04-specifications.md` § Lifecycle — séquence d'ouverture
- **Key concept:** `initialize` (client→server) → `initialize result` (server→client) → `notifications/initialized` (client→server) → puis seulement les opérations métier.
- **Notes:** Bonne réponse insiste sur l'ordre des 3 messages avant tout `tools/list`. Distracteurs : ordre inversé, ou « pas de handshake », ou « initialize est facultatif ».

### Q11 — Pourquoi la capabilities negotiation est cruciale

- **Type:** single
- **Difficulty:** hard
- **Timer:** 30s
- **Tags:** [spec, capabilities]
- **Source:** `04-specifications.md` § Capabilities negotiation
- **Key concept:** Sans négociation, un client appellerait des méthodes que le server n'implémente pas (`prompts/list` sur un server sans prompts → erreur). La négociation = **contrat bilatéral opt-in**, permet d'évoluer sans casser, et impose **`if (server.capabilities.tools) { ... }`** avant tout `tools/list`.
- **Notes:** Distracteurs : « optimise la perf réseau », « obligatoire pour OAuth », « remplace le versioning ».

### Q12 — Capabilities asymétriques : qui expose quoi ?

- **Type:** multiple
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [spec, capabilities, server, client]
- **Source:** `04-specifications.md` § Capabilities ; `05-primitives-server.md` ; `06-primitives-client.md`
- **Key concept:** Les capabilities sont **asymétriques** : `tools`, `resources`, `prompts`, `logging`, `completions` côté **server** ; `sampling`, `elicitation`, `roots` côté **client**.
- **Notes:** Cocher : `tools` server, `prompts` server, `sampling` client, `elicitation` client. Ne pas cocher : « `oauth` côté server » (transport, pas capability), « `tools` côté client » (faux).

### Q13 — Version cible de la spec et SDKs

- **Type:** single
- **Difficulty:** medium
- **Timer:** 22s
- **Tags:** [spec, sdk]
- **Source:** `04-specifications.md` § Version & SDKs
- **Key concept:** Version stable cible : **`2025-11-25`** (versionning par date). SDKs officiels : TypeScript (référence), Python (FastMCP mergé), Kotlin, Java, C#, Swift. Tous parlent le même JSON-RPC → un client Python parle à un server TS sans souci.
- **Notes:** Distracteurs : « versionning semver », « SDK uniquement Python », « SDK propriétaire Anthropic ».

### Q14 — Les trois primitives server

- **Type:** single
- **Difficulty:** easy
- **Timer:** 20s
- **Tags:** [server, primitives, tools, resources, prompts]
- **Source:** `05-primitives-server.md` § Qui contrôle quoi ?
- **Key concept:** Server expose 3 primitives : **Tools** (actions exécutables), **Resources** (données contextuelles lecture seule), **Prompts** (templates de workflows).
- **Notes:** Distracteurs : « functions / files / sessions », « endpoints / events / queries ».

### Q15 — Qui contrôle chaque primitive server ?

- **Type:** multiple
- **Difficulty:** medium
- **Timer:** 30s
- **Tags:** [server, primitives]
- **Source:** `05-primitives-server.md` § Qui contrôle quoi ?
- **Key concept:** **Tools** → contrôlés par le **modèle** (le LLM décide d'appeler). **Resources** → contrôlées par l'**application** (l'app sélectionne ce qu'elle envoie). **Prompts** → contrôlés par l'**utilisateur** (slash command explicite).
- **Notes:** 3 affirmations correctes + 1-2 distracteurs faux comme « Tools = utilisateur uniquement » ou « Resources = modèle ».

### Q16 — Resources directes vs templates

- **Type:** single
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [server, resources]
- **Source:** `05-primitives-server.md` § Resources — données par URI
- **Key concept:** Resources directes = URI fixe (`file:///home/me/notes.md`), listées via `resources/list` puis lues via `resources/read`. Templates = URI paramétrée (`weather://forecast/{city}/{date}`), listées via `resources/templates/list`, complétion possible.
- **Notes:** Distracteurs : « directes = lecture, templates = écriture », « templates sont un format JSON Schema », « pas de différence dans la spec ».

### Q17 — Capability-based subscription pour `list_changed`

- **Type:** single
- **Difficulty:** hard
- **Timer:** 30s
- **Tags:** [server, notifications, capabilities]
- **Source:** `05-primitives-server.md` § Notifications ; `04-specifications.md`
- **Key concept:** Les notifications comme `notifications/tools/list_changed` ne sont **envoyées que si le server a déclaré `"listChanged": true`** dans ses capabilities au handshake. Sinon → polling manuel côté client.
- **Notes:** Distracteurs : « toujours envoyé par défaut », « client peut forcer la subscription via header HTTP », « les notifications n'existent qu'en HTTP, pas en stdio ».

### Q18 — Notifications usuelles côté server

- **Type:** multiple
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [server, notifications]
- **Source:** `05-primitives-server.md` § Notifications
- **Key concept:** Notifications classiques : `notifications/tools/list_changed`, `notifications/resources/list_changed`, `notifications/resources/updated`, `notifications/progress`.
- **Notes:** 4 réponses correctes + 1-2 distracteurs (`notifications/heartbeat`, `notifications/tools/error_rate`).

### Q19 — Les primitives client : à quoi servent-elles ?

- **Type:** single
- **Difficulty:** easy
- **Timer:** 20s
- **Tags:** [client, primitives]
- **Source:** `06-primitives-client.md` § Le client expose aussi des features
- **Key concept:** Les primitives client **inversent le flux** : c'est le **server qui initie**, le **client qui répond**. Permet sampling, elicitation, roots, logging.
- **Notes:** Distracteurs : « les primitives client servent uniquement à logger », « les primitives client n'existent pas dans la spec stable », « identiques aux primitives server, juste exposées par le client ».

### Q20 — Les primitives client par nom et fonction

- **Type:** multiple
- **Difficulty:** medium
- **Timer:** 30s
- **Tags:** [client, primitives, sampling, elicitation, roots]
- **Source:** `06-primitives-client.md` § tableau primitives client
- **Key concept:** **Sampling** = server demande au client de faire un appel LLM. **Elicitation** = server demande une info à l'utilisateur. **Roots** = client annonce les dossiers en scope (file://). **Logging** = server envoie ses logs au client.
- **Notes:** Cocher les 4 affirmations correctes. Distracteurs : « roots définit l'auth », « sampling sert à faire du fine-tuning ».

### Q21 — Règle de sécurité d'`elicitation`

- **Type:** single
- **Difficulty:** hard
- **Timer:** 30s
- **Tags:** [client, elicitation, security]
- **Source:** `06-primitives-client.md` § Elicitation
- **Key concept:** **`elicitation` ne demande JAMAIS un password ni une clé API** — c'est une règle de la spec. Le client doit refuser / alerter si un server essaie.
- **Notes:** Distracteurs : « elicitation peut demander des passwords si chiffrés », « elicitation est purement informative, le client ne valide rien », « la règle ne s'applique qu'en remote ».

### Q22 — Sampling et human-in-the-loop

- **Type:** single
- **Difficulty:** hard
- **Timer:** 30s
- **Tags:** [client, sampling, security, hitl]
- **Source:** `06-primitives-client.md` § Sampling + statement HITL
- **Key concept:** Le `sampling/createMessage` permet au server de **rester model-independent** (pas d'embarquer Anthropic / OpenAI SDK ni de gérer les clés API), et impose un **checkpoint UI** (approval) côté client — le server **ne peut pas appeler un LLM en silence**.
- **Notes:** Bonne réponse combine les deux idées. Distracteurs : « sampling = échantillonnage de logs », « pas de validation utilisateur requise », « sampling oblige le server à connaître les clés API ».

### Q23 — Auth selon le transport

- **Type:** single
- **Difficulty:** easy
- **Timer:** 22s
- **Tags:** [extensions, auth, security]
- **Source:** `07-extensions.md` § Auth — OAuth 2.1
- **Key concept:** **Stdio** = pas d'auth nécessaire (local, contrôle OS). **Streamable HTTP** multi-tenant = **auth obligatoire**, **OAuth 2.1 recommandé**. Le flow OAuth se fait côté host.
- **Notes:** Distracteurs : « OAuth obligatoire même en stdio », « auth = MTLS uniquement », « bearer tokens interdits par la spec ».

### Q24 — Statut des extensions Apps et Tasks

- **Type:** multiple
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [extensions]
- **Source:** `07-extensions.md` § Apps & Tasks + Récap
- **Key concept:** **Apps** = UI embarquée dans la conversation, stable (mais tooling jeune). **Tasks** = wrappers d'exécution durable (long-running, batchs), **encore expérimental** en 2026. **Auth** = stable.
- **Notes:** Cocher : Auth stable, Apps stable mais jeune, Tasks expérimental. Distracteurs : « Tasks est la primitive recommandée pour la prod 2026 », « Apps remplace Streamable HTTP ».

### Q25 — Qu'est-ce que FastMCP, et quelle est sa part de marché ?

- **Type:** single
- **Difficulty:** easy
- **Timer:** 20s
- **Tags:** [fastmcp]
- **Source:** `09-fastmcp.md` § ~70 %
- **Key concept:** FastMCP = **framework Python de référence pour MCP** ; ~**70 %** des servers MCP en circulation ; ~1M téléchargements par jour ; FastMCP 1.0 a été **mergé dans le SDK Python officiel**.
- **Notes:** Distracteurs : « SDK officiel TypeScript », « framework Rust », « bibliothèque Java/Spring ».

### Q26 — Les décorateurs FastMCP

- **Type:** multiple
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [fastmcp, primitives]
- **Source:** `09-fastmcp.md` § `@mcp.tool` ; `@mcp.resource` ; `@mcp.prompt`
- **Key concept:** Décorateurs `@mcp.tool`, `@mcp.resource("<uri template>")`, `@mcp.prompt`. Le schema JSON est **généré depuis les type hints Python**, la description vient de la docstring. `mcp.run()` lance en stdio par défaut.
- **Notes:** Cocher 3 décorateurs valides + le fait que les schémas sont auto-générés depuis les type hints. Distracteurs : `@mcp.endpoint` (n'existe pas), `@mcp.handler`.

### Q27 — Discipline SWE pour un server MCP en prod

- **Type:** single
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [fastmcp, swe]
- **Source:** `10-ecosysteme.md` § Tools & DX Checklist ; `12-wrap-up.md`
- **Key concept:** Un server MCP est **un service comme un autre** : tests, CI/CD, versioning sémantique, registry, observability (logs structurés, métriques, traces), auth OAuth 2.1 pour remote multi-tenant, rate-limiting, outils (MCP Inspector, MCPman).
- **Notes:** Bonne réponse insiste sur le fait que MCP n'exempte d'**aucune** des bonnes pratiques. Distracteurs : « MCP fournit auto les tests d'intégration », « pas besoin de versioning, capabilities suffisent », « rate-limiting interdit par la spec ».

### Q28 — Portabilité des servers MCP entre frameworks AI

- **Type:** single
- **Difficulty:** easy
- **Timer:** 20s
- **Tags:** [ecosystem, swe]
- **Source:** `10-ecosysteme.md` § Frameworks avec client MCP intégré + slogan « write once, plug anywhere »
- **Key concept:** Un **même server MCP** fonctionne **sans modification** avec Claude Code, LangChain/LangGraph, OpenAI Agents SDK, CrewAI, AutoGen, Pydantic AI, LlamaIndex, Mastra, Vercel AI SDK, Strands, Semantic Kernel… — « write once, plug anywhere ».
- **Notes:** Distracteurs : « il faut un adaptateur Anthropic-only », « LangChain/LangGraph propriétaires », « OpenAI ne supporte pas MCP ».

### Q29 — Frameworks AI avec client MCP intégré

- **Type:** multiple
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [ecosystem, langchain]
- **Source:** `10-ecosysteme.md` § Tableau frameworks
- **Key concept:** Identifier ceux qui ont un client MCP intégré (LangChain via `langchain-mcp-adapters`, OpenAI Agents SDK via `MCPServerStdio`/`MCPServerSse`, Vercel AI SDK via `experimental_createMCPClient`, Pydantic AI natif) vs ceux qui n'en ont pas ou sont des distracteurs.
- **Notes:** Cocher au moins LangChain/LangGraph, OpenAI Agents SDK, Vercel AI SDK, Pydantic AI. Distracteurs : « jQuery » (non-AI), « Hugging Face Transformers » (non MCP-native intégrée à la lib transformers).

### Q30 — Limites des proxies OpenAPI → MCP

- **Type:** single
- **Difficulty:** hard
- **Timer:** 30s
- **Tags:** [ecosystem, openapi]
- **Source:** `10-ecosysteme.md` § OpenAPI / Swagger → MCP
- **Key concept:** Les proxies OpenAPI → MCP (Higress, mcp-openapi-proxy, etc.) fonctionnent pour des APIs CRUD bien décrites, mais leurs **limites pratiques** sont : descriptions OpenAPI souvent **trop pauvres** pour bien guider le LLM, **auth OAuth / security schemes à mapper**, **patterns non-CRUD** (streaming, long-polling) mal traduits.
- **Notes:** Bonne réponse combine ces 3 limites. Distracteurs : « ne supportent que GET », « limités à 50 endpoints », « interdits par la spec MCP ».

---

## Review Checklist

- [x] Questions cover all key topics from sources (8 modules + structure)
- [x] Difficulty distribution matches target (9 / 15 / 6)
- [x] Types : 24 single + 6 multiple (Q12, Q15, Q18, Q20, Q24, Q26, Q29 — soit 7 multi, à réajuster vers 6 lors de la création si besoin)
- [x] No duplicate questions
- [x] Tags consistent and meaningful
- [x] Timer values realistic : 20s easy, 22-25s medium, 30s hard
- [x] Pas de recherche web nécessaire — sources amplement suffisantes

> Note : 7 questions sont listées comme `multiple` ci-dessus (Q12, Q15, Q18, Q20, Q24, Q26, Q29). À la création, l'une d'elles (la moins typique en multi) pourra être convertie en `single` pour respecter le quota de 6 multi.

---

_Plan créé : 2026-05-29_
_Prêt pour la génération du quiz : [ ]_
