import { parseQuizFile, validateQuiz } from '@quizv/parser'
import type { Quiz } from '@quizv/parser'
import { GameEngine } from '@quizv/core'
import type { PlayerState, QuizInfo } from '@quizv/core'
import { LocalTransport } from '@quizv/backend-local'
import {
  createSoloHttpHandler,
  DEFAULT_SOLO_DB,
  SOLO_WS_ROLE,
  SoloPresenceHub,
  SoloStore,
  soloTopic,
  type SoloConn,
  type SoloServerMsg,
} from '@quizv/backend-local/solo-server'
import { parseManifest, SoloDeckSource } from '@quizv/core/solo-decks'
import { readFileSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { resolve } from 'node:path'
import type { Server, ServerWebSocket } from 'bun'
import { collectDecks } from './web-assets'

/** Get the first non-loopback IPv4 address (for QR code URL) */
function getLocalIP(): string {
  const nets = networkInterfaces()
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address
      }
    }
  }
  return 'localhost'
}

/** Solo hub connection over a Bun socket: drops messages once the socket is no longer open. */
function soloConn(ws: ServerWebSocket<unknown>, deckId: string, key: string): SoloConn {
  return {
    deckId,
    key,
    send(data) {
      if (ws.readyState === WebSocket.OPEN) ws.send(data)
    },
  }
}

/** Generate a random 6-char alphanumeric join code */
function generateJoinCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export interface QuizvServerOptions {
  port?: number
  quizFile: string
  /** Grace period in ms before a disconnected player is removed. Defaults to QUIZV_GRACE_MS env var or 60000. */
  graceMs?: number
  /** Decks folder of the local solo service (`/solo/*`, `role=solo` sockets); solo is off without it. */
  decksDir?: string
  /** SQLite file of the local solo leaderboard. Defaults to `.hashquiz/solo.db` in the working directory. */
  soloDbPath?: string
}

/** Longest accepted `deck` / `key` query value of a solo socket. */
const SOLO_PARAM_MAX = 200

type WsData =
  | { role: typeof SOLO_WS_ROLE; deckId: string; key: string; conn?: SoloConn }
  | { role: string; playerId: string }

const isSolo = (d: WsData): d is Extract<WsData, { deckId: string }> => d.role === SOLO_WS_ROLE

interface SoloService {
  http: (req: Request) => Promise<Response | null>
  hub: SoloPresenceHub
  store: SoloStore
}

const DEFAULT_GRACE_MS = 60_000
function resolveGraceMs(opt?: number): number {
  if (typeof opt === 'number' && Number.isFinite(opt) && opt >= 0) return opt
  const raw = process.env['QUIZV_GRACE_MS']
  if (raw) {
    const n = Number(raw)
    if (Number.isFinite(n) && n >= 0) return n
  }
  return DEFAULT_GRACE_MS
}

