# QuizV Phase 1B — Supabase Transport Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Replace `LocalTransport` (Bun WS pub/sub, LAN-only) with an optional `SupabaseTransport` so QuizV games can run over the internet — host and players on different networks.

**Why Supabase:** Supabase Realtime provides managed WebSocket pub/sub channels and presence tracking that maps 1-to-1 onto the `IRealtimeTransport` interface already defined in `@quizv/core`. No custom WebSocket server needed for cloud mode.

---

## Current State (what is already done)

### ✅ Done

| Item | Location | Status |
|---|---|---|
| `IRealtimeTransport` interface | `packages/core/src/transport.ts` | Complete |
| `LocalTransport` (Bun WS pub/sub) | `packages/transport-local/src/` | Complete, used in production |
| `@quizv/transport-supabase` package scaffold | `packages/transport-supabase/` | Stub only (`export {}`) |
| `GameEvent` union type | `packages/core/src/events.ts` | Complete (all events typed) |
| `GameEngine` accepts any `IRealtimeTransport` | `packages/core/src/game.ts` | Complete |
| `QuizvServer` wired to `LocalTransport` | `packages/server/src/server.ts` | Complete |
| Join code generation + WS role auth | `packages/server/src/server.ts` | Complete |

### ❌ Not done (this plan)

- `SupabaseTransport` implementation
- Supabase project setup + env config
- `quizv dev --supabase` flag to switch transport
- Cloud player URL (no LAN IP — use Supabase project URL instead)
- Supabase Auth for host identity (optional, Phase 3)

---

## Architecture Decisions (already settled)

### Transport interface contract

```typescript
// packages/core/src/transport.ts
export interface IRealtimeTransport {
  broadcast(channel: string, event: GameEvent): Promise<void>
  subscribe(channel: string, cb: (event: GameEvent) => void): Unsubscribe
  presence: {
    track(channel: string, state: PlayerState): Promise<void>
    untrack(channel: string): Promise<void>
    list(channel: string): PlayerState[]
    onChange(channel: string, cb: (players: PlayerState[]) => void): Unsubscribe
  }
}
```

`SupabaseTransport` must satisfy this interface exactly. No changes to `@quizv/core`.

### Channel naming

Both transports use `game:<joinCode>` as the channel name (e.g. `game:ABC123`). `SupabaseTransport` maps this to a Supabase Realtime channel of the same name.

### Message envelope

Supabase Realtime `broadcast` sends arbitrary JSON payloads. Wrap `GameEvent` as-is:

```typescript
// Sending
channel.send({ type: 'broadcast', event: 'game_event', payload: gameEvent })

// Receiving
channel.on('broadcast', { event: 'game_event' }, ({ payload }) => {
  cb(payload as GameEvent)
})
```

### Presence

Supabase Realtime presence maps directly onto `IRealtimeTransport.presence`:

- `track` → `channel.track(state)`
- `untrack` → `channel.untrack()`
- `list` → `channel.presenceState()` (flattened)
- `onChange` → `channel.on('presence', { event: 'sync' }, cb)`

### Transport selection

Selected via CLI flag at dev time. The `QuizvServer` constructor receives the transport instance — no internal switch needed.

```typescript
// packages/server/src/server.ts
constructor(options: QuizvServerOptions) {
  this.transport = options.transport ?? new LocalTransport()
}
```

### Player WS URL in cloud mode

In LAN mode: `playerUrl = http://<LAN_IP>:3032?code=<joinCode>`
In cloud mode: `playerUrl = https://<VITE_APP_PLAYER_URL>?code=<joinCode>` (env var set at build time)

The `host_connected` message already carries `playerUrl` — only the value changes.

---

## Environment Variables

```bash
# Required for SupabaseTransport
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...

# Required for cloud player URL in host_connected
VITE_PLAYER_URL=https://player.yourquizv.app   # or Vercel/Netlify preview URL
```

Store in `.env` at repo root (gitignored). Add `.env.example` with placeholder values.

---

## File Map

### Modified

```
packages/server/src/server.ts        # Accept transport option in constructor
packages/server/src/dev.ts           # --supabase flag → SupabaseTransport
packages/server/src/cli.ts           # --supabase flag parsing
```

### Created

```
packages/transport-supabase/
├── package.json                     # Add @supabase/supabase-js dep
└── src/
    └── index.ts                     # SupabaseTransport class

.env.example                         # SUPABASE_URL, SUPABASE_ANON_KEY, VITE_PLAYER_URL
```

