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

    <!-- Answer time indicator -->
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
        @select="handleSelect(choice.id)"
      />
    </div>

    <!-- Valider button: one-shoot + multiple, before submission -->
    <button
      v-if="oneShoot && isMultiple && !game.answered && !timerExpired"
      class="qv-validate-btn"
      :disabled="selected.size === 0"
      @click="validateMultiple"
    >
      Valider →
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useGameStore } from '../stores/game'
import { TimerRing, AnswerButton } from '@quizv/ui'

const game = useGameStore()
const remaining        = ref(game.question?.timer ?? 0)
const selected         = ref<Set<string>>(new Set())
const timerExpired     = ref(false)
const lastPressElapsed = ref(0)
let interval: ReturnType<typeof setInterval> | null = null

const oneShoot   = computed(() => game.question?.oneShoot ?? true)
const isMultiple = computed(() => game.question?.type === 'multiple')

watch(() => game.question, (q) => {
  if (!q) return
  selected.value         = new Set()
  timerExpired.value     = false
  lastPressElapsed.value = 0
  remaining.value        = q.timer
  if (interval) clearInterval(interval)
  interval = setInterval(() => {
    if (remaining.value > 0) {
      remaining.value--
    } else {
      clearInterval(interval!)
      interval = null
      timerExpired.value = true
      // Auto-submit whatever is selected (all modes)
      if (selected.value.size > 0 && !game.answered) {
        game.submitAnswer([...selected.value], lastPressElapsed.value)
      }
    }
  }, 1000)
}, { immediate: true })

onUnmounted(() => { if (interval) clearInterval(interval) })

function btnState(id: string): 'idle' | 'selected' | 'disabled' {
  if (timerExpired.value || game.answered) return selected.value.has(id) ? 'selected' : 'disabled'
  return selected.value.has(id) ? 'selected' : 'idle'
}

function handleSelect(id: string) {
  if (timerExpired.value || game.answered) return

  if (!oneShoot.value) {
    // modifiable: free toggle, auto-submit at timer=0
    lastPressElapsed.value = (game.question!.timer - remaining.value) * 1000
    const next = new Set(selected.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selected.value = next
    return
  }

  if (!isMultiple.value) {
    // one-shoot + single: first click submits immediately, ignore further clicks
    if (selected.value.size > 0) return
    const elapsed = (game.question!.timer - remaining.value) * 1000
    selected.value = new Set([id])
    game.submitAnswer([id], elapsed)
    return
  }

  // one-shoot + multiple: toggle freely, submit via Valider button
  lastPressElapsed.value = (game.question!.timer - remaining.value) * 1000
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

function validateMultiple() {
  if (timerExpired.value || game.answered || selected.value.size === 0) return
  game.submitAnswer([...selected.value], lastPressElapsed.value)
}
</script>

<style scoped>
.question-view { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; padding-top: 0.5rem; }
.qv-score-bar { align-self: flex-end; font-size: 0.85rem; color: var(--qv-text-muted); }
.qv-timer-wrap { margin: 0.5rem 0; }
.qv-answer-time { font-size: 0.85rem; color: var(--qv-text-muted); margin: 0; }
.qv-q-text { font-size: 1.25rem; text-align: center; margin: 0.5rem 0; line-height: 1.4; }
.qv-grid { width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem; }
.qv-validate-btn {
  margin-top: 0.5rem;
  padding: 0.75rem 2rem;
  border: 2px solid var(--qv-accent, #7c3aed);
  border-radius: var(--qv-radius);
  background: transparent;
  color: var(--qv-accent, #7c3aed);
  font-size: 1rem;
  font-family: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.qv-validate-btn:not(:disabled):hover {
  background: var(--qv-accent, #7c3aed);
  color: #fff;
}
.qv-validate-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