export function buildQuizInfo(quiz: Quiz): QuizInfo {
  const { title, description, tags, maxQuestions, targetDifficulty } = quiz.meta
  const all = quiz.questions
  const totalN = maxQuestions !== undefined
    ? Math.min(maxQuestions, all.length)
    : all.length

  let dist: { easy: number; medium: number; hard: number }

  if (!targetDifficulty) {
    // Raw distribution from all questions
    const counts = { easy: 0, medium: 0, hard: 0 }
    for (const q of all) counts[q.difficulty]++
    const total = all.length || 1
    const easyPct   = Math.round(counts.easy   / total * 100)
    const mediumPct = Math.round(counts.medium / total * 100)
    dist = {
      easy:   easyPct,
      medium: mediumPct,
      hard:   100 - easyPct - mediumPct,
    }
  } else {
    // Theoretical distribution: 60/40 split + guardrail
    const RANK: Record<'easy' | 'medium' | 'hard', number> = { easy: 0, medium: 1, hard: 2 }
    const targetRank = RANK[targetDifficulty]

    // Guardrail: 1 hard question per unique tag that has at least 1 hard question
    const uniqueTagsWithHard = new Set(
      all.filter(q => q.difficulty === 'hard').flatMap(q => q.tags)
    )
    const guardrailN = Math.min(uniqueTagsWithHard.size, totalN)

    const slots       = Math.max(0, totalN - guardrailN)
    const targetSlots = Math.round(slots * 0.6)
    const belowSlots  = slots - targetSlots

    // For "below target" slots: distribute proportionally among below-target difficulties
    const belowPool = all.filter(q => RANK[q.difficulty] < targetRank)
    const belowTotal = belowPool.length || 1
    const belowCounts: Record<string, number> = { easy: 0, medium: 0, hard: 0 }
    for (const q of belowPool) belowCounts[q.difficulty]++

    const easyBelow   = Math.round(belowCounts['easy']   / belowTotal * belowSlots)
    const mediumBelow = belowSlots - easyBelow

    const hardN   = guardrailN + (targetDifficulty === 'hard'   ? targetSlots : 0)
    const mediumN = (targetDifficulty === 'medium' ? targetSlots : 0)
                  + (targetDifficulty === 'hard'   ? mediumBelow : 0)
    const easyN   = (targetDifficulty === 'easy'   ? targetSlots + belowSlots : 0)
                  + (targetDifficulty === 'medium'  ? easyBelow  : 0)
                  + (targetDifficulty === 'hard'    ? easyBelow  : 0)

    const total = (hardN + mediumN + easyN) || 1
    const easyPct   = Math.round(easyN   / total * 100)
    const mediumPct = Math.round(mediumN / total * 100)
    dist = {
      easy:   easyPct,
      medium: mediumPct,
      hard:   100 - easyPct - mediumPct,
    }
  }

  return { title, description, tags, totalQuestions: totalN, targetDifficulty, difficultyDistribution: dist }
}

/**
 * QuizvServer manages one game session.
 * - Serves a minimal HTML host control page at /
 * - Serves a minimal HTML player join page at /play
 * - Exposes WebSocket at /ws for real-time game events
 *
 * In Phase 1, the HTML pages are minimal stubs. Full Vue apps are served in Phase 2.
 */
export class QuizvServer {
  private engine: GameEngine
  private transport: LocalTransport
  private joinCode: string
  private port: number
  private quizFile: string
  private quizMeta: QuizInfo
  private graceMs: number
  private graceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()
  private server: Server<WsData> | null = null
  private solo: SoloService | null = null

  constructor(options: QuizvServerOptions) {
    this.port = options.port ?? 3030
    this.quizFile = options.quizFile
    this.joinCode = generateJoinCode()
    this.transport = new LocalTransport()
    this.graceMs = resolveGraceMs(options.graceMs)

    const content = readFileSync(options.quizFile, 'utf-8')
    const quiz = parseQuizFile(content)
    const result = validateQuiz(quiz)
    if (!result.valid) {
      console.error('Quiz validation failed:')
      for (const err of result.errors) {
        const loc = err.questionIndex !== undefined ? ` Q${err.questionIndex + 1}` : ''
        console.error(`  [${err.field}]${loc}: ${err.message}`)
      }
      process.exit(1)
    }

    this.engine = new GameEngine(quiz, this.transport, this.joinCode)
    this.quizMeta = buildQuizInfo(quiz)

    if (options.decksDir) this.solo = this._createSolo(options.decksDir, options.soloDbPath)
  }

  /** Local solo service: decks read from disk (no TTL, a version mismatch reloads), runs in SQLite. */
  private _createSolo(decksDir: string, dbPath?: string): SoloService {
    const decks = new SoloDeckSource(async () => parseManifest(collectDecks(decksDir)), { ttlMs: Infinity })
    const store = SoloStore.open(dbPath ?? resolve(DEFAULT_SOLO_DB))
    const publish = (topic: string, msg: SoloServerMsg) => { this.server?.publish(topic, JSON.stringify(msg)) }
    return { http: createSoloHttpHandler({ decks, store, publish }), hub: new SoloPresenceHub(publish), store }
  }

