# Screen Flow

Host and player application screen flows driven by WebSocket events.

---

## Host App

**Tech:** Vue 3 SPA at `http://localhost:3031`

```
HostPhase: 'connecting' → 'lobby' → 'question' → 'revealed' → 'finished' (→ 'lobby' via Rejouer, → 'deck-select' via Menu)
```

### Screen Transitions

| Phase | Trigger | View | Actions |
|-------|---------|------|---------|
| `deck-select` | Initial load without a server, or **🏠 Menu** on the podium | `DeckSelectView` | Grid of quiz cards (`QuizInfoPanel`) and a tag list; a card starts the deck. Tag pages live on the URL hash (`#/tag/<tag>`): same page design, cards filtered to the tag, back link to the list. Backdrop fixed, HashQuiz logo centered |
| `connecting` | Initial load / WS close or error | "Connecting…" spinner | — |
| `lobby` | `host_connected` or `game_reset` received | `LobbyView` | One centered column that scrolls over two screens: the quiz card, vertically centered (first screen), then join link + join code, QR code, player count and Start button. Grey HashQuiz logo fixed top left. Several constellations (`FxLobby`, 12 players max each) fill the left and right side areas, with the `PlayerList` name lists at the bottom of each side |
| `question` | `question_started` received | `QuestionView` | Countdown (`FxCountdown`), answer count, Reveal |
| `revealed` | `answer_revealed` received | `RevealView` | Vote particles (`FxReveal`), score deltas, Next button |
| `finished` | `game_ended` received | `PodiumView` | Animated podium (`FxPodium`), full leaderboard, **🔁 Rejouer** button (sends `host_reset`) and, without a local server (Supabase mode), **🏠 Menu** beside it: leaves the room (players keep their podium) and goes back to `DeckSelectView` |

### Fullscreen

Every host view fits `100vw × 100vh` with no page scroll (landscape, 1080p and above). A **Fullscreen** button
(`apps/host/src/components/FullscreenButton.vue`) sits in the top-right corner of every phase and calls
`requestFullscreen()` on the document; it disappears while the page is fullscreen and comes back on exit. It is
hidden when the browser does not support the Fullscreen API.

### Host Flow Diagram

```
[Open http://localhost:3031]
        │
        ▼
  ┌─────────────┐
  │ Connecting… │  ◄── WS close/error resets here
  └──────┬──────┘
         │ host_connected
         ▼
  ┌─────────────┐
  │  LobbyView  │  Shows QR code, join code, live player list
  │             │  Players join: player_joined events update list
  └──────┬──────┘
         │ [Start Game] → sends host_start
         │ ◄── question_started
         ▼
  ┌──────────────────┐
  │  QuestionView    │  Countdown ring counts down
  │                  │  answer_submitted events show live count
  └──────┬───────────┘
         │ [Reveal] → sends host_reveal
         │ ◄── answer_revealed
         ▼
  ┌──────────────────┐
  │  RevealView      │  Correct answers highlighted
  │                  │  Vote particles + score delta per player
  └──────┬───────────┘
         │ [Next] → sends host_next
         │ ◄── question_started (loop) OR game_ended (last Q)
         ▼
  ┌──────────────────┐
  │  PodiumView      │  Final scores, top 3 medals
  └──────┬───────────┘
         │ [🔁 Rejouer] → sends host_reset
         │ ◄── game_reset: same room/code, same players, scores 0
         ▼
     LobbyView (Start Game runs a fresh game)

     PodiumView ── [🏠 Menu] (Supabase mode) → leaves the room → DeckSelectView
```

---

## Player App

**Tech:** Vue 3 SPA at `http://localhost:3032` (mobile-first)

```
PlayerPhase: 'join' → 'lobby' → 'question' → 'podium' (→ 'lobby' on game_reset)
```

### Screen Transitions

| Phase | Trigger | View | Actions |
|-------|---------|------|---------|
| `join` | Initial load | `JoinView` | Enter join code, pseudo, email. Below the form, when solo is available (local transport, or Supabase credentials set), « Ou jouez en solo » lists the solo decks of the runtime `decks.json` (`SoloCatalog`, lazy-loaded chunk; hidden while loading, on error or without solo decks); each card links to `#/solo/<deckId>` |
| `lobby` | `player_joined` (own join confirmed), or `game_reset` from the podium | `LobbyView` | Grey HashQuiz logo top left, quiz card (same look as the host lobby, compact on phones), dot hourglass (`FxHourglass`) with "Waiting for the host…", and the room constellation (`FxLobby`) |
| `question` | `question_started` received | `QuestionView` | Answer grid + countdown; once `answer_revealed` arrives, a result block replaces the countdown at the top (verdict constellation, total score, rank, points gained, speed); no tinted background, the shared `FxBackdrop` dust stays |
| `podium` | `game_ended` received | `PodiumView` | Final rank + score, animated podium (`FxPodium`) |

### Player Flow Diagram

