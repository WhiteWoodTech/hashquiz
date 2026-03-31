<template>
  <div class="question-view" v-if="game.question">
    <!-- Score bar (appears after first feedback) -->
    <div v-if="game.totalScore > 0" class="qv-score-bar">
      Score: <strong>{{ game.totalScore }}</strong> pts
    </div>

    <!-- Timer ring -->
    <div class="qv-timer-wrap">
      <TimerRing :total="game.question.timer" :remaining="remaining" :size="100" />
    </div>

    <!-- Answer time indicator (shown after submitting) -->
    <p v-if="game.answered" class="qv-answer-time">
      Answered in {{ Math.round(game.answerTimeMs / 1000) }}s / {{ game.question.timer }}s
    </p>

    <!-- Question text -->
    <h2 class="qv-q-text">{{ game.question.text.replace(/^#+\s/, '') }}</h2>

    <!-- 2×2 answer grid -->
    <div class="qv-grid">
      <AnswerButton
        v-for="(choice, i) in game.question.choices"
        :key="choice.id"
        :id="choice.id"
        :text="choice.text"
        :color-id="(['a','b','c','d'][i] as 'a'|'b'|'c'|'d')"
        :state="btnState(choice.id)"
        @select="submitAnswer(choice.id)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { useGameStore } from '../stores/game'
import { TimerRing, AnswerButton } from '@quizv/ui'

const game = useGameStore()
const remaining = ref(game.question?.timer ?? 0)
const selected  = ref<string | null>(null)
let interval: ReturnType<typeof setInterval> | null = null

watch(() => game.question, (q) => {
  if (!q) return
  selected.value  = null
  remaining.value = q.timer
  if (interval) clearInterval(interval)
  interval = setInterval(() => {
    if (remaining.value > 0) remaining.value--
    else if (interval) clearInterval(interval)
  }, 1000)
}, { immediate: true })

onUnmounted(() => { if (interval) clearInterval(interval) })

function btnState(id: string): 'idle' | 'selected' | 'disabled' {
  if (!game.answered) return 'idle'
  return selected.value === id ? 'selected' : 'disabled'
}

function submitAnswer(id: string) {
  if (game.answered || !game.question) return
  selected.value = id
  const elapsed = (game.question.timer - remaining.value) * 1000
  game.submitAnswer([id], elapsed)
}
</script>

<style scoped>
.question-view { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; padding-top: 0.5rem; }
.qv-score-bar { align-self: flex-end; font-size: 0.85rem; color: var(--qv-text-muted); }
.qv-timer-wrap { margin: 0.5rem 0; }
.qv-answer-time { font-size: 0.85rem; color: var(--qv-text-muted); margin: 0; }
.qv-q-text { font-size: 1.25rem; text-align: center; margin: 0.5rem 0; line-height: 1.4; }
.qv-grid { width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem; }
</style>