  /** Stops listening and closes the solo store. */
  stop(): void {
    this.server?.stop(true)
    this.server = null
    for (const t of this.graceTimers.values()) clearTimeout(t)
    this.graceTimers.clear()
    this.solo?.store.close()
    this.solo = null
  }

  start(): void {
    const self = this
    const server = Bun.serve<WsData>({
      port: this.port,
      async fetch(req, server) {
        const url = new URL(req.url)

        // WebSocket upgrade
        if (req.headers.get('upgrade') === 'websocket') {
          const role = url.searchParams.get('role') ?? 'player'
          if (role === SOLO_WS_ROLE) {
            // Solo sockets need no join code: they only see one deck's presence and new runs.
            if (!self.solo) return new Response('Solo is not enabled', { status: 404 })
            const deckId = url.searchParams.get('deck')
            const key = url.searchParams.get('key') ?? crypto.randomUUID()
            const sane = (v: string | null): v is string => !!v && v.length <= SOLO_PARAM_MAX
            if (!sane(deckId) || !sane(key)) return new Response('Invalid deck or key', { status: 400 })
            const data: WsData = { role, deckId, key }
            if (server.upgrade(req, { data })) return undefined
            return new Response('WebSocket upgrade failed', { status: 400 })
          }
          const playerId = url.searchParams.get('id') ?? crypto.randomUUID()
          // Players must provide the correct join code
          if (role === 'player' && url.searchParams.get('code') !== self.joinCode) {
            return new Response('Invalid join code', { status: 403 })
          }
          const upgraded = server.upgrade(req, { data: { role, playerId } })
          if (upgraded) return undefined
          return new Response('WebSocket upgrade failed', { status: 400 })
        }

        if (self.solo) {
          const res = await self.solo.http(req)
          if (res) return res
        }

        // Player join page
        if (url.pathname === '/play' || url.pathname === '/play/') {
          return new Response(self._playerHTML(), {
            headers: { 'Content-Type': 'text/html' },
          })
        }

        // Host control page (default)
        return new Response(self._hostHTML(), {
          headers: { 'Content-Type': 'text/html' },
        })
      },
      websocket: {
        open(ws) {
          const data = ws.data
          if (isSolo(data)) {
            if (!self.solo) return
            ws.subscribe(soloTopic(data.deckId))
            data.conn = soloConn(ws, data.deckId, data.key)
            self.solo.hub.open(data.conn)
            return
          }
          const { role, playerId } = data
          ws.subscribe(`game:${self.joinCode}`)
          if (role === 'host') {
            const localIP = getLocalIP()
            ws.send(JSON.stringify({
              type: 'host_connected',
              joinCode: self.joinCode,
              totalQuestions: self.quizMeta.totalQuestions,
              // Port 3032 = dedicated player Vite dev server (apps/player) — see Phase 2 plan
              playerUrl: `http://${localIP}:3032?code=${self.joinCode}`,
              quizMeta: self.quizMeta,
            }))
          } else if (role === 'player') {
            // A new socket replaces any pending disconnect for this playerId.
            self._cancelGraceTimer(playerId)
          }
        },
        message(ws, raw) {
          const data = ws.data
          if (isSolo(data)) {
            if (data.conn) self.solo?.hub.message(data.conn, String(raw))
            return
          }
          try {
            const msg = JSON.parse(String(raw)) as {
              type: string
              pseudo?: string
              email?: string
              choiceIds?: string[]
              answerTimeMs?: number
            }

            const { playerId } = ws.data as { playerId: string }

            if (msg.type === 'player_join' || msg.type === 'player_rejoin') {
              self._cancelGraceTimer(playerId)
              const existing = self.engine.state.players.get(playerId)
              const player: PlayerState = existing ?? {
                id: playerId,
                pseudo: msg.pseudo ?? 'Anonymous',
                email: msg.email ?? '',
                score: 0,
                joinedAt: Date.now(),
              }
              if (existing) {
                // Update mutable fields on rejoin if the client provided them
                if (msg.pseudo) existing.pseudo = msg.pseudo
                if (msg.email)  existing.email  = msg.email
                delete existing.disconnectedAt
              }
              const isRejoin = self.engine.addPlayer(player)
              if (isRejoin) {
                ws.send(JSON.stringify({
                  type: 'state_snapshot',
                  playerId,
                  snapshot: self.engine.buildSnapshot(playerId, self.quizMeta),
                }))
              } else {
                ws.send(JSON.stringify({
                  type: 'joined',
                  player,
                  quizMeta: self.quizMeta,
                  playerCount: self.engine.state.players.size,
                }))
              }
            }

            if (msg.type === 'state_request') {
              ws.send(JSON.stringify({
                type: 'state_snapshot',
                playerId,
                snapshot: self.engine.buildSnapshot(playerId, self.quizMeta),
              }))
            }

            if (msg.type === 'submit_answer') {
              self.engine.submitAnswer(
                playerId,
                msg.choiceIds ?? [],
                msg.answerTimeMs ?? 0
              )
            }

            const { role } = ws.data as { role: string }

            if (role === 'host' && msg.type === 'host_start') {
              void self.engine.start()
            }

            if (role === 'host' && msg.type === 'host_reveal') {
              void self.engine.revealAnswer()
            }

            if (role === 'host' && msg.type === 'host_next') {
              void self.engine.nextQuestion()
            }

            if (role === 'host' && msg.type === 'host_reset') {
              void self.engine.reset()
            }
          } catch {
            // ignore malformed messages
          }
        },
        close(ws) {
          const data = ws.data
          if (isSolo(data)) {
            if (data.conn) self.solo?.hub.close(data.conn)
            return
          }
          const { role, playerId } = data
          if (role === 'host') return
          if (!self.engine.state.players.has(playerId)) return
          self.engine.markPlayerDisconnected(playerId)
          if (self.graceMs === 0) {
            self.engine.removePlayer(playerId)
            return
          }
          self._cancelGraceTimer(playerId)
          const t = setTimeout(() => {
            self.graceTimers.delete(playerId)
            // Only remove if still disconnected (no rejoin happened in the meantime)
            const p = self.engine.state.players.get(playerId)
            if (p?.disconnectedAt) self.engine.removePlayer(playerId)
          }, self.graceMs)
          self.graceTimers.set(playerId, t)
        },
      },
    })

    this.server = server
    // Attach server to transport for WS broadcast
    this.transport.attachServer(server)

    const localIP = getLocalIP()
    const playerURL = `http://${localIP}:${this.port}/play`

    console.log(`
  QuizV Dev Server
  ─────────────────────────────────────────
  Host:    http://localhost:${this.port}
  Players: ${playerURL}
  Join code: ${this.joinCode}
  ─────────────────────────────────────────
  Share the URL or join code with players.
  Press Ctrl+C to stop.
`)
  }

