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

    <!-- Answer time indicator (shown after auto-submit) -->
    <p v-if="game.answered" class="qv-answer-time">
      Answered in {{ Math.round(game.answerTimeMs / 1000) }}s / {{ game.question.timer }}s
    </p>
    <p v-else-if="timerExpired && selected.size === 0" class="qv-answer-time">
      No answer submitted
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
        @select="toggleChoice(choice.id)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { useGameStore } from '../stores/game'
import { TimerRing, AnswerButton } from '@quizv/ui'

const game = useGameStore()
const remaining       = ref(game.question?.timer ?? 0)
const selected        = ref<Set<string>>(new Set())
const timerExpired    = ref(false)
const lastPressElapsed = ref(0)   // ms elapsed at the time of the last toggle
let interval: ReturnType<typeof setInterval> | null = null

watch(() => game.question, (q) => {
  if (!q) return
  selected.value       = new Set()
  timerExpired.value   = false
  lastPressElapsed.value = 0
  remaining.value      = q.timer
  if (interval) clearInterval(interval)
  interval = setInterval(() => {
    if (remaining.value > 0) {
      remaining.value--
    } else {
      clearInterval(interval!)
      interval = null
      timerExpired.value = true
      // Auto-submit with whatever is selected (empty = no answer)
      if (selected.value.size > 0) {
        game.submitAnswer([...selected.value], lastPressElapsed.value)
      }
    }
  }, 1000)
}, { immediate: true })

onUnmounted(() => { if (interval) clearInterval(interval) })

function btnState(id: string): 'idle' | 'selected' | 'disabled' {
  if (timerExpired.value) return selected.value.has(id) ? 'selected' : 'disabled'
  return selected.value.has(id) ? 'selected' : 'idle'
}

function toggleChoice(id: string) {
  if (timerExpired.value || game.answered) return
  // Record elapsed time at moment of this press
  lastPressElapsed.value = (game.question!.timer - remaining.value) * 1000
  // Toggle selection
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
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
