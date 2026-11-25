# Screen Flow

Host and player application screen flows driven by WebSocket events.

---

## Host App

**Tech:** Vue 3 SPA at `http://localhost:3031`

```
HostPhase: 'connecting' → 'lobby' → 'question' → 'revealed' → 'finished' (→ 'lobby' via Rejouer)
```

### Screen Transitions

| Phase | Trigger | View | Actions |
|-------|---------|------|---------|
| `connecting` | Initial load / WS close or error | "Connecting…" spinner | — |
| `lobby` | `host_connected` or `game_reset` received | `LobbyView` | QR code, player constellation (`FxLobby`), player list, Start button |
| `question` | `question_started` received | `QuestionView` | Countdown (`FxCountdown`), answer count, Reveal |
| `revealed` | `answer_revealed` received | `RevealView` | Vote particles (`FxReveal`), score deltas, Next button |
| `finished` | `game_ended` received | `PodiumView` | Animated podium (`FxPodium`), full leaderboard, **🔁 Rejouer** button (sends `host_reset`) |

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
| `join` | Initial load | `JoinView` | Enter join code, pseudo, email |
| `lobby` | `player_joined` (own join confirmed), or `game_reset` from the podium | `LobbyView` | Waiting room with player count and constellation (`FxLobby`) |
| `question` | `question_started` received | `QuestionView` | Answer grid + countdown; once `answer_revealed` arrives, the verdict, points and rank appear in the same view |
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

After each reveal the store computes the player's rank with `rankOf(scores, playerId)` from `@quizv/core`
(returns `{ rank, total }` or `null`) and exposes it as `rank` / `playerTotal`. The question view shows it as
`3e / 12`.

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

*Last updated: 2026-11-25*