  /** Cancel any pending removal-on-grace-expiry timer for this player. */
  private _cancelGraceTimer(playerId: string): void {
    const t = this.graceTimers.get(playerId)
    if (t) {
      clearTimeout(t)
      this.graceTimers.delete(playerId)
    }
  }

  private _hostHTML(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>QuizV Host — ${this.joinCode}</title>
  <style>
    body { font-family: system-ui; background: #0a0a0f; color: #fff; padding: 2rem; }
    button { background: #7c3aed; color: #fff; border: none; padding: 0.75rem 1.5rem;
             border-radius: 8px; cursor: pointer; font-size: 1rem; margin: 0.5rem; }
    button:hover { background: #6d28d9; }
    button:disabled { background: #333; cursor: not-allowed; opacity: 0.5; }
    #status { background: #111118; border-radius: 8px; padding: 1rem; margin: 1rem 0; }
    #question-box { background: #111118; border-radius: 8px; padding: 1rem; margin: 1rem 0; display: none; }
    #question-box h2 { margin: 0 0 0.5rem; font-size: 1.2rem; color: #7c3aed; }
    #question-box p { margin: 0.25rem 0; }
    #log { background: #0d0d14; border-radius: 8px; padding: 1rem; font-family: monospace;
           font-size: 0.85rem; height: 200px; overflow-y: auto; margin-top: 1rem; }
    #ws-status { font-size: 0.85rem; color: #888; margin-bottom: 0.5rem; }
  </style>
</head>
<body>
  <h1>QuizV Host Control</h1>
  <p id="ws-status">Connecting...</p>
  <div id="status">
    <p>Join code: <strong>${this.joinCode}</strong></p>
    <p>Players: <span id="playerCount">0</span> &nbsp;|&nbsp; State: <span id="game-state">lobby</span></p>
  </div>
  <div id="question-box">
    <h2>Question <span id="q-idx">1</span> / <span id="q-total">${this.engine.state.totalQuestions}</span> &nbsp;⏱ <span id="q-timer" style="color:#7c3aed">—</span>s</h2>
    <p id="q-text"></p>
    <p>Answers received: <span id="answer-count">0</span></p>
  </div>
  <div>
    <button id="btn-start" onclick="send('host_start')">▶ Start Game</button>
    <button id="btn-reveal" onclick="send('host_reveal')" disabled>🔍 Reveal Answer</button>
    <button id="btn-next" onclick="send('host_next')" disabled>⏭ Next Question</button>
    <button id="btn-reset" onclick="send('host_reset')" disabled>🔁 Rejouer</button>
  </div>
  <div id="log"></div>
  <script>
    const ws = new WebSocket('ws://localhost:${this.port}/ws?role=host')
    let playerCount = 0, answerCount = 0, hostTimerInterval

    function send(type) {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type }))
    }
    function log(msg) {
      const el = document.getElementById('log')
      const div = document.createElement('div')
      div.textContent = new Date().toISOString().slice(11,19) + ' ' + JSON.stringify(msg)
      el.appendChild(div)
      el.scrollTop = el.scrollHeight
    }
    function setButtons(state) {
      document.getElementById('btn-start').disabled = state !== 'lobby'
      document.getElementById('btn-reveal').disabled = state !== 'question'
      document.getElementById('btn-next').disabled = state !== 'revealed'
      document.getElementById('btn-reset').disabled = state !== 'finished'
    }

