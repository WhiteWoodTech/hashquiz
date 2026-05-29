---
title: MCP - deep dive
description: >
  Quiz approfondi sur le protocole Model Context Protocol : architecture
  client-serveur, transports (stdio, SSE, HTTP), capabilities, primitives
  (tools, resources, prompts), et construction de serveurs MCP (SDK,
  sécurité, intégrations).
theme: default
author: Maxime Lenne
tags: [mcp, ai, protocol, genai, server]
---

---
type: single
timer: 20
difficulty: easy
tags: [intro, mcp]
---

## Le problème que résout MCP

**N** applications LLM (Claude, Cursor, VS Code, agents…) doivent se brancher à **M** services
(GitHub, Sentry, DB, filesystem…). Sans MCP, combien d'intégrations faut-il maintenir ?

- [ ] N + 1 (un hub central, type bus de messages)
- [ ] N × log(M) (un dispatcher par tiers de catégorie)
- [x] **N × M** — chaque app réimplémente l'intégration de chaque service
- [ ] 1 — un wrapper REST/OpenAPI universel suffit

> Avant MCP, chaque application LLM réécrit son propre protocole de tool calling pour chaque
> service à brancher — coût exponentiel. **Avec MCP**, **N** apps et **M** servers parlent tous
> le **même protocole stateful** : on passe à **N + M** implémentations, branchables entre
> elles. C'est exactement le rôle qu'a joué LSP (Language Server Protocol) côté éditeurs /
> langages.

---
type: single
timer: 25
difficulty: medium
tags: [intro, mcp, protocol]
---

## « MCP, c'est l'USB-C des LLM » — pourquoi l'analogie est incomplète

- [ ] Parce qu'USB-C est plus rapide que JSON-RPC sur stdio
- [ ] Parce qu'USB-C est propriétaire et MCP est open-source
- [x] USB-C reste un **câble** ; MCP est un **protocole stateful** avec lifecycle (LSP / SMTP / IMAP)
- [ ] Parce qu'USB-C ne supporte qu'un transport, alors que MCP n'en supporte aucun nativement

> L'analogie USB-C aide à vendre l'idée d'un connecteur universel, mais elle écrase une
> dimension cruciale : USB-C est un standard électrique / mécanique sans état métier. **MCP est
> un vrai protocole stateful** avec négociation de capabilities, lifecycle (`initialize`,
> shutdown), primitives strictes — donc beaucoup plus proche de **LSP, SMTP, IMAP** que d'un
> câble. Conséquence : on le traite avec la rigueur d'un protocole réseau, pas d'un wrapper REST.

---
type: single
timer: 30
difficulty: hard
tags: [intro, mcp, protocol]
---

## « MCP n'est pas une API » — quelle est la formulation correcte ?

- [ ] MCP est une **API REST** documentée par une spec OpenAPI partagée par tous les LLM
- [ ] MCP est un **SDK officiel Anthropic** étendu plus tard aux autres LLM
- [ ] MCP est un **format de tool calling** propre à Claude, indépendant du transport
- [x] MCP est un **protocole stateful** (JSON-RPC + lifecycle + capabilities + primitives), pas une API

> La phrase choc de la session : **« MCP n'est pas une API. C'est un protocole stateful. »** Une
> API REST est sans état, sans handshake, sans négociation. MCP a un **lifecycle** explicite
> (`initialize` → `notifications/initialized` → opérations → shutdown), une **négociation de
> capabilities bilatérale**, et des **primitives strictes** (tools, resources, prompts,
> sampling, elicitation, roots). Anthropic l'a publié comme **standard ouvert** — tous les LLM
> majeurs et frameworks AI le supportent en 2026.

---
type: single
timer: 20
difficulty: easy
tags: [architecture]
---

## Les trois composants de l'architecture MCP

