import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { QuestionPublic, Score, PodiumEntry, QuizInfo, StateSnapshot } from '@quizv/core'
import type { GameEvent } from '@quizv/core'
import { SupabaseTransport } from '@quizv/transport-supabase'
import { GameEvents, rankOf } from '@quizv/core'
import type { IRealtimeTransport, PlayerState } from '@quizv/core'

export type PlayerPhase = 'join' | 'lobby' | 'question' | 'podium'
export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline'

interface JoinedMsg { type: 'joined'; player: { id: string }; quizMeta: QuizInfo; playerCount: number }
interface StateSnapshotMsg { type: 'state_snapshot'; playerId: string; snapshot: StateSnapshot }
type ServerMsg = GameEvent | JoinedMsg | StateSnapshotMsg

const HOST_PRESENCE_ID = '__host__'
const SESSION_KEY = 'quizv:player-session'

interface PersistedSession {
  playerId: string
  code: string
  pseudo: string
  email: string
}

interface DraftAnswer {
  questionIdx: number
  choiceIds: string[]
  elapsed: number
}

function loadSession(code: string): PersistedSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as PersistedSession
    return s.code === code ? s : null
  } catch { return null }
}

function saveSession(s: PersistedSession): void {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)) } catch { /* ignore quota */ }
}

function loadDraft(): DraftAnswer | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY + ':draft')
    return raw ? JSON.parse(raw) as DraftAnswer : null
  } catch { return null }
}

function saveDraft(d: DraftAnswer): void {
  try { sessionStorage.setItem(SESSION_KEY + ':draft', JSON.stringify(d)) } catch { /* ignore */ }
}

function clearDraft(): void {
  try { sessionStorage.removeItem(SESSION_KEY + ':draft') } catch { /* ignore */ }
}

