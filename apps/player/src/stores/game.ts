import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { QuestionPublic, Score, PodiumEntry, QuizInfo } from '@quizv/core'
import type { GameEvent } from '@quizv/core'
import { SupabaseTransport } from '@quizv/transport-supabase'
import { GameEvents } from '@quizv/core'
import type { IRealtimeTransport, PlayerState } from '@quizv/core'

export type PlayerPhase = 'join' | 'lobby' | 'question' | 'podium'

interface JoinedMsg { type: 'joined'; player: { id: string }; quizMeta: QuizInfo; playerCount: number }
type ServerMsg = GameEvent | JoinedMsg

export const useGameStore = defineStore('game', () => {
  const phase        = ref<PlayerPhase>('join')
  const playerId     = ref(Math.random().toString(36).slice(2) + Date.now().toString(36))
  const playerCount  = ref(0)
  const question     = ref<QuestionPublic | null>(null)
  const questionIdx  = ref(0)
  const answered     = ref(false)
  const answerTimeMs = ref(0)
  const totalScore   = ref(0)
  const lastDelta    = ref(0)
  const correctIds   = ref<string[]>([])
  const podium       = ref<PodiumEntry[]>([])
  const connectError = ref('')
  const quizMeta     = ref<QuizInfo | null>(null)

  let ws: WebSocket | null = null
  let transport: IRealtimeTransport | null = null
  let channelName = ''

  async function connectSupabase(code: string, pseudo: string, email: string) {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
    if (!url || !anonKey) {
      connectError.value = 'Missing Supabase credentials'
      return
    }
    transport = new SupabaseTransport({ url, anonKey })
    channelName = `game:${code}`

    transport.subscribe(channelName, handle as (e: GameEvent) => void)

    // Let presence sync briefly, then dedupe pseudo against real players (ignoring the host entry)
    await new Promise(r => setTimeout(r, 300))
    const HOST_PRESENCE_ID = '__host__'
    const existing = transport.presence.list(channelName)
      .filter(p => p.id !== HOST_PRESENCE_ID)
      .map(p => p.pseudo)
    let final = pseudo
    let n = 2
    while (existing.includes(final)) { final = `${pseudo}-${n++}` }

    const me: PlayerState = {
      id: playerId.value,
      pseudo: final,
      email,
      score: 0,
      joinedAt: Date.now(),
    }
    await transport.presence.track(channelName, me)

    // Confirm the game exists by checking the host presence entry — not by counting players.
    setTimeout(() => {
      const list = transport!.presence.list(channelName)
      const hostPresent = list.some(p => p.id === HOST_PRESENCE_ID)
      if (!hostPresent) {
        connectError.value = 'No game found for this code'
      } else {
        phase.value = 'lobby'
      }
    }, 3000)
  }

  function submitAnswerSupabase(choiceIds: string[], timeRemaining: number) {
    if (!transport) return
    void transport.broadcast(channelName,
      GameEvents.answerSubmit(playerId.value, choiceIds, timeRemaining))
  }

  function connect(code: string, pseudo: string, email: string) {
    connectError.value = ''
    if (import.meta.env.VITE_TRANSPORT === 'supabase') {
      void connectSupabase(code, pseudo, email)
      return
    }
    const wsUrl = `ws://${location.hostname}:3030/ws?role=player&id=${playerId.value}&code=${encodeURIComponent(code)}`
    ws = new WebSocket(wsUrl)
    ws.onerror = () => {
      connectError.value = 'Connection failed — check the join code and try again'
    }
    ws.onopen = () => {
      ws!.send(JSON.stringify({ type: 'player_join', pseudo, email }))
    }
    ws.onmessage = (e: MessageEvent<string>) => {
      handle(JSON.parse(e.data) as ServerMsg)
    }
  }

  function handle(msg: ServerMsg) {
    if (msg.type === 'joined') {
      phase.value = 'lobby'
      quizMeta.value = msg.quizMeta
      playerCount.value = msg.playerCount
      return
    }
    switch (msg.type) {
      case 'player_joined':
        playerCount.value++
        break
      case 'player_left':
        playerCount.value = Math.max(0, playerCount.value - 1)
        break
      case 'question_started':
        question.value     = msg.question
        questionIdx.value  = msg.idx
        answered.value     = false
        answerTimeMs.value = 0
        correctIds.value   = []
        phase.value        = 'question'
        break
      case 'answer_revealed': {
        const me = msg.scores.find((s: Score) => s.playerId === playerId.value)
        if (me) {
          lastDelta.value  = me.delta
          totalScore.value = me.score
        }
        correctIds.value = msg.correct
        // stay in 'question' phase — feedback shown inline
        break
      }
      case 'game_ended':
        podium.value = msg.podium
        phase.value  = 'podium'
        break
    }
  }

  function submitAnswer(choiceIds: string[], elapsed: number) {
    if (answered.value) return
    answered.value     = true
    answerTimeMs.value = elapsed
    if (import.meta.env.VITE_TRANSPORT === 'supabase') {
      submitAnswerSupabase(choiceIds, elapsed)
      return
    }
    if (!ws) return
    ws.send(JSON.stringify({ type: 'submit_answer', choiceIds, answerTimeMs: elapsed }))
  }

  return {
    phase, playerId, playerCount, question, questionIdx,
    answered, answerTimeMs, totalScore, lastDelta, correctIds, podium, connectError,
    quizMeta,
    connect, submitAnswer, submitAnswerSupabase,
  }
})