---

## Task 1: Implement `SupabaseTransport`

**Files:**
- Modify: `packages/transport-supabase/package.json`
- Create: `packages/transport-supabase/src/index.ts`

### Step 1.1: Add `@supabase/supabase-js` to package.json

```json
{
  "name": "@quizv/transport-supabase",
  "version": "0.0.1",
  "type": "module",
  "main": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@quizv/core": "workspace:*",
    "@supabase/supabase-js": "^2.43.0"
  }
}
```

### Step 1.2: Implement `SupabaseTransport`

```typescript
// packages/transport-supabase/src/index.ts
import { createClient } from '@supabase/supabase-js'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { IRealtimeTransport, Unsubscribe } from '@quizv/core'
import type { GameEvent, PlayerState } from '@quizv/core'

export class SupabaseTransport implements IRealtimeTransport {
  private channels = new Map<string, RealtimeChannel>()
  private supabase

  constructor(url: string, anonKey: string) {
    this.supabase = createClient(url, anonKey)
  }

  private getOrCreate(channelName: string): RealtimeChannel {
    if (!this.channels.has(channelName)) {
      const ch = this.supabase.channel(channelName)
      ch.subscribe()
      this.channels.set(channelName, ch)
    }
    return this.channels.get(channelName)!
  }

  async broadcast(channel: string, event: GameEvent): Promise<void> {
    const ch = this.getOrCreate(channel)
    await ch.send({ type: 'broadcast', event: 'game_event', payload: event })
  }

  subscribe(channel: string, cb: (event: GameEvent) => void): Unsubscribe {
    const ch = this.getOrCreate(channel)
    const handler = ({ payload }: { payload: GameEvent }) => cb(payload)
    ch.on('broadcast', { event: 'game_event' }, handler)
    return () => ch.off('broadcast', handler)
  }

  presence = {
    track: async (channel: string, state: PlayerState): Promise<void> => {
      await this.getOrCreate(channel).track(state)
    },

    untrack: async (channel: string): Promise<void> => {
      await this.getOrCreate(channel).untrack()
    },

    list: (channel: string): PlayerState[] => {
      const ch = this.channels.get(channel)
      if (!ch) return []
      const raw = ch.presenceState<PlayerState>()
      return Object.values(raw).flat()
    },

    onChange: (channel: string, cb: (players: PlayerState[]) => void): Unsubscribe => {
      const ch = this.getOrCreate(channel)
      const handler = () => cb(this.presence.list(channel))
      ch.on('presence', { event: 'sync' }, handler)
      return () => ch.off('presence', handler)
    },
  }
}
```

### Step 1.3: Install deps

```bash
cd /path/to/quizv
bun install
```

### Step 1.4: Run tests

```bash
bun test
```

Expected: all existing tests pass (transport-supabase has no tests yet — see Task 2).

### Step 1.5: Commit

```bash
git add packages/transport-supabase/
git commit -m "✨ Implement SupabaseTransport (Phase 1B)"
```

---

## Task 2: Wire transport option into `QuizvServer`

**Files:**
- Modify: `packages/server/src/server.ts`
- Modify: `packages/server/src/dev.ts`
- Modify: `packages/server/src/cli.ts`

### Step 2.1: Add `transport` option to `QuizvServerOptions`

In `packages/server/src/server.ts`:

```typescript
import type { IRealtimeTransport } from '@quizv/core'
import { LocalTransport } from '@quizv/transport-local'

export interface QuizvServerOptions {
  port?: number
  quizFile: string
  transport?: IRealtimeTransport   // ← new, defaults to LocalTransport
}

export class QuizvServer {
  private transport: IRealtimeTransport

  constructor(options: QuizvServerOptions) {
    this.port = options.port ?? 3030
    this.quizFile = options.quizFile
    this.joinCode = generateJoinCode()
    this.transport = options.transport ?? new LocalTransport()  // ← changed
    this.engine = new GameEngine(this.transport, `game:${this.joinCode}`)
  }
```

### Step 2.2: Update `host_connected` `playerUrl` for cloud mode

In `start()`, resolve `playerUrl` from env when set:

```typescript
const localIP = getLocalIP()
const playerBase = process.env.VITE_PLAYER_URL ?? `http://${localIP}:3032`
ws.send(JSON.stringify({
  type: 'host_connected',
  joinCode: self.joinCode,
  totalQuestions: self.engine.state.totalQuestions,
  playerUrl: `${playerBase}?code=${self.joinCode}`,
}))
```

### Step 2.3: Add `--supabase` flag to `dev.ts`

```typescript
// packages/server/src/dev.ts
import { SupabaseTransport } from '@quizv/transport-supabase'

