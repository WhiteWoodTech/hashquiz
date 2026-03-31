<template>
  <div class="question-view" v-if="game.question">
    <header class="qv-header">
      <span class="qv-header__q">Q{{ game.questionIdx + 1 }} / {{ game.totalQs }}</span>
      <TimerRing :total="game.question.timer" :remaining="remaining" :size="80" />
      <span class="qv-header__answers">{{ game.answerCount }} / {{ game.players.length }} answered</span>
    </header>

    <h2 class="qv-question-text">{{ game.question.text.replace(/^#+\s/, '') }}</h2>

    <div class="qv-choices-grid">
      <div
        v-for="(choice, i) in game.question.choices"
        :key="choice.id"
        :class="['qv-choice-card', `qv-choice-card--${['a','b','c','d'][i]}`]"
      >
        <span class="qv-choice-card__id">{{ choice.id.toUpperCase() }}</span>
        <span>{{ choice.text }}</span>
      </div>
    </div>

    <div class="qv-controls">
      <button class="qv-btn-action" @click="game.send('host_reveal')">
        🔍 Reveal Answer
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted, watch } from 'vue'
import { useGameStore } from '../stores/game'
import { TimerRing } from '@quizv/ui'

const game = useGameStore()
const remaining = ref(game.question?.timer ?? 0)
let interval: ReturnType<typeof setInterval> | null = null

function startTimer() {
  if (interval) clearInterval(interval)
  remaining.value = game.question?.timer ?? 0
  interval = setInterval(() => {
    if (remaining.value > 0) remaining.value--
    else if (interval) clearInterval(interval)
  }, 1000)
}

watch(() => game.question, () => startTimer(), { immediate: true })
onUnmounted(() => { if (interval) clearInterval(interval) })
</script>

<style scoped>
.question-view { max-width: 960px; margin: 0 auto; }
.qv-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
.qv-header__q, .qv-header__answers { color: var(--qv-text-muted); font-size: 0.9rem; }
.qv-question-text { font-size: 1.6rem; margin: 0 0 1.5rem; line-height: 1.4; }
.qv-choices-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem; }
.qv-choice-card { display: flex; align-items: center; gap: 0.75rem; padding: 1rem; border-radius: var(--qv-radius); background: var(--qv-surface-2); }
.qv-choice-card--a { border-left: 4px solid #7c3aed; }
.qv-choice-card--b { border-left: 4px solid #0891b2; }
.qv-choice-card--c { border-left: 4px solid #d97706; }
.qv-choice-card--d { border-left: 4px solid #059669; }
.qv-choice-card__id { font-weight: 700; min-width: 1.5rem; }
.qv-controls { display: flex; gap: 1rem; }
.qv-btn-action {
  padding: 0.8rem 1.5rem; background: var(--qv-surface-2); color: var(--qv-text);
  border: 1px solid var(--qv-border); border-radius: var(--qv-radius);
  cursor: pointer; font-size: 1rem; font-family: inherit;
  transition: background 0.15s;
}
.qv-btn-action:hover { background: var(--qv-surface); }
</style>