    ws.onopen = () => {
      document.getElementById('ws-status').textContent = 'Connected'
      document.getElementById('ws-status').style.color = '#22c55e'
    }
    ws.onerror = () => {
      document.getElementById('ws-status').textContent = 'Connection error'
      document.getElementById('ws-status').style.color = '#ef4444'
    }
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'player_joined') { playerCount++; document.getElementById('playerCount').textContent = playerCount }
      if (data.type === 'player_left') { playerCount = Math.max(0, playerCount - 1); document.getElementById('playerCount').textContent = playerCount }
      if (data.type === 'question_started') {
        answerCount = 0
        document.getElementById('game-state').textContent = 'question ' + (data.idx + 1)
        document.getElementById('q-idx').textContent = data.idx + 1
        const qText = data.question.text.replace(/^#+ /, '')
        document.getElementById('q-text').textContent = qText
        document.getElementById('answer-count').textContent = '0'
        document.getElementById('question-box').style.display = 'block'
        setButtons('question')
        // Host timer countdown — mirrors player timer
        clearInterval(hostTimerInterval)
        let remaining = data.question.timer
        document.getElementById('q-timer').textContent = remaining
        hostTimerInterval = setInterval(() => {
          remaining = Math.max(0, remaining - 1)
          document.getElementById('q-timer').textContent = remaining
          if (remaining === 0) clearInterval(hostTimerInterval)
        }, 1000)
      }
      if (data.type === 'answer_submitted') {
        answerCount++
        document.getElementById('answer-count').textContent = answerCount
      }
      if (data.type === 'answer_revealed') {
        clearInterval(hostTimerInterval)
        document.getElementById('q-timer').textContent = '—'
        document.getElementById('game-state').textContent = 'revealed'
        setButtons('revealed')
      }
      if (data.type === 'game_ended') {
        document.getElementById('game-state').textContent = 'finished'
        document.getElementById('question-box').style.display = 'none'
        setButtons('finished')
      }
      if (data.type === 'game_reset') {
        clearInterval(hostTimerInterval)
        document.getElementById('game-state').textContent = 'lobby'
        document.getElementById('question-box').style.display = 'none'
        setButtons('lobby')
      }
      log(data)
    }
  </script>
