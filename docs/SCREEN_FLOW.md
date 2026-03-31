# Screen Flow

Host and player application screen flows driven by WebSocket events.

---

## Host App

**Tech:** Vue 3 SPA at `http://localhost:3031`

```
HostPhase: 'connecting' → 'lobby' → 'question' → 'revealed' → 'finished'
```

### Screen Transitions

| Phase | Trigger | View | Actions |
|-------|---------|------|---------|
| `connecting` | Initial load / WS close or error | "Connecting…" spinner | — |
| `lobby` | `host_connected` received | `LobbyView` | QR code, player list, Start button |
| `question` | `question_started` received | `QuestionView` | Timer ring, answer count, Next / Reveal |
| `revealed` | `answer_revealed` received | `RevealView` | Bar chart, score deltas, Next button |
| `finished` | `game_ended` received | `PodiumView` | Full leaderboard |

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
  │  QuestionView    │  Timer ring counts down
  │                  │  answer_submitted events show live count
  └──────┬───────────┘
         │ [Reveal] → sends host_reveal
         │ ◄── answer_revealed
         ▼
  ┌──────────────────┐
  │  RevealView      │  Correct answers highlighted
  │                  │  Bar chart + score delta per player
  └──────┬───────────┘
         │ [Next] → sends host_next
         │ ◄── question_started (loop) OR game_ended (last Q)
         ▼
  ┌──────────────────┐
  │  PodiumView      │  Final scores, top 3 medals
  └──────────────────┘
```

---

## Player App

**Tech:** Vue 3 SPA at `http://localhost:3032` (mobile-first)

```
PlayerPhase: 'join' → 'lobby' → 'question' → 'feedback' → 'podium'
```

### Screen Transitions

| Phase | Trigger | View | Actions |
|-------|---------|------|---------|
| `join` | Initial load | `JoinView` | Enter join code, pseudo, email |
| `lobby` | `player_joined` (own join confirmed) | `LobbyView` | Waiting room with player count |
| `question` | `question_started` received | `QuestionView` | 2×2 answer grid + timer ring |
| `feedback` | `answer_revealed` received | `FeedbackView` | Correct/wrong + points + rank |
| `podium` | `game_ended` received | `PodiumView` | Final rank + score |

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
  │  Timer ring: purple → orange → red   │
  │  Timer = 0 → auto-submit + disable   │
  └──────┬───────────────────────────────┘
         │ timer expires → submitAnswer([...selected], lastPressMs)
         │ ◄── answer_revealed
         ▼
  ┌──────────────────┐
  │  FeedbackView    │  ✓ Correct / ✗ Wrong overlay
  │                  │  Points earned + current rank
  └──────┬───────────┘
         │ ◄── question_started (loop) OR game_ended
         ▼
  ┌──────────────────┐
  │  PodiumView      │  Final rank + score
  └──────────────────┘
```

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

*Last updated: 2026-03-31*
