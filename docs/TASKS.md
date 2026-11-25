# Tasks

Project task backlog for QuizV.

---

## In Progress

*(None currently)*

### Persistence Postgres ou pur Realtime éphémère ?

1. Pur Realtime (éphémère)
Aucune table Postgres. Tout passe par les channels Realtime + presence. Si l'hôte recharge la page, la partie est perdue.
Setup minimal, parfait pour MVP.
**→ Option retenue pour le MVP actuel** (cf. [`DEPLOY.md`](DEPLOY.md)).

2. Tables minimales (rooms + games)
   Persiste : `rooms(code, host_id, created_at)`, `games(id, room_id, started_at, ended_at)`,
   `final_scores(game_id, player_name, score)`.
   Permet historique et leaderboards persistants. Pas de reconnexion mid-game.
3. Tables complètes (avec reconnexion)
   Toutes les tables : rooms, games, players, questions_state, answers. Permet reconnexion mid-game (joueur ou hôte).
   Plus de travail, RLS plus complexe.

Y a t'il un pb de divulgation des réponses au autres (WS) ?


- Quizz asynchrone (date de fin, un a plusieurs joueurs)

---

## Backlog

- [ ] Série en cours (streak) : calculer dans `@quizv/core` le nombre de bonnes réponses consécutives par joueur,
      l'envoyer dans `answer_revealed` et l'afficher sur l'écran verdict joueur
- [ ] Dépassements au classement : envoyer le rang précédent et le nouveau rang de chaque joueur
      (`answer_revealed` ou nouvel événement), puis ajouter un écran classement animé entre deux questions côté animateur
      (qui passe devant qui) et l'écart avec le joueur devant côté répondant
- [ ] Aprés le podium, nouvelle page métrics avec un encart de métrics Global :
  - nb total bonne réponse
  - pourcentage bonne réponse
  - temps moyen réponse
  - bonne réponse le plus rapide (head shoot avec pseudo et position)
  - total temps de réponse le plus long (escargot, avec pseudo et position)
- [ ] Ajouter dans la page métrics, des métrics par personne : nb bonne réponse,
      pourcentage bonne réponse, temps moyen réponse, temps le plus rapide
- [ ] génération résultat et métrics en fichier json téléchargeable
- [ ] Revoir l'index avec une grille de card (même design que le reste, et card proche type QuizInfoPanel)
      des différents quizz, avec titre, description, tags, max-questions et target-difficulty.
- [ ] l'affichage des choix sort en markdown brut et n'est pas formaté avec gras et autres...
- [ ] Maximum de longueurs des choix / réponses à mettre dans la skills (éviter le débordement sur mobile surtout).
- [ ] Dans l'écran des réponses, mets les lettres des bonnes réponses en vert
- [ ] Passe la liste des réponses (bonne ou mauvaise) au dessus de chaque barre de progression (total réponses)
      en gardant en vert les bonnes et enlève les de l'encart avec l'explication
- [ ] Sur la base des corrections précédentes. Améliore le cli check : 4 réponses maximum,
      check là où la bonne réponse saute aux yeux (formatage asymétrique)

### Phase 3 — Cloud / Supabase

| # | Task | Description |
|---|------|-------------|
| 1 | Supabase schema | Only if persistence is needed: migrations for `quizzes`, `game_sessions`, `game_players`, `game_answers` |
| ~~2~~ | ~~`@quizv/transport-supabase`~~ | ✅ Done: `IRealtimeTransport` on Supabase Realtime Broadcast + presence |
| 3 | Host auth | Magic link login via Supabase Auth |
| 4 | Quiz persistence | Save/load quizzes tied to host account |
| 5 | `quizv upload` CLI | Upload a `.quizv.md` file to Supabase |
| ~~6~~ | ~~Vercel deployment~~ | ✅ Done: `vercel.json` + env vars, see [`DEPLOY.md`](DEPLOY.md) |
| 7 | Cloud E2E test | Full game flow via Supabase transport |

### Phase 4 — Slidev Addon

| # | Task | Description |
|---|------|-------------|
| 8 | `slidev-addon-quizv` scaffold | Package setup, register Vue component |
| 9 | `<QuizvEmbed>` component | QR code + live answer overlay on slide |
| 10 | Presenter controls | Host controls in Slidev presenter notes panel |
| 11 | Answer animation | Player answers animate as overlay on slide |

### Improvements

| # | Task | Description |
|---|------|-------------|
| 12 | Hot reload | Reload quiz without restarting server on `.quizv.md` change |
| 13 | Question types | Add `type: multiple` explicit support + display hint |
| 14 | Leaderboard between questions | Show top 5 snapshot between question and next question |
| 15 | Timer sync | Broadcast `timer_tick` events for host/player sync |
| 16 | Confetti | Confetti animation on player podium for top 3 |
| 17 | Theming | Add `@quizv/theme-dark` and `@quizv/theme-minimal` variants |

---

## Completed

- [x] Agrandir le qr code
- [x] version sur mobile agencer les questions les une en dessous des autres (laisser tels quels sur  desktop)
- [x] vérifier le randomize les propositions a, b, c, d → si quizz fait plusieurs fois ca tourne
- [x] La réponse ne doit pas sauter au yeux visuelement (la seul avec parenthèse, gras, italique...)
  et doit être au même niveau que les autres
- [x] lors de l'affichage l'Explication de la correction en markdown brut et pas formaté avec gras et autres...
- [x] lors de l'appuie sur join Game d'un participant, il y a un message d'erreur qui dit
  no code found for this code
- [x] Dans l'affichage de la réponse Pour les listes de plusieurs réponses (multi select)
  les affifcher avec un retour à la ligne entre chaque

### Phase 2 — Vue Apps

- [x] `@quizv/theme-default` — CSS tokens (`--qv-*`)
- [x] `@quizv/ui` — `TimerRing`, `AnswerButton`, `AnswerBarChart`, `PlayerList`, `Podium`, `QrCode`
- [x] `apps/host` — Lobby, Question, Reveal, Podium views
- [x] `apps/player` — Join, Lobby, Question, Feedback, Podium views
- [x] Multi-select answers with auto-submit at timer expiry
- [x] `quizv dev` spawns Vite host (3031) + player (3032) apps
- [x] `choiceCounts` in `answer_revealed` for host bar chart
- [x] `playerUrl` in `host_connected` for QR code
- [x] Socket identity guard (prevents stale WS close resetting phase)
- [x] Fix: `TimerRing` `aria-label` binding (`:aria-label` dynamic binding)
- [x] Fix: `AnswerButton` multi-select (selected state remains interactive)
- [x] Fix: RevealView score delta zero shown as muted instead of green

### Phase 1 — Core Engine

- [x] Initialize monorepo (`quizv/` with Bun workspaces)
- [x] `@quizv/parser` — `parseQuizFile()` + `validateQuiz()` + 13 tests
- [x] `@quizv/core` — `GameEngine`, `GameEvent`, `IRealtimeTransport`, scoring + 14 tests
- [x] `@quizv/transport-local` — `LocalTransport` (Bun WS pub/sub)
- [x] `@quizv/server` — Bun HTTP+WS server + `quizv dev | check` CLI
- [x] `examples/demo.quizv.md` — sample quiz

---

*Last updated: 2026-03-31*