</body>
</html>`
  }

  private _playerHTML(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>QuizV Player</title>
  <style>
    body { font-family: system-ui; background: #0a0a0f; color: #fff; padding: 1rem;
           max-width: 480px; margin: 0 auto; }
    input { width: 100%; padding: 0.75rem; background: #111118; border: 1px solid #333;
            border-radius: 8px; color: #fff; font-size: 1rem; box-sizing: border-box;
            margin: 0.5rem 0; }
    button { width: 100%; background: #7c3aed; color: #fff; border: none; padding: 0.75rem;
             border-radius: 8px; cursor: pointer; font-size: 1rem; margin: 0.5rem 0; }
    .answer-btn { background: #1e1b4b; transition: background 0.2s; }
    .answer-btn:hover { background: #312e81; }
    #screen { display: none; }
    #join-screen { display: block; }
  </style>
</head>
<body>
  <div id="join-screen">
    <h1>Join QuizV</h1>
    <input id="code" placeholder="Join code (e.g. ABC123)" style="text-transform:uppercase;letter-spacing:0.15em" />
    <input id="pseudo" placeholder="Your name" />
    <input id="email" type="email" placeholder="Email (optional)" />
    <button onclick="join()">Join Game</button>
    <p id="join-error" style="color:#ef4444;display:none"></p>
  </div>
  <div id="screen">
    <p id="score-bar" style="display:none;text-align:right;font-size:0.9rem;color:#888;margin:0 0 0.5rem">Score: <strong id="total-score">0</strong> pts</p>
    <div id="lobby" style="display:none">
      <h2>Waiting for host to start...</h2>
      <p>Players: <span id="playerCount">0</span></p>
    </div>
    <div id="question-screen" style="display:none">
      <p id="timer" style="font-size:2rem;text-align:center;margin:0">20</p>
      <p id="answer-time" style="font-size:0.85rem;text-align:center;color:#888;min-height:1.2em;margin:0.1rem 0 0.5rem"></p>
      <h2 id="question-text"></h2>
      <div id="choices"></div>
    </div>
    <div id="feedback" style="display:none;text-align:center">
      <p id="feedback-text" style="font-size:3rem"></p>
      <p id="points-text"></p>
    </div>
    <div id="podium" style="display:none">
      <h1>Game Over!</h1>
      <div id="podium-list"></div>
    </div>
  </div>
  <script>
    let ws, playerId = Math.random().toString(36).slice(2) + Date.now().toString(36), timerInterval, playerCount = 0, totalScore = null

    function show(id) {
      ['lobby','question-screen','feedback','podium'].forEach(s => {
        document.getElementById(s).style.display = s === id ? 'block' : 'none'
      })
    }

    function join() {
      const code = document.getElementById('code').value.trim().toUpperCase()
      const pseudo = document.getElementById('pseudo').value.trim()
      const email = document.getElementById('email').value.trim()
      const errEl = document.getElementById('join-error')
      if (!code) { errEl.textContent = 'Enter the join code'; errEl.style.display = 'block'; return }
      if (!pseudo) { errEl.textContent = 'Enter your name'; errEl.style.display = 'block'; return }
      errEl.style.display = 'none'
      ws = new WebSocket('ws://' + location.host + '/ws?role=player&id=' + playerId + '&code=' + encodeURIComponent(code))
      ws.onerror = () => {
        errEl.textContent = 'Connection failed — check the join code'
        errEl.style.display = 'block'
      }
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'player_join', pseudo, email }))
      }
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data)
        if (data.type === 'joined') {
          document.getElementById('join-screen').style.display = 'none'
          document.getElementById('screen').style.display = 'block'
          show('lobby')
        }
        if (data.type === 'player_joined') {
          playerCount++
          document.getElementById('playerCount').textContent = playerCount
        }
        if (data.type === 'question_started') {
          show('question-screen')
          document.getElementById('question-text').textContent = data.question.text.replace(/^#+ /, '')
          const container = document.getElementById('choices')
          container.innerHTML = ''
          let answered = false
          data.question.choices.forEach(c => {
            const btn = document.createElement('button')
            btn.className = 'answer-btn'
            btn.textContent = c.id.toUpperCase() + '. ' + c.text
            btn.dataset.id = c.id
            btn.onclick = () => {
              if (answered) return
              answered = true
              const timerEl = document.getElementById('timer')
              const rem = parseInt(timerEl.textContent.replace(/[^0-9]/g, ''))
              const elapsed = (data.question.timer - rem) * 1000
              ws.send(JSON.stringify({ type: 'submit_answer', choiceIds: [c.id], answerTimeMs: elapsed }))
              document.querySelectorAll('.answer-btn').forEach(b => b.disabled = true)
              // Show time taken, then countdown in parens
              const taken = Math.round(elapsed / 1000)
              timerEl.dataset.answered = '1'
              timerEl.dataset.taken = taken
              timerEl.dataset.total = data.question.timer
              document.getElementById('answer-time').textContent = 'Répondu en ' + taken + 's / ' + data.question.timer + 's'
            }
            container.appendChild(btn)
          })
          let remaining = data.question.timer
          const timerEl = document.getElementById('timer')
          timerEl.textContent = remaining
          timerEl.dataset.answered = ''
          document.getElementById('answer-time').textContent = ''
          clearInterval(timerInterval)
          timerInterval = setInterval(() => {
            remaining = Math.max(0, remaining - 1)
            timerEl.textContent = remaining
            if (remaining === 0) clearInterval(timerInterval)
          }, 1000)
        }
        if (data.type === 'answer_revealed') {
          clearInterval(timerInterval)
          show('feedback')
          const myScore = data.scores.find(s => s.playerId === playerId)
          if (myScore) {
            totalScore = myScore.score
            document.getElementById('total-score').textContent = totalScore
            document.getElementById('score-bar').style.display = 'block'
          }
          document.getElementById('feedback-text').textContent = myScore?.delta > 0 ? '✓' : '✗'
          document.getElementById('points-text').textContent =
            myScore ? '+' + myScore.delta + ' pts (total\u00a0: ' + myScore.score + ')' : ''
        }
        if (data.type === 'game_ended') {
          clearInterval(timerInterval)
          show('podium')
          const list = document.getElementById('podium-list')
          list.innerHTML = ''
          data.podium.forEach(p => {
            const el = document.createElement('p')
            el.textContent = '#' + p.rank + ' ' + p.pseudo + ' \u2014 ' + p.score + ' pts'
            list.appendChild(el)
          })
        }
        if (data.type === 'game_reset') {
          clearInterval(timerInterval)
          totalScore = 0
          document.getElementById('total-score').textContent = '0'
          show('lobby')
        }
      }
    }
  </script>
</body>
</html>`
  }
}