- [ ] Broker / Producer / Consumer
- [x] **Host** (l'app IA) → **Client** (composant logique interne) → **Server** (programme indépendant)
- [ ] Frontend / Backend / Database
- [ ] LLM / Runtime / API Gateway

> L'architecture MCP repose sur trois rôles distincts : le **Host** est l'application IA
> visible (Claude Desktop, VS Code, Cursor, agent custom) qui orchestre tout ; le **Client** est
> un **composant logique interne du host** (pas une app — un objet/thread) qui porte une
> connexion dédiée ; le **Server** est un programme indépendant qui expose des **primitives**
> (tools, resources, prompts). Le server ne connaît pas les autres servers — l'agrégation est
> faite par le host.

---
type: single
timer: 20
difficulty: easy
tags: [architecture]
---

## La relation entre Host, Client et Server sur une connexion donnée

- [ ] 1 host → 1 client → N servers (un client peut multiplexer plusieurs servers)
- [x] **1 host → N clients → N servers** avec **1 client = 1 connexion = 1 server** (1:1:1)
- [ ] 1 host → N clients → 1 server unique partagé entre tous les clients
- [ ] Les servers se voient entre eux et coordonnent leurs réponses

> Règle fondamentale : **un host instancie autant de clients que de servers à brancher**, mais
> **chaque client gère exactement une connexion vers un seul server (relation 1:1:1)**. Pas de
> fan-out côté MCP : c'est le host qui consolide les capacités de tous les servers pour les
> exposer au modèle. Les servers s'ignorent mutuellement — l'agrégation et le routage sont la
> responsabilité du host.

---
type: single
timer: 25
difficulty: medium
tags: [architecture, transport]
---

## Transport local : caractéristiques du transport `stdio`

- [ ] HTTP/2 sur Unix socket, multi-client par design
- [ ] WebSocket localhost avec authentification bearer
- [x] **Process forké par le host**, **stdin/stdout**, **mono-client** (1 server = 1 process), pas d'auth
- [ ] Stdin/stdout chiffrés en TLS avec rotation de clés à chaque message

> Le transport **stdio** = le host **fork un process** pour chaque server et **pipe
> stdin/stdout**. Conséquence directe : **mono-client** (un process ne peut servir qu'un client
> à la fois), performance maximale (zéro réseau), **pas d'auth nécessaire** (le contrôle OS
> suffit puisque tout tourne en local sur la même machine). Exemples : filesystem server,
> SQLite server, outils `npx` lancés à la demande.

---
type: single
timer: 25
difficulty: medium
tags: [architecture, transport]
---

## Transport remote : Streamable HTTP

- [ ] WebSocket bidirectionnel obligatoire, sans fallback HTTP
- [ ] gRPC streaming exclusivement, avec auth mTLS imposée
- [x] **HTTP POST + Server-Sent Events (SSE) optionnel**, **multi-client**, **OAuth 2.1 recommandé**
- [ ] HTTP/3 + QUIC obligatoire, auth via header `X-MCP-Key` propriétaire

> Le transport **Streamable HTTP** = un serveur HTTP autonome (potentiellement managé / SaaS).
> Communication par **HTTP POST** pour les requests, et **Server-Sent Events (SSE)**
> unidirectionnels server → client pour pousser notifications et résultats partiels — sans
> WebSocket. Un seul server peut servir **N hosts** (multi-tenant), ce qui rend
> l'**authentification obligatoire** : la spec recommande **OAuth 2.1**, avec alternatives
> bearer / API keys / headers custom.

---
type: single
timer: 25
difficulty: medium
tags: [architecture, layers]
---

## Data layer vs Transport layer : qu'est-ce qui est invariant ?

- [ ] Le transport layer (stdio/HTTP) est invariant, le data layer change selon le SDK
- [ ] Les capabilities négociées dépendent du transport choisi
- [x] **Data layer** (JSON-RPC + lifecycle + primitives) **invariant** ; **transport** swappable sans le toucher
- [ ] Stdio ne supporte pas les notifications — il faut passer à HTTP pour les utiliser

