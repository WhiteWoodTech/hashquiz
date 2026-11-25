<template>
  <div class="question-view" v-if="game.question">
    <!-- Progress bar -->
    <div class="qv-progress">
      <span class="qv-progress__label qv-label">Q{{ game.questionIdx + 1 }}</span>
      <div class="qv-progress__track">
        <div
          class="qv-progress__fill"
          :style="{ width: ((game.questionIdx + 1) / game.totalQs * 100) + '%' }"
        />
      </div>
      <span class="qv-progress__label">{{ game.totalQs }}</span>
    </div>

    <div class="qv-main">
      <header class="qv-header">
        <FxCountdown :total="game.question.timer" :remaining="remaining" size="large" />
      </header>

      <div class="qv-body">
        <div class="qv-q-meta">
          <div class="qv-q-meta__tags">
            <span
              v-for="tag in game.question.tags"
              :key="tag"
              class="qv-q-meta__tag"
            >{{ tag }}</span>
          </div>
          <span :class="['qv-difficulty', `qv-difficulty--${game.question.difficulty}`]">
            <span class="qv-difficulty__dot qv-difficulty__dot--1"></span>
            <span class="qv-difficulty__dot qv-difficulty__dot--2"></span>
            <span class="qv-difficulty__dot qv-difficulty__dot--3"></span>
          </span>
        </div>

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
      </div>
    </div>

    <div class="qv-controls">
      <p class="qv-controls__answered">{{ game.answerCount }} / {{ game.players.length }} answered</p>
      <button class="qv-btn-action" @click="game.send('host_reveal')">
        🔍 Reveal Answer
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted, watch } from 'vue'
import { useGameStore } from '../stores/game'
import { FxCountdown } from '@quizv/ui'

const game = useGameStore()
const remaining = ref(game.question?.timer ?? 0)
let interval: ReturnType<typeof setInterval> | null = null
let startTime = 0
let totalTime = 0

function startTimer() {
  if (interval) clearInterval(interval)
  totalTime = game.question?.timer ?? 0
  remaining.value = totalTime
  startTime = Date.now()
  interval = setInterval(() => {
    const left = Math.max(0, Math.round((totalTime - (Date.now() - startTime) / 1000) * 10) / 10)
    remaining.value = left
    if (left <= 0) {
      clearInterval(interval!)
      interval = null
    }
  }, 100)
}

watch(() => game.question, () => startTimer(), { immediate: true })
onUnmounted(() => { if (interval) clearInterval(interval) })
</script>

<style scoped>
/* Full-screen grid: progress / timer + question and choices / controls. */
.question-view {
  height: 100%;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 2.5vmin;
  padding: 3vmin 4vmin;
  overflow: hidden;
}
.qv-progress { display: flex; align-items: center; gap: 0.6rem; padding-right: 12rem; } /* clears the fullscreen button */
.qv-progress__label { font-size: clamp(0.8rem, 1.6vmin, 1.1rem); color: var(--qv-text-muted); min-width: 2rem; }
.qv-progress__label:last-child { text-align: right; }
.qv-progress__track { flex: 1; height: 4px; background: var(--qv-border); border-radius: 2px; overflow: hidden; }
.qv-progress__fill { height: 100%; background: var(--qv-accent); border-radius: 2px; transition: width 0.3s; }
.qv-main {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 5vmin;
  min-height: 0;
}
.qv-header { display: flex; align-items: center; justify-content: center; }
.qv-body { display: flex; flex-direction: column; min-height: 0; max-height: 100%; }
.qv-q-meta { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5vmin; }
.qv-q-meta__tags { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.qv-q-meta__tag { background: var(--qv-bg); border: 1px solid var(--qv-border); border-radius: var(--qv-radius-sm); padding: 0.15rem 0.5rem; font-size: clamp(0.75rem, 1.5vmin, 1rem); color: var(--qv-text-muted); }
/* 3-dot difficulty */
.qv-difficulty { display: flex; gap: 3px; align-items: center; flex-shrink: 0; }
.qv-difficulty__dot { width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid currentColor; background: transparent; }
.qv-difficulty--easy   { color: var(--qv-correct); }
.qv-difficulty--medium { color: var(--qv-warn); }
.qv-difficulty--hard   { color: var(--qv-wrong); }
.qv-difficulty--easy   .qv-difficulty__dot--1 { background: currentColor; }
.qv-difficulty--medium .qv-difficulty__dot--1,
.qv-difficulty--medium .qv-difficulty__dot--2 { background: currentColor; }
.qv-difficulty--hard   .qv-difficulty__dot { background: currentColor; }
.qv-question-text { font-size: clamp(1.4rem, 4.6vmin, 3.4rem); margin: 0 0 3vmin; line-height: 1.25; }
.qv-choices-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2vmin; font-size: clamp(1rem, 3vmin, 2.2rem); }
.qv-choice-card { display: flex; align-items: center; gap: 0.75em; padding: 2vmin 2.4vmin; border-radius: var(--qv-radius); background: var(--qv-surface-2); line-height: 1.25; }
.qv-choice-card--a { border-left: 4px solid var(--qv-choice-a); }
.qv-choice-card--b { border-left: 4px solid var(--qv-choice-b); }
.qv-choice-card--c { border-left: 4px solid var(--qv-choice-c); }
.qv-choice-card--d { border-left: 4px solid var(--qv-choice-d); }
.qv-choice-card__id { font-weight: 700; min-width: 1.5em; }
.qv-controls { display: flex; align-items: center; justify-content: center; gap: 3vmin; }
.qv-controls__answered { margin: 0; font-size: clamp(0.9rem, 2.2vmin, 1.5rem); color: var(--qv-text-muted); }
.qv-btn-action {
  padding: 1.4vmin 2.6vmin; background: var(--qv-surface-2); color: var(--qv-text);
  border: 1px solid var(--qv-border); border-radius: var(--qv-radius);
  cursor: pointer; font-size: clamp(1rem, 2.2vmin, 1.5rem); font-family: inherit;
  transition: background 0.15s;
}
.qv-btn-action:hover { background: var(--qv-surface); }
</style>
