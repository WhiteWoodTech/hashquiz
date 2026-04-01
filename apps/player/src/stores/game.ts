import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { QuestionPublic, Score, PodiumEntry, QuizInfo } from '@quizv/core'
import type { GameEvent } from '@quizv/core'

export type PlayerPhase = 'join' | 'lobby' | 'question' | 'feedback' | 'podium'

interface JoinedMsg { type: 'joined'; player: { id: string }; quizMeta: QuizInfo }
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
  const podium       = ref<PodiumEntry[]>([])
  const connectError = ref('')
  const quizMeta     = ref<QuizInfo | null>(null)

  let ws: WebSocket | null = null

  function connect(code: string, pseudo: string, email: string) {
    connectError.value = ''
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
        question.value    = msg.question
        questionIdx.value = msg.idx
        answered.value    = false
        answerTimeMs.value = 0
        phase.value       = 'question'
        break
      case 'answer_revealed': {
        const me = msg.scores.find((s: Score) => s.playerId === playerId.value)
        if (me) {
          lastDelta.value  = me.delta
          totalScore.value = me.score
        }
        phase.value = 'feedback'
        break
      }
      case 'game_ended':
        podium.value = msg.podium
        phase.value  = 'podium'
        break
    }
  }

  function submitAnswer(choiceIds: string[], elapsed: number) {
    if (answered.value || !ws) return
    answered.value    = true
    answerTimeMs.value = elapsed
    ws.send(JSON.stringify({ type: 'submit_answer', choiceIds, answerTimeMs: elapsed }))
  }

  return {
    phase, playerId, playerCount, question, questionIdx,
    answered, answerTimeMs, totalScore, lastDelta, podium, connectError,
    quizMeta,
    connect, submitAnswer,
  }
})