> MCP sépare proprement **data layer** (JSON-RPC 2.0, lifecycle, capabilities, primitives,
> notifications) et **transport layer** (stdio, Streamable HTTP, futurs transports). Le **data
> layer reste identique** quel que soit le transport — un même `tools/call` parle en stdio
> exactement comme en HTTP. C'est précisément cette séparation qui rend MCP **futur-proof** :
> un nouveau transport peut arriver sans casser les implémentations existantes du protocole.

---
type: single
timer: 20
difficulty: easy
tags: [spec, json-rpc]
---

## Les trois types de messages JSON-RPC 2.0 utilisés par MCP

- [ ] `event` / `command` / `query`
- [ ] `request` / `ack` / `nak`
- [x] **`request` (avec `id`)** / **`response` (même `id`)** / **`notification` (sans `id`, sans réponse)**
- [ ] 4 types : request, response, notification, broadcast

> JSON-RPC 2.0 se résume à trois types : la **request** porte un `id` corrélé et `method` +
> `params` ; la **response** réutilise le même `id` et porte `result` (ou `error`) ; la
> **notification** n'a **pas d'`id`** et n'attend **pas de réponse** (utilisée par exemple pour
> `notifications/initialized`, `notifications/tools/list_changed`, `notifications/progress`).
> Pas de broadcast natif — MCP fonctionne en 1:1 sur chaque connexion.

---
type: single
timer: 25
difficulty: medium
tags: [spec, lifecycle]
---

## Ordre obligatoire du handshake MCP avant tout appel métier

- [ ] `tools/list` → `tools/call` → `initialize` (l'init n'est qu'un opt-in tardif)
- [x] `initialize` → `initialize result` → **`notifications/initialized`** → puis seulement les ops métier
- [ ] `notifications/initialized` → `initialize` → `tools/list` (la notif vient en premier)
- [ ] Pas de handshake — chaque request porte ses propres credentials

> Le **lifecycle** MCP est strictement ordonné : (1) le client envoie `initialize` avec
> `protocolVersion`, ses `capabilities`, `clientInfo` ; (2) le server répond avec ses propres
> `capabilities` et `serverInfo` ; (3) **le client envoie `notifications/initialized`** pour
> confirmer la convergence. **Tant que ces 3 étapes ne sont pas faites, aucun appel métier
> (`tools/list`, `tools/call`, `resources/read`…) n'est légal**. Un `protocolVersion` mismatch
> ferme la connexion.

---
type: single
timer: 30
difficulty: hard
tags: [spec, capabilities]
---

## Pourquoi la négociation de capabilities est-elle cruciale ?

- [ ] Elle optimise la latence réseau en pré-cachant les résultats des prochains appels
- [ ] Elle remplace le versioning sémantique du protocole
- [ ] Elle est exigée par OAuth 2.1 — sans elle, l'auth échoue
- [x] Chaque pair n'expose que ce qu'il supporte — un client ne doit jamais appeler une méthode non-négociée

> Sans négociation, un client appellerait des méthodes que le server n'implémente pas (par
> exemple `prompts/list` sur un server qui ne fait pas de prompts) → erreurs « inconnues »
> impossibles à diagnostiquer. La **négociation** = **contrat bilatéral opt-in** : chaque côté
> annonce ce qu'il **expose** ET ce qu'il **sait recevoir**. Règle d'or côté client :
> **`if (server.capabilities.tools) { ... }`** avant tout `tools/list`. Cela permet aussi de
> **faire évoluer le protocole sans casser** les implémentations existantes.

---
type: multiple
timer: 25
difficulty: medium
tags: [spec, capabilities, server, client]
---

## Capabilities asymétriques : qui expose quoi ?

- [x] **`tools`** est une capability **server**
- [x] **`prompts`** est une capability **server**
- [x] **`sampling`** est une capability **client**
- [x] **`elicitation`** est une capability **client**
- [ ] `tools` est une capability **client** (le client expose ses propres tools au server)
- [ ] `oauth` est une capability **server** négociée à l'`initialize`