```
[Open http://localhost:3032?code=XXXXXX]
        │
        ▼
  ┌─────────────┐
  │  JoinView   │  Pre-filled join code (from ?code= query param)
  │             │  Enter pseudo + email → [Join]
  └──────┬──────┘
         │ sends player_join → WS upgrade with ?code=
         │ ◄── player_joined (own confirmation)
         ▼
  ┌─────────────┐
  │  LobbyView  │  "Waiting for host…" + player count
  └──────┬──────┘
         │ ◄── question_started
         ▼
  ┌──────────────────────────────────────┐
  │  QuestionView                        │
  │                                      │
  │  ┌──A──┐  ┌──B──┐                   │
  │  │     │  │     │  Toggle to select  │
  │  └─────┘  └─────┘                   │
  │  ┌──C──┐  ┌──D──┐                   │
  │  │     │  │     │  Multi-select OK   │
  │  └─────┘  └─────┘                   │
  │                                      │
  │  Countdown ring (FxCountdown)        │
  │  Timer = 0 → auto-submit + disable   │
  └──────┬───────────────────────────────┘
         │ timer expires → submitAnswer([...selected], lastPressMs)
         │ ◄── answer_revealed: correct answers highlighted, verdict
         │     (FxVerdict) + points + rank ("3e / 12") shown below
         │ ◄── question_started (loop) OR game_ended
         ▼
  ┌──────────────────┐
  │  PodiumView      │  Final rank + score
  └──────┬───────────┘
         │ ◄── game_reset (host pressed Rejouer): back to LobbyView,
         │     same identity, no code re-entry; session kept so a reload rejoins
         ▼
     LobbyView
```

### Rank

After each reveal the store computes the player's rank with `rankOf(scores, playerId)` from `@hashquiz/core`
(returns `{ rank, total }` or `null`) and exposes it as `rank` / `playerTotal`. The question view shows it as
`3e / 12`.

---

## Player App — Solo

**Tech:** same SPA, entered through the hash route `#/solo/<deckId>` (`deckId` URL-encoded, the manifest id shared
with the host: path relative to the decks folder),
from the solo list on the player home (`JoinView`) or the « Jouer en solo » link on host deck cards.
Solo runs on the backend of the runtime `transport`: the `hashquiz dev` server in local mode (SQLite,
port 3030), Supabase otherwise; no host, no join code. The hosted-room phases above are unchanged.

```
SoloPhase: 'loading' → 'unavailable' | 'intro' → 'question' → 'revealed' → ('question' …) → 'end' (→ 'question' via Rejouer, → player home via Menu)
```

### Screen Transitions

| Phase | Trigger | View | Actions |
|-------|---------|------|---------|
| `loading` | Hash `#/solo/<deckId>`, while the deck list (`/decks.json`) loads | `SoloIntroView` | « Chargement du quiz… » |
| `unavailable` | Unknown or non-solo deck id, deck list load error, or solo not available (Supabase transport without credentials); also when no question is served (e.g. a `max-time` budget no question fits) or the presence channel cannot open | `SoloIntroView` | Short "quiz not available" message |
| `intro` | Hash `#/solo/<deckId>` on a solo deck | `SoloIntroView` | Quiz card (with the **plays** count, the deck's finished runs), pseudo field (no email), **Commencer**, leaderboard (`SoloLeaderboard`: live players "en cours" + past runs) |
| `question` | Start, or **Suivant** | `SoloQuestionView` | Answer grid + countdown (the question `timer`); **Valider** makes the answer final when it is not a one-tap case |
| `revealed` | Final answer or timeout | `SoloQuestionView` | Correction (verdict, correct answers, explanation, points, running score, place among the players in progress: « 2e sur 3 joueurs en cours », by current score, ties shared), live players on this quiz, **Suivant** (no auto-advance) |
| `end` | Last correction passed | `SoloEndView` | Score, total time, rank, full leaderboard with own row highlighted, **Rejouer** (new run, new row) and **Menu** beside it (hash `#/`: back to the player home, `JoinView` + solo list), **Partager** (native share sheet with score, rank and the deck's solo link; otherwise copies them to the clipboard, « Lien copié ! »), HashQuiz interest form (`LeadForm`) |

### Solo Flow Diagram

```
[Open #/solo/<deckId>]
        │
        ▼
  ┌──────────────┐
  │ SoloIntro    │  Pseudo + [Commencer], leaderboard (live + past)
  └──────┬───────┘
         │ presence on solo:<deckId>
         ▼
  ┌──────────────┐
  │ question     │  Countdown from the question timer
  └──────┬───────┘
         │ answer or timeout
         ▼
  ┌──────────────┐
  │ revealed     │  Correction + points + live players; [Suivant]
  └──────┬───────┘
         │ [Suivant] → next question (loop) OR end
         ▼
  ┌──────────────┐
  │ SoloEnd      │  Run saved (local server, RPC or Edge Function), score, time, rank,
  │              │  leaderboard, [Rejouer] [Menu] [Partager], HashQuiz form
  └──────────────┘
         │ [Menu] → #/ → JoinView (solo list)
```

### Answer finality

- `single` + `one-shoot: true`: the tap is final.
- `multiple` + `one-shoot: true`: **Valider** is final.
- `one-shoot: false` (any type): choices stay editable until **Valider**; on timeout the last selection counts.

### Total time and persistence

Total time = sum of the answer times, each capped at the question timer (a timeout counts as the full timer);
correction time is excluded and is the leaderboard tie-break. Leaving mid-run abandons it: nothing is stored.
A run is written once, at the end. Pseudo only, no email on runs.

---

## Multi-Select Answer Logic

1. Player taps answer buttons to toggle selection (any number of choices)
2. Buttons remain interactive until timer reaches 0
3. Timer reaches 0:
   - All buttons disabled immediately
   - If anything selected → auto-submit `{ choiceIds: [...selected], answerTimeMs: lastPressElapsed }`
   - If nothing selected → no submit sent, "No answer submitted" shown
4. `lastPressElapsed` = time elapsed since question start when the last button was pressed (used for scoring)

---

*Last updated: 2026-11-27*
