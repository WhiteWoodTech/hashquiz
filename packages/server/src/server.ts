import { parseQuizFile, validateQuiz } from '@quizv/parser'
import { GameEngine } from '@quizv/core'
import type { PlayerState } from '@quizv/core'
import { LocalTransport } from '@quizv/transport-local'
import { readFileSync } from 'node:fs'
import { networkInterfaces } from 'node:os'

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

/** Generate a random 6-char alphanumeric join code */
function generateJoinCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export interface QuizvServerOptions {
  port?: number
  quizFile: string
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

  constructor(options: QuizvServerOptions) {
    this.port = options.port ?? 3030
    this.quizFile = options.quizFile
    this.joinCode = generateJoinCode()
    this.transport = new LocalTransport()

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
  }

  start(): void {
    const self = this
    const server = Bun.serve({
      port: this.port,
      fetch(req, server) {
        const url = new URL(req.url)

        // WebSocket upgrade
        if (req.headers.get('upgrade') === 'websocket') {
          const role = url.searchParams.get('role') ?? 'player'
          const playerId = url.searchParams.get('id') ?? crypto.randomUUID()
          const upgraded = server.upgrade(req, { data: { role, playerId } })
          if (upgraded) return undefined
          return new Response('WebSocket upgrade failed', { status: 400 })
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
          const { role } = ws.data as { role: string; playerId: string }
          ws.subscribe(`game:${self.joinCode}`)
          if (role === 'host') {
            ws.send(JSON.stringify({ type: 'host_connected', joinCode: self.joinCode }))
          }
        },
        message(ws, raw) {
          try {
            const msg = JSON.parse(String(raw)) as {
              type: string
              pseudo?: string
              email?: string
              choiceIds?: string[]
              answerTimeMs?: number
            }

            if (msg.type === 'player_join') {
              const player: PlayerState = {
                id: (ws.data as { playerId: string }).playerId,
                pseudo: msg.pseudo ?? 'Anonymous',
                email: msg.email ?? '',
                score: 0,
                joinedAt: Date.now(),
              }
              self.engine.addPlayer(player)
              ws.send(JSON.stringify({ type: 'joined', player }))
            }

            if (msg.type === 'submit_answer') {
              const { playerId } = ws.data as { playerId: string }
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
          } catch {
            // ignore malformed messages
          }
        },
        close(ws) {
          const { role, playerId } = ws.data as { role: string; playerId: string }
          if (role !== 'host') self.engine.removePlayer(playerId)
        },
      },
    })

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
    <h2>Question <span id="q-idx">1</span> / <span id="q-total">${this.engine.state.totalQuestions}</span></h2>
    <p id="q-text"></p>
    <p>Answers received: <span id="answer-count">0</span></p>
  </div>
  <div>
    <button id="btn-start" onclick="send('host_start')">▶ Start Game</button>
    <button id="btn-reveal" onclick="send('host_reveal')" disabled>🔍 Reveal Answer</button>
    <button id="btn-next" onclick="send('host_next')" disabled>⏭ Next Question</button>
  </div>
  <div id="log"></div>
  <script>
    const ws = new WebSocket('ws://localhost:${this.port}/ws?role=host')
    let playerCount = 0, answerCount = 0

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
      }
      if (data.type === 'answer_submitted') {
        answerCount++
        document.getElementById('answer-count').textContent = answerCount
      }
      if (data.type === 'answer_revealed') {
        document.getElementById('game-state').textContent = 'revealed'
        setButtons('revealed')
      }
      if (data.type === 'game_ended') {
        document.getElementById('game-state').textContent = 'finished'
        document.getElementById('question-box').style.display = 'none'
        setButtons('finished')
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
    <input id="pseudo" placeholder="Your name" />
    <input id="email" type="email" placeholder="Email (optional)" />
    <button onclick="join()">Join Game</button>
  </div>
  <div id="screen">
    <div id="lobby" style="display:none">
      <h2>Waiting for host to start...</h2>
      <p>Players: <span id="playerCount">0</span></p>
    </div>
    <div id="question-screen" style="display:none">
      <p id="timer" style="font-size:2rem;text-align:center">20</p>
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
    let ws, playerId = Math.random().toString(36).slice(2) + Date.now().toString(36), timerInterval, playerCount = 0

    function show(id) {
      ['lobby','question-screen','feedback','podium'].forEach(s => {
        document.getElementById(s).style.display = s === id ? 'block' : 'none'
      })
    }

    function join() {
      const pseudo = document.getElementById('pseudo').value.trim()
      const email = document.getElementById('email').value.trim()
      if (!pseudo) return alert('Enter your name')
      ws = new WebSocket('ws://' + location.host + '/ws?role=player&id=' + playerId)
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
          document.getElementById('question-text').textContent = data.question.text
          const container = document.getElementById('choices')
          container.innerHTML = ''
          data.question.choices.forEach(c => {
            const btn = document.createElement('button')
            btn.className = 'answer-btn'
            btn.textContent = c.id.toUpperCase() + '. ' + c.text
            btn.dataset.id = c.id
            btn.onclick = () => {
              clearInterval(timerInterval)
              const elapsed = (data.question.timer - parseInt(document.getElementById('timer').textContent)) * 1000
              ws.send(JSON.stringify({ type: 'submit_answer', choiceIds: [c.id], answerTimeMs: elapsed }))
              document.querySelectorAll('.answer-btn').forEach(b => b.disabled = true)
            }
            container.appendChild(btn)
          })
          let remaining = data.question.timer
          document.getElementById('timer').textContent = remaining
          clearInterval(timerInterval)
          timerInterval = setInterval(() => {
            remaining = Math.max(0, remaining - 1)
            document.getElementById('timer').textContent = remaining
            if (remaining === 0) clearInterval(timerInterval)
          }, 1000)
        }
        if (data.type === 'answer_revealed') {
          clearInterval(timerInterval)
          show('feedback')
          const myScore = data.scores.find(s => s.playerId === playerId)
          document.getElementById('feedback-text').textContent = myScore?.delta > 0 ? '✓' : '✗'
          document.getElementById('points-text').textContent =
            myScore ? '+' + myScore.delta + ' pts (total: ' + myScore.score + ')' : ''
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
      }
    }
  </script>
</body>
</html>`
  }
}