> Les capabilities MCP sont **asymétriques** par design : côté **server** on trouve `tools`,
> `resources`, `prompts`, `logging`, `completions` ; côté **client** on trouve `sampling`,
> `elicitation`, `roots`. C'est ce qui permet **l'inversion de flux** côté client (sampling =
> le server demande au LLM via le client). **`oauth` n'est pas une capability data layer** —
> c'est une affaire de **transport layer**, négociée en dehors du JSON-RPC.

---
type: single
timer: 22
difficulty: medium
tags: [spec, sdk]
---

## Version stable cible et SDKs officiels en 2026

- [ ] Version `1.4.2` (semver), SDK uniquement Python (propriétaire Anthropic)
- [x] Version **`2025-11-25`** (versioning par date) ; SDKs TS, Python (FastMCP mergé), Kotlin, Java, C#, Swift
- [ ] Version `v3` (entier), SDK unique en Rust pour des raisons de perf
- [ ] Pas de version stable — le protocole change chaque semaine en `main`

> La spec stable cible est **`2025-11-25`** — le **versioning se fait par date** (simple à
> comparer, pas de débat semver). Les SDKs officiels couvrent **TypeScript** (référence
> historique), **Python** (qui a **mergé FastMCP 1.0**), **Kotlin**, **Java**, **C#**,
> **Swift**, plus **Go** côté communauté. Tous parlent le même JSON-RPC — un client Python
> peut dialoguer avec un server TypeScript sans souci.

---
type: single
timer: 20
difficulty: easy
tags: [server, primitives, tools, resources, prompts]
---

## Les trois primitives **server** définies par MCP

- [ ] `functions` / `files` / `sessions`
- [ ] `endpoints` / `events` / `queries`
- [x] **`tools`** (actions invocables) / **`resources`** (données) / **`prompts`** (templates de workflows)
- [ ] `actions` / `state` / `templates`