export function devCommand(quizFile: string, port?: number, useSupabase = false): void {
  const absPath = resolve(quizFile)

  let transport
  if (useSupabase) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_ANON_KEY
    if (!url || !key) {
      console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment')
      process.exit(1)
    }
    transport = new SupabaseTransport(url, key)
    console.log('  🌐 Using Supabase transport')
  }

  const server = new QuizvServer({ quizFile: absPath, port, transport })
  server.start()
  // ... rest unchanged
}
```

### Step 2.4: Parse `--supabase` in `cli.ts`

```typescript
const useSupabase = flags.includes('--supabase')
if (command === 'dev') {
  devCommand(arg, port, useSupabase)
}
```

### Step 2.5: Run tests

```bash
bun test
```

### Step 2.6: Commit

```bash
git add packages/server/src/server.ts packages/server/src/dev.ts packages/server/src/cli.ts
git commit -m "✨ QuizvServer accepts transport option, --supabase CLI flag"
```

---

## Task 3: Environment config + `.env.example`

### Step 3.1: Create `.env.example` at repo root

```bash
# Supabase project credentials (required for --supabase mode)
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Player app public URL for cloud QR code (optional, defaults to LAN IP)
VITE_PLAYER_URL=https://player.yourquizv.app
```

### Step 3.2: Ensure `.env` is gitignored

Add to `.gitignore` if not present:
```
.env
.env.local
```

### Step 3.3: Commit

```bash
git add .env.example .gitignore
git commit -m "📝 Add .env.example for Supabase config"
```

---

## Task 4: Supabase project setup (manual steps)

These are done once in the Supabase dashboard — not automated.

- [ ] Create a new Supabase project at https://supabase.com
- [ ] Copy `Project URL` and `anon public` key into `.env`
- [ ] Enable **Realtime** for the project (Dashboard → Realtime → Enable)
- [ ] No DB tables needed — Realtime Broadcast + Presence are clientside-only features, no schema required
- [ ] Set `VITE_PLAYER_URL` if deploying player app to Vercel/Netlify

---

## Task 5: Unit tests for `SupabaseTransport`

**Files:**
- Create: `packages/transport-supabase/tests/transport.test.ts`

Test strategy: mock `@supabase/supabase-js` `createClient` to intercept channel calls. Assert:
- `broadcast()` calls `ch.send()` with correct envelope
- `subscribe()` registers `on('broadcast', ...)` handler
- `presence.track()` calls `ch.track()`
- `presence.list()` flattens `presenceState()`

```typescript
// Minimal mock structure
const mockChannel = {
  send: mock(() => Promise.resolve()),
  subscribe: mock(() => mockChannel),
  on: mock(() => mockChannel),
  off: mock(() => mockChannel),
  track: mock(() => Promise.resolve()),
  untrack: mock(() => Promise.resolve()),
  presenceState: mock(() => ({})),
}
mock.module('@supabase/supabase-js', () => ({
  createClient: () => ({ channel: () => mockChannel }),
}))
```

---

## Usage after implementation

```bash
# LAN mode (current, unchanged)
bun run packages/server/src/cli.ts dev examples/demo.quizv.md

# Cloud mode (new)
cp .env.example .env
# fill SUPABASE_URL + SUPABASE_ANON_KEY + VITE_PLAYER_URL
bun run packages/server/src/cli.ts dev examples/demo.quizv.md --supabase
```

In cloud mode, the host QR code will point to `VITE_PLAYER_URL?code=XXXXXX` so players anywhere on the internet can join.

---

## Open questions / Phase 3 scope

| Question | Decision |
|---|---|
| Host authentication | Out of scope for Phase 1B — no auth, anyone knowing the WS URL can send `host_start`. Phase 3 concern. |
| Game persistence (resume after crash) | Out of scope — Phase 3. Use Supabase DB for state if needed. |
| Multiple simultaneous games | Architecture supports it (each game = separate channel `game:<code>`). Untested at scale. |
| Rate limiting | Supabase free tier: 200 concurrent connections, 500 messages/s. Sufficient for small groups. |
| CORS / RLS | Realtime Broadcast/Presence don't require RLS. No DB rows → no RLS rules needed. |