function newPlayerId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export const useGameStore = defineStore('game', () => {
  const phase        = ref<PlayerPhase>('join')
  const playerId     = ref(newPlayerId())
  const playerCount  = ref(0)
  const question     = ref<QuestionPublic | null>(null)
  const questionIdx  = ref(0)
  const answered     = ref(false)
  const answerTimeMs = ref(0)
  const totalScore   = ref(0)
  const lastDelta    = ref(0)
  const rank         = ref<number | null>(null)
  const playerTotal  = ref(0)
  const correctIds   = ref<string[]>([])
  const explanation  = ref<string | undefined>(undefined)
  const podium       = ref<PodiumEntry[]>([])
  const connectError = ref('')
  const quizMeta     = ref<QuizInfo | null>(null)
  const deadlineMs   = ref<number | null>(null)
  const status       = ref<ConnectionStatus>('connecting')

  const canStillAnswer = computed(() =>
    !answered.value && deadlineMs.value !== null && Date.now() < deadlineMs.value
  )

  let ws: WebSocket | null = null
  let transport: IRealtimeTransport | null = null
  let channelName = ''
  let joinCode = ''
  let pseudoCached = ''
  let emailCached = ''
  let mode: 'local' | 'supabase' = 'local'
  let reconnectAttempts = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let lifecycleAttached = false

  function attachLifecycleListeners() {
    if (lifecycleAttached || typeof document === 'undefined') return
    lifecycleAttached = true
    const onVisible = () => {
      if (document.visibilityState === 'visible') ensureConnected()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', ensureConnected)
    window.addEventListener('online', ensureConnected)
    window.addEventListener('pagehide', onPageHide)
  }

  function onPageHide() {
    // Best-effort cleanup: in Supabase mode, untrack so the host sees us leave faster.
    if (mode === 'supabase' && transport && channelName) {
      void transport.presence.untrack(channelName)
    }
  }

  function ensureConnected() {
    if (phase.value === 'join' || !joinCode) return
    if (mode === 'local') {
      if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        scheduleReconnect(0)
      } else if (ws.readyState === WebSocket.OPEN) {
        // Socket looks alive — ask for a fresh snapshot to resync UI.
        ws.send(JSON.stringify({ type: 'state_request' }))
      }
    } else if (mode === 'supabase' && transport && channelName) {
      // Re-track presence + request a fresh snapshot from the host.
      const me: PlayerState = {
        id: playerId.value, pseudo: pseudoCached, email: emailCached,
        score: totalScore.value, joinedAt: Date.now(),
      }
      void transport.presence.track(channelName, me)
      void transport.broadcast(channelName, GameEvents.stateRequest(playerId.value))
      status.value = 'connected'
    }
  }

  function scheduleReconnect(delayOverride?: number) {
    if (reconnectTimer) return
    const delay = delayOverride !== undefined
      ? delayOverride
      : Math.min(10_000, 1_000 * Math.pow(2, reconnectAttempts))
    status.value = reconnectAttempts === 0 ? 'reconnecting' : 'reconnecting'
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      reconnectAttempts++
      openLocalSocket(/* isRejoin */ true)
    }, delay)
  }

  async function connectSupabase(code: string, pseudo: string, email: string) {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
    if (!url || !anonKey) {
      connectError.value = 'Missing Supabase credentials'
      return
    }
    mode = 'supabase'
    transport = new SupabaseTransport({ url, anonKey })
    channelName = `game:${code}`
    joinCode = code
    pseudoCached = pseudo
    emailCached = email

    transport.subscribe(channelName, handle as (e: GameEvent) => void)
    attachLifecycleListeners()

    // Let presence sync briefly, then dedupe pseudo against real players (ignoring the host entry)
    await new Promise(r => setTimeout(r, 300))
    const existing = transport.presence.list(channelName)
      .filter(p => p.id !== HOST_PRESENCE_ID && p.id !== playerId.value)
      .map(p => p.pseudo)
    let final = pseudo
    let n = 2
    while (existing.includes(final)) { final = `${pseudo}-${n++}` }
    pseudoCached = final

    const me: PlayerState = {
      id: playerId.value,
      pseudo: final,
      email,
      score: totalScore.value,
      joinedAt: Date.now(),
    }
    await transport.presence.track(channelName, me)

    // Confirm the game exists by checking the host presence entry — not by counting players.
    setTimeout(() => {
      const list = transport!.presence.list(channelName)
      const hostPresent = list.some(p => p.id === HOST_PRESENCE_ID)
      if (!hostPresent) {
        connectError.value = 'No game found for this code'
        status.value = 'offline'
      } else {
        if (phase.value === 'join') phase.value = 'lobby'
        status.value = 'connected'
        saveSession({ playerId: playerId.value, code: joinCode, pseudo: pseudoCached, email: emailCached })
        // Request a snapshot in case the game is already in progress.
        void transport!.broadcast(channelName, GameEvents.stateRequest(playerId.value))
      }
    }, 3000)
  }

  function submitAnswerSupabase(choiceIds: string[], timeRemaining: number) {
    if (!transport) return
    void transport.broadcast(channelName,
      GameEvents.answerSubmit(playerId.value, choiceIds, timeRemaining))
  }

  function openLocalSocket(isRejoin: boolean) {
    status.value = isRejoin ? 'reconnecting' : 'connecting'
    const wsUrl = `ws://${location.hostname}:3030/ws?role=player&id=${playerId.value}&code=${encodeURIComponent(joinCode)}`
    const socket = new WebSocket(wsUrl)
    ws = socket
    socket.onerror = () => {
      if (!isRejoin) {
        connectError.value = 'Connection failed — check the join code and try again'
      }
    }
    socket.onopen = () => {
      reconnectAttempts = 0
      const type = isRejoin ? 'player_rejoin' : 'player_join'
      socket.send(JSON.stringify({ type, pseudo: pseudoCached, email: emailCached }))
      status.value = 'connected'
      // Resend any unsent draft answer if we're still in the question phase and the deadline holds.
      const draft = loadDraft()
      if (draft && draft.questionIdx === questionIdx.value && canStillAnswer.value) {
        socket.send(JSON.stringify({ type: 'submit_answer', choiceIds: draft.choiceIds, answerTimeMs: draft.elapsed }))
        answered.value = true
        answerTimeMs.value = draft.elapsed
        clearDraft()
      }
    }
    socket.onmessage = (e: MessageEvent<string>) => {
      handle(JSON.parse(e.data) as ServerMsg)
    }
    socket.onclose = () => {
      if (ws !== socket) return
      status.value = 'reconnecting'
      // Reconnect only if the user actually joined a game (not a failed first attempt).
      if (phase.value !== 'join') scheduleReconnect()
    }
  }

  function connect(code: string, pseudo: string, email: string) {
    connectError.value = ''
    joinCode = code
    pseudoCached = pseudo
    emailCached = email

    // If a persisted session exists for this code, reuse the playerId so the server treats us as a rejoin.
    const persisted = loadSession(code)
    if (persisted) {
      playerId.value = persisted.playerId
      if (!pseudo) pseudoCached = persisted.pseudo
      if (!email)  emailCached  = persisted.email
    }

    if (import.meta.env.VITE_TRANSPORT === 'supabase') {
      void connectSupabase(code, pseudoCached, emailCached)
      return
    }
    mode = 'local'
    attachLifecycleListeners()
    openLocalSocket(persisted !== null)
  }

  function applySnapshot(snap: StateSnapshot) {
    quizMeta.value = snap.quizMeta
    totalScore.value = snap.totalScore
    playerCount.value = snap.playerCount
    if (snap.phase === 'finished') {
      podium.value = snap.podium ?? []
      phase.value = 'podium'
      deadlineMs.value = null
      return
    }
    if (snap.phase === 'lobby') {
      phase.value = 'lobby'
      question.value = null
      deadlineMs.value = null
      return
    }
    // 'question' or 'revealed' — render the question with appropriate reveal state
    if (snap.question) {
      question.value = snap.question
      questionIdx.value = snap.questionIdx ?? snap.question.idx
    }
    if (snap.phase === 'revealed' && snap.reveal) {
      correctIds.value = snap.reveal.correct
      explanation.value = snap.reveal.explanation
      const me = snap.reveal.scores.find(s => s.playerId === playerId.value)
      if (me) { lastDelta.value = me.delta; totalScore.value = me.score }
      const r = rankOf(snap.reveal.scores, playerId.value)
      rank.value = r?.rank ?? null
      playerTotal.value = r?.total ?? 0
      answered.value = true   // round is over for everyone
      deadlineMs.value = null
      phase.value = 'question'    // QuestionView renders reveal feedback inline
    } else {
      correctIds.value = []
      explanation.value = undefined
      deadlineMs.value = snap.deadlineMs ?? null
      // If we previously answered this question during this session, preserve that;
      // otherwise allow the user to answer until the deadline.
      const draft = loadDraft()
      if (!(draft && draft.questionIdx === questionIdx.value)) {
        // No draft for this question — UI is back to fresh state unless server says we already answered.
        if (answered.value && (deadlineMs.value && Date.now() >= deadlineMs.value)) {
          // Past deadline, leave answered as-is
        } else {
          answered.value = false
          answerTimeMs.value = 0
        }
      }
      phase.value = 'question'
    }
  }

  function handle(msg: ServerMsg) {
    if (msg.type === 'joined') {
      phase.value = 'lobby'
      quizMeta.value = msg.quizMeta
      playerCount.value = msg.playerCount
      status.value = 'connected'
      saveSession({ playerId: playerId.value, code: joinCode, pseudo: pseudoCached, email: emailCached })
      return
    }
    if (msg.type === 'state_snapshot') {
      if (msg.playerId && msg.playerId !== playerId.value) return
      applySnapshot(msg.snapshot)
      status.value = 'connected'
      saveSession({ playerId: playerId.value, code: joinCode, pseudo: pseudoCached, email: emailCached })
      return
    }
    switch (msg.type) {
      case 'player_joined':
        if (msg.player.id !== playerId.value) playerCount.value++
        break
      case 'player_rejoined':
        // No count change — silent
        break
      case 'player_left':
        if (msg.playerId !== playerId.value) {
          playerCount.value = Math.max(0, playerCount.value - 1)
        }
        break
      case 'question_started':
        question.value     = msg.question
        questionIdx.value  = msg.idx
        answered.value     = false
        answerTimeMs.value = 0
        rank.value         = null
        playerTotal.value  = 0
        correctIds.value   = []
        explanation.value  = undefined
        deadlineMs.value   = msg.deadlineMs
        phase.value        = 'question'
        clearDraft()
        break
      case 'answer_revealed': {
        const me = msg.scores.find((s: Score) => s.playerId === playerId.value)
        if (me) {
          lastDelta.value  = me.delta
          totalScore.value = me.score
        }
        const r = rankOf(msg.scores, playerId.value)
        rank.value = r?.rank ?? null
        playerTotal.value = r?.total ?? 0
        correctIds.value = msg.correct
        explanation.value = msg.explanation
        answered.value = true
        deadlineMs.value = null
        clearDraft()
        // stay in 'question' phase — feedback shown inline
        break
      }
      case 'game_ended':
        podium.value = msg.podium
        phase.value  = 'podium'
        // Keep the persisted session: the host may "Rejouer" in the same room, and a player
        // who reloads on the podium must auto-rejoin with the same playerId.
        clearDraft()
        break
      case 'game_reset':
        // Host chose "Rejouer": same room, same identity/connection, fresh game state.
        question.value     = null
        questionIdx.value  = 0
        answered.value     = false
        answerTimeMs.value = 0
        totalScore.value   = 0
        lastDelta.value    = 0
        rank.value         = null
        playerTotal.value  = 0
        correctIds.value   = []
        explanation.value  = undefined
        podium.value       = []
        deadlineMs.value   = null
        phase.value        = 'lobby'
        clearDraft()
        break
    }
  }

  function submitAnswer(choiceIds: string[], elapsed: number) {
    if (answered.value) return
    if (deadlineMs.value !== null && Date.now() >= deadlineMs.value) return
    answered.value     = true
    answerTimeMs.value = elapsed
    saveDraft({ questionIdx: questionIdx.value, choiceIds, elapsed })
    if (mode === 'supabase') {
      submitAnswerSupabase(choiceIds, elapsed)
      return
    }
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'submit_answer', choiceIds, answerTimeMs: elapsed }))
      clearDraft()
    }
    // If the socket is down, the draft will be resent on reconnect (see openLocalSocket).
  }

  return {
    phase, playerId, playerCount, question, questionIdx,
    answered, answerTimeMs, totalScore, lastDelta, rank, playerTotal, correctIds, explanation, podium, connectError,
    quizMeta, deadlineMs, status, canStillAnswer,
    connect, submitAnswer, submitAnswerSupabase,
  }
})