> Un server MCP expose **3 primitives** distinctes : **Tools** = actions exécutables (le LLM
> décide d'appeler `search_flights`, `query_db`…), **Resources** = données contextuelles en
> **lecture seule** (fichiers, schémas DB, docs API), **Prompts** = templates de workflows
> réutilisables (typiquement exposés en **slash commands** côté host : `/plan-vacation`,
> `/review-pr`). Cette tripartition correspond à 3 niveaux de contrôle distincts (modèle /
> app / utilisateur).

---
type: multiple
timer: 30
difficulty: medium
tags: [server, primitives]
---

## Qui contrôle chaque primitive server ?

- [x] **Tools** sont contrôlés par le **modèle** (le LLM décide d'appeler)
- [x] **Resources** sont contrôlées par l'**application** (l'app sélectionne ce qu'elle envoie)
- [x] **Prompts** sont contrôlés par l'**utilisateur** (invocation explicite, type slash command)
- [ ] **Tools** sont contrôlés par l'utilisateur uniquement (jamais d'autonomie modèle)
- [ ] **Resources** sont contrôlées par le modèle qui décide quoi lire

> C'est **la** distinction philosophique de MCP : **3 primitives = 3 niveaux de contrôle**.
> **Tools = autonomie du modèle** (avec ou sans approval HITL). **Resources = sélection par
> l'application** (embedding search, sélection manuelle, attachement auto…). **Prompts =
> invocation 100 % utilisateur** (slash command explicite, pas auto). Cette séparation évite
> que le modèle puisse, par exemple, lire tout un filesystem sans contrôle de l'app.

---
type: single
timer: 25
difficulty: medium
tags: [server, resources]
---

## Resources directes vs templates de resources

- [ ] Resources directes = lecture seule, templates = écriture autorisée
- [ ] Templates = format JSON Schema, directes = JSON brut
- [x] Directes = URI **fixe** (`resources/list` + `resources/read`) ; templates = URI **paramétrée** (`resources/templates/list`)
- [ ] Aucune différence dans la spec — `templates` est un alias historique de `list`

> Les **resources directes** ont une **URI fixe** vers une donnée précise
> (`file:///home/me/notes.md`, `calendar://events/2026`) — découverte via `resources/list`,
> lecture via `resources/read`. Les **templates** ont une **URI paramétrée**
> (`weather://forecast/{city}/{date}`, `travel://flights/{origin}/{dest}`) — découverte via
> `resources/templates/list`, avec **complétion possible** côté client pour aider l'utilisateur
> ou le modèle à compléter les paramètres. Le **MIME type** est déclaré dans les deux cas.

---
type: single
timer: 30
difficulty: hard
tags: [server, notifications, capabilities]
---

## Quand un client reçoit-il `notifications/tools/list_changed` ?

- [ ] Toujours par défaut — c'est un comportement standard du JSON-RPC
- [ ] Uniquement en transport HTTP (stdio n'expose pas les notifications)
- [x] Seulement si le server a déclaré **`"listChanged": true`** au handshake — sinon polling manuel
- [ ] Uniquement si le client force la subscription via un header HTTP `X-MCP-Subscribe`

> Les notifications de type `list_changed` (tools, resources, prompts) sont **capability-based**
> : elles ne sont envoyées **que si le server a déclaré la sous-option `"listChanged": true`**
> à l'`initialize`. C'est cohérent avec la philosophie MCP : **« pas négocié = pas appelé »**.
> Si la capability n'est pas annoncée, le client doit faire du **polling manuel**
> (`tools/list` périodique). Ces notifications fonctionnent **identiquement en stdio et en
> HTTP** — c'est le data layer, agnostique du transport.

---
type: multiple
timer: 25
difficulty: medium
tags: [server, notifications]
---

## Notifications usuelles côté server

- [x] `notifications/tools/list_changed`
- [x] `notifications/resources/list_changed`
- [x] `notifications/resources/updated` (un fichier souscrit a changé)
- [x] `notifications/progress` (progression d'une opération longue)
- [ ] `notifications/heartbeat` (keep-alive émis toutes les 30 s)
- [ ] `notifications/tools/error_rate` (métrique d'erreur du server)

> Les notifications standard côté server permettent de **synchroniser en temps réel** sans
> polling : `tools/list_changed` et `resources/list_changed` quand le catalogue évolue,
> `resources/updated` quand un objet souscrit change (via `resources/subscribe`), `progress`
> pour les opérations longues. **Pas de `heartbeat` natif** (le transport gère la connexion)
> ni de `error_rate` (l'observabilité est gérée séparément via logs / Cloud Monitoring /
> Sentry).

---
type: single
timer: 20
difficulty: easy
tags: [client, primitives]
---

## À quoi servent les primitives **client** ?

- [ ] À envoyer des logs de debug à un service externe (Sentry / Datadog)
- [ ] Elles n'existent pas dans la spec stable — uniquement dans des drafts
- [x] À **inverser le flux** : le server initie, le client répond (sampling, elicitation, logs)
- [ ] Elles sont identiques aux primitives server, juste exposées de l'autre côté

> Les primitives **client** sont l'élégance cachée de MCP : elles **inversent le flux habituel**
> client → server. Avec elles, le **server peut demander au client** : un appel LLM
> (`sampling/createMessage`), une info utilisateur (`elicitation/create`), la liste des dossiers
> en scope (`roots/list`), ou pousser des logs structurés (`logging`). Cela permet aux servers
> de rester **model-independent** et **stateless en termes de credentials** — c'est le client
> (le host) qui détient le LLM et l'utilisateur.

---
type: multiple
timer: 30
difficulty: medium
tags: [client, primitives, sampling, elicitation, roots]
---

## Identifier la fonction de chaque primitive client

- [x] **`sampling/createMessage`** : le server demande au client de faire un appel LLM
- [x] **`elicitation/create`** : le server demande une info à l'utilisateur via le client
- [x] **`roots/list`** : le client annonce les dossiers (`file://`) en scope au server
- [x] **`logging`** : le server envoie ses logs structurés vers le client
- [ ] **`roots/list`** : définit les rôles d'authentification (auth roots) du provider OAuth
- [ ] **`sampling`** : permet au server de fine-tuner le modèle utilisé par le client

> Mapping correct : **Sampling** = le server délègue un appel LLM au client (le server reste
> model-independent, le client gère les clés / quotas / approval). **Elicitation** = le server
> ouvre un dialogue avec l'utilisateur via une UI imposée par le client. **Roots** =
> « coordination, pas sécurité » — le client annonce où il veut que le server regarde, le
> sandboxing OS reste indispensable. **Logging** = obs intégrée au protocole, niveau réglable
> via `logging/setLevel`.

---
type: single
timer: 30
difficulty: hard
tags: [client, elicitation, security]
---

## Règle de sécurité d'`elicitation` imposée par la spec

- [ ] Elicitation peut demander un password si la connexion est chiffrée TLS 1.3
- [ ] Elicitation est purement informative — le client n'a aucune validation à faire
- [ ] La règle ne s'applique qu'en transport remote (HTTP), pas en stdio local
- [x] **Elicitation ne demande JAMAIS un password ni une clé API** — le client doit refuser ou alerter

> Règle dure de la spec : **`elicitation` ne demande JAMAIS un password ni une clé API**, peu
> importe le transport ou le niveau de chiffrement. Le **client est tenu de refuser ou
> d'alerter** si un server tente cette dérive. Le rationnel : un server compromis pourrait se
> faire passer pour un dialogue légitime et hameçonner les credentials de l'utilisateur. **Les
> secrets se gèrent en amont** (Secret Manager côté host, OAuth flow côté transport), pas dans
> le canal de dialogue applicatif.

---
type: single
timer: 30
difficulty: hard
tags: [client, sampling, security, hitl]
---

## `sampling/createMessage` : deux propriétés à retenir

- [ ] Le server doit embarquer un SDK Anthropic et gérer les clés API lui-même
- [ ] Le sampling permet au server d'appeler le LLM **en silence**, sans validation utilisateur
- [x] Le server reste **model-independent** (pas de SDK LLM) + **checkpoint UI HITL** côté client obligatoire
- [ ] Sampling = échantillonnage de logs pour Cloud Monitoring (pas un appel LLM)

> `sampling/createMessage` permet au server de demander un appel LLM **via le client** — donc
> le server **ne contient ni SDK Anthropic/OpenAI ni clés API** : il reste **model-independent**.
> En contrepartie, le **client impose un checkpoint UI human-in-the-loop** (approval avant
> l'appel, et souvent aussi avant de renvoyer la réponse au server) — le **server ne peut
> jamais appeler un LLM en silence**. Même logique pour `elicitation` : la sécurité HITL est
> **intégrée au protocole**, pas un ajout optionnel.

---
type: single
timer: 22
difficulty: easy
tags: [extensions, auth, security]
---

## Auth selon le transport : que dit la spec ?

- [ ] OAuth 2.1 obligatoire même en stdio local (uniformité du flow)
- [ ] mTLS exclusivement, bearer tokens interdits par la spec
- [ ] Aucune auth supportée en remote — il faut placer un reverse proxy devant
- [x] **Stdio = pas d'auth** (OS suffit) ; **Streamable HTTP multi-tenant = auth obligatoire** (OAuth 2.1)

> Sur **stdio**, le contrôle d'accès est assuré par l'**OS** (le user qui lance le process) —
> pas besoin d'auth dans le protocole. Sur **Streamable HTTP multi-tenant**, l'**auth est
> obligatoire** dès qu'on sert plusieurs utilisateurs/hosts depuis le même server. La spec
> **recommande OAuth 2.1**, avec alternatives bearer tokens / API keys / headers custom. Le
> **flow OAuth se déroule côté host** : l'utilisateur autorise, le client reçoit un token
> court et le présente au server.

---
type: single
timer: 25
difficulty: medium
tags: [extensions]
---

## Statut des extensions MCP en 2026

- [ ] Toutes stables : Auth, Apps, Tasks — prêtes pour la prod multi-tenant
- [ ] Toutes expérimentales : aucune n'est encore stable
- [x] **Auth stable** · **Apps stable** (tooling jeune) · **Tasks expérimental** (à manier avec prudence)
- [ ] Apps a été retiré de la spec en 2026 ; seules Auth et Tasks subsistent

> Statut actuel des extensions : **Auth** = stable (OAuth 2.1 + bearer + API keys), **obligatoire**
> pour le multi-tenant remote. **Apps** = stable mais tooling encore jeune — interfaces UI
> embarquées dans la conversation, pratiques pour approval / formulaires / sélection visuelle.
> **Tasks** = **expérimental** : wrappers d'**exécution durable** pour les opérations longues
> (poll status, résultats différés, états `pending` / `running` / `done`) — utiles mais à
> manier avec prudence en prod 2026.

---
type: single
timer: 20
difficulty: easy
tags: [fastmcp]
---

## Qu'est-ce que FastMCP et quelle est sa diffusion ?

- [ ] Un SDK propriétaire écrit en Rust, ~10 % du marché
- [ ] Un fork TypeScript du SDK officiel, ~30 % du marché
- [x] Le **framework Python de référence** — **~70 %** des servers, **mergé dans le SDK Python officiel**
- [ ] Une bibliothèque Java/Spring pour les entreprises, < 5 % du marché

> **FastMCP** est le framework Python de référence : il propulse **~70 % des servers MCP en
> circulation**, avec ~1 M téléchargements par jour, et **FastMCP 1.0 a été mergé dans le SDK
> Python officiel** — donc ce qu'on apprend sur FastMCP s'applique aussi au SDK officiel. Il
> encapsule tout le protocole (JSON-RPC, lifecycle, capabilities, transport) derrière des
> décorateurs et offre **hosting**, **clients first-class** et **auth providers** prêts à
> l'emploi.

---
type: multiple
timer: 25
difficulty: medium
tags: [fastmcp, primitives]
---

## Décorateurs FastMCP et génération automatique des schémas

- [x] **`@mcp.tool`** déclare une fonction comme tool MCP exposé
- [x] **`@mcp.resource("uri://template/{param}")`** déclare une resource (URI directe ou template)
- [x] **`@mcp.prompt`** déclare un workflow réutilisable invocable par l'utilisateur
- [x] Le **schema JSON** est **généré depuis les type hints Python** (description = docstring)
- [ ] `@mcp.endpoint` — équivalent FastAPI pour exposer des routes REST côté MCP
- [ ] `@mcp.handler` — décorateur obligatoire à ajouter en plus de `@mcp.tool`

> FastMCP repose sur trois décorateurs (`@mcp.tool`, `@mcp.resource`, `@mcp.prompt`) qui mappent
> 1:1 sur les primitives server. Le **JSON Schema d'entrée est généré automatiquement à partir
> des type hints** (`def get_weather(city: str, units: str = "metric") -> dict`), la
> **description vient de la docstring**, et `mcp.run()` lance en **stdio par défaut**. Pas de
> `@mcp.endpoint` (FastMCP **encapsule** ASGI / FastAPI, ne le mimique pas) ni de
> `@mcp.handler`.

---
type: single
timer: 25
difficulty: medium
tags: [fastmcp, swe]
---

## Discipline SWE pour un server MCP en prod

- [ ] MCP fournit automatiquement les tests d'intégration — pas besoin d'en écrire
- [ ] Pas besoin de versioning, la négociation de capabilities suffit
- [ ] Le rate-limiting est interdit par la spec (le client doit accepter tout débit)
- [x] **Server MCP = service comme un autre** : tests, CI/CD, versioning, registry, obs, auth, rate-limiting

> Message anti-hype : **MCP n'exempte d'aucune des bonnes pratiques SWE**. Un server MCP en
> prod demande la **checklist classique** : tests unitaires + intégration (mock client MCP),
> CI/CD (lint, type-check, build, deploy), **versioning sémantique**, publication dans un
> **registry** pour découverte, **observability** (logs structurés, métriques, traces),
> **OAuth 2.1** côté remote multi-tenant, **rate-limiting** côté server. Outils utiles :
> **MCP Inspector** (debug interactif), **MCPman** (gestionnaire). « Capabilities » ne remplace
> pas « semver ».

---
type: single
timer: 20
difficulty: easy
tags: [ecosystem, swe]
---

## Portabilité d'un même server MCP entre frameworks AI

- [ ] Il faut un adaptateur propriétaire Anthropic pour les autres frameworks
- [ ] LangChain et LangGraph utilisent un protocole propriétaire incompatible avec MCP
- [ ] OpenAI ne supporte pas MCP — il faut un wrapper REST custom
- [x] **Un même server MCP** fonctionne sans modification avec Claude, LangChain, OpenAI Agents, Vercel, Pydantic AI…

> Slogan **« write once, plug anywhere »** : un même server MCP (FastMCP ou autre) fonctionne
> **sans modification** avec tous les grands frameworks AI 2026 — **Claude Code**, **LangChain
> / LangGraph** (`langchain-mcp-adapters`), **OpenAI Agents SDK** (`MCPServerStdio` /
> `MCPServerSse`), **CrewAI**, **AutoGen**, **Pydantic AI**, **LlamaIndex**, **Mastra**,
> **Vercel AI SDK**, **Strands** (AWS), **Semantic Kernel** (.NET). MCP n'est ni
> Anthropic-specific ni LangChain-specific.

---
type: multiple
timer: 25
difficulty: medium
tags: [ecosystem, langchain]
---

## Frameworks AI avec un client MCP intégré en 2026

- [x] **LangChain / LangGraph** via `langchain-mcp-adapters` (MultiServerMCPClient inclus)
- [x] **OpenAI Agents SDK** via `MCPServerStdio` / `MCPServerSse`
- [x] **Vercel AI SDK** via `experimental_createMCPClient`
- [x] **Pydantic AI** via `pydantic_ai.mcp` (intégration native)
- [ ] **jQuery** dispose d'un plugin officiel `jquery-mcp-adapter`
- [ ] **NumPy** intègre nativement un client MCP via `numpy.mcp`

> En 2026, l'adoption MCP côté client est **fulgurante** : LangChain/LangGraph, OpenAI Agents
> SDK, Vercel AI SDK, Pydantic AI, mais aussi CrewAI, AutoGen, LlamaIndex, Mastra, Strands AWS,
> Semantic Kernel .NET — tous parlent MCP. Le pattern central côté LangGraph est
> **`MultiServerMCPClient`** : un agent agrège plusieurs MCPs en un seul catalogue de tools,
> avec conversion auto en `BaseTool` LangChain et schémas Pydantic inférés. jQuery et NumPy
> n'ont **rien à voir** avec MCP (frameworks UI / scientifiques, pas AI agentique).

---
type: single
timer: 30
difficulty: hard
tags: [ecosystem, openapi]
---

## Limites pratiques des proxies OpenAPI → MCP

- [ ] Ils ne supportent que les verbes HTTP `GET`
- [ ] Ils sont limités à 50 endpoints par server par limitation de la spec
- [ ] Ils sont interdits par la spec MCP (seul FastMCP est officiellement supporté)
- [x] Descriptions OpenAPI **trop pauvres** pour le LLM, **auth/security à mapper**, **patterns non-CRUD** mal traduits

> Les générateurs et proxies OpenAPI → MCP (Higress, `openapi-mcp-generator`,
> `mcp-openapi-proxy`, Kong AI MCP Proxy…) sont une voie tentante pour exposer une API REST
> existante en MCP **sans coder**. **Mais en pratique** : (1) les descriptions OpenAPI sont
> souvent **trop minces** pour bien guider un LLM (un `summary` d'une ligne ne suffit pas),
> (2) les **security schemes** (OAuth, API keys avec scopes) doivent être **mappés à la main**
> sur le modèle d'auth MCP, (3) les **patterns non-CRUD** (streaming, long-polling, webhooks)
> se traduisent mal en tool calls synchrones. Bon pour démarrer, à compléter par du FastMCP.
