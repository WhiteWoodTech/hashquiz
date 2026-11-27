import { config } from '../config'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PlayerState, QuestionPublic, Score, PodiumEntry, QuizInfo } from '@hashquiz/core'
import type { GameEvent, IRealtimeTransport } from '@hashquiz/core'
import { SupabaseHostSession } from '../session/supabase-session'
import { SupabaseTransport } from '@hashquiz/backend-supabase'
import { generateJoinCode } from '../session/join-code'
import type { BundledDeck } from '../decks'

export type HostPhase = 'deck-select' | 'connecting' | 'lobby' | 'question' | 'revealed' | 'finished'

// host_connected is a custom server-only message, not part of GameEvent union
interface HostConnectedMsg {
  type: 'host_connected'
  joinCode: string
  totalQuestions: number
  playerUrl: string
  quizMeta: QuizInfo
}

type ServerMsg =
  | GameEvent
  | HostConnectedMsg
  | { type: 'host_ready'; joinCode: string; totalQuestions: number; playerUrl: string; quizMeta: QuizInfo }

export type HostAction = 'host_start' | 'host_reveal' | 'host_next' | 'host_reset'

type TransportFactory = (opts: { url: string; anonKey: string }) => IRealtimeTransport
let makeTransport: TransportFactory = opts => new SupabaseTransport(opts)
/** Swaps the Supabase realtime transport (tests inject an in-memory one). */
export function setHostTransport(f: TransportFactory): void { makeTransport = f }

export const useGameStore = defineStore('game', () => {
  const phase        = ref<HostPhase>('connecting')
  const joinCode     = ref('')
  const playerUrl    = ref('')
  const totalQs      = ref(0)
  const players      = ref<PlayerState[]>([])
  const question     = ref<QuestionPublic | null>(null)
  const questionIdx  = ref(0)
  const answerCount  = ref(0)           // total submissions this round
  const correctIds   = ref<string[]>([])
  const choiceCounts = ref<Record<string, number>>({})
  const explanation  = ref<string | undefined>()
  const scores       = ref<Score[]>([])
  const podium       = ref<PodiumEntry[]>([])
  const quizMeta     = ref<QuizInfo | null>(null)

  let ws: WebSocket | null = null
  let session: SupabaseHostSession | null = null

  function startWithDeck(deck: BundledDeck) {
    const url = config.supabaseUrl
    const anonKey = config.supabaseAnonKey
    if (!url || !anonKey) {
      console.error('Missing Supabase credentials')
      phase.value = 'deck-select'
      return
    }
    session?.dispose()
    const transport = makeTransport({ url, anonKey })
    const code = generateJoinCode()
    session = new SupabaseHostSession({
      quiz: deck.quiz,
      transport,
      joinCode: code,
      origin: location.origin,
    })
    session.on(e => handle(e as ServerMsg))
    phase.value = 'lobby'
  }

  function sendSupabase(action: HostAction) {
    if (!session) return
    if (action === 'host_start')  void session.start()
    if (action === 'host_reveal') void session.reveal()
    if (action === 'host_next')   void session.next()
    if (action === 'host_reset')  void session.reset()
  }

  function connect() {
    const mode = config.transport
    if (mode === 'supabase') {
      phase.value = 'deck-select'
      return
    }
    // existing local-WS implementation continues below — unchanged
    ws?.close()   // prevent leaking previous socket on reconnect
    const url = `ws://localhost:3030/ws?role=host`
    const socket = new WebSocket(url)
    ws = socket
    socket.onmessage = (e: MessageEvent<string>) => {
      handle(JSON.parse(e.data) as ServerMsg)
    }
    // Use socket identity so stale close/error events from a replaced socket don't reset phase
    socket.onerror = () => { if (ws === socket) phase.value = 'connecting' }
    socket.onclose = () => { if (ws === socket) phase.value = 'connecting' }
  }

  function clearGame() {
    question.value     = null
    questionIdx.value  = 0
    answerCount.value  = 0
    correctIds.value   = []
    choiceCounts.value = {}
    explanation.value  = undefined
    scores.value       = []
    podium.value       = []
  }

  function handle(msg: ServerMsg) {
    if (msg.type === 'host_connected' || msg.type === 'host_ready') {
      joinCode.value  = msg.joinCode
      playerUrl.value = msg.playerUrl
      totalQs.value   = msg.totalQuestions
      phase.value     = 'lobby'
      quizMeta.value  = msg.quizMeta
      return
    }
    switch (msg.type) {
      case 'player_joined':
        // Guard against duplicates (e.g. presence re-sync replaying joins for known ids)
        if (!players.value.some(p => p.id === msg.player.id)) {
          players.value.push(msg.player)
        }
        break
      case 'player_rejoined':
      case 'state_request':
      case 'state_snapshot':
        // No UI effect on the host
        break
      case 'player_left':
        players.value = players.value.filter(p => p.id !== msg.playerId)
        break
      case 'question_started':
        question.value    = msg.question
        questionIdx.value = msg.idx
        answerCount.value = 0
        choiceCounts.value = {}
        correctIds.value  = []
        phase.value       = 'question'
        break
      case 'answer_submitted':
        answerCount.value++
        break
      case 'answer_revealed':
        correctIds.value   = msg.correct
        choiceCounts.value = msg.choiceCounts
        explanation.value  = msg.explanation
        scores.value       = msg.scores
        phase.value        = 'revealed'
        break
      case 'game_ended':
        podium.value = msg.podium
        phase.value  = 'finished'
        break
      case 'game_reset':
        // "Rejouer": same room, same players, fresh game state
        clearGame()
        players.value = players.value.map(p => ({ ...p, score: 0 }))
        phase.value   = 'lobby'
        break
    }
  }

  function send(type: HostAction) {
    if (config.transport === 'supabase') {
      sendSupabase(type)
      return
    }
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type }))
  }

  function disposeSession() {
    session?.dispose()
    session = null
  }

  /** The local server hosts a single deck: only the Supabase mode has a deck list to go back to. */
  const canGoToMenu = config.transport === 'supabase'

  /** "Menu": leaves the finished room (its players keep their podium) and goes back to the deck list. */
  function backToMenu() {
    if (!canGoToMenu || phase.value !== 'finished') return
    disposeSession()
    clearGame()
    players.value  = []
    joinCode.value = ''
    playerUrl.value = ''
    totalQs.value  = 0
    quizMeta.value = null
    phase.value    = 'deck-select'
  }

  return {
    phase, joinCode, playerUrl, totalQs, players,
    question, questionIdx, answerCount, correctIds,
    choiceCounts, explanation, scores, podium,
    quizMeta,
    canGoToMenu,
    connect, send, startWithDeck, disposeSession, backToMenu,
  }
})
