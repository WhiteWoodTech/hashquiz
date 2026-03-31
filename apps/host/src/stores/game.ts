import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PlayerState, QuestionPublic, Score, PodiumEntry } from '@quizv/core'
import type { GameEvent } from '@quizv/core'

export type HostPhase = 'connecting' | 'lobby' | 'question' | 'revealed' | 'finished'

// host_connected is a custom server-only message, not part of GameEvent union
interface HostConnectedMsg {
  type: 'host_connected'
  joinCode: string
  totalQuestions: number
  playerUrl: string
}

type ServerMsg = GameEvent | HostConnectedMsg

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

  let ws: WebSocket | null = null

  function connect() {
    const url = `ws://localhost:3030/ws?role=host`
    ws = new WebSocket(url)
    ws.onmessage = (e: MessageEvent<string>) => {
      handle(JSON.parse(e.data) as ServerMsg)
    }
    ws.onerror = () => { phase.value = 'connecting' }
  }

  function handle(msg: ServerMsg) {
    if (msg.type === 'host_connected') {
      joinCode.value  = msg.joinCode
      playerUrl.value = msg.playerUrl
      totalQs.value   = msg.totalQuestions
      phase.value     = 'lobby'
      return
    }
    switch (msg.type) {
      case 'player_joined':
        players.value.push(msg.player)
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
    }
  }

  function send(type: 'host_start' | 'host_reveal' | 'host_next') {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type }))
  }

  return {
    phase, joinCode, playerUrl, totalQs, players,
    question, questionIdx, answerCount, correctIds,
    choiceCounts, explanation, scores, podium,
    connect, send,
  }
})
