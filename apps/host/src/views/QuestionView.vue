<template>
  <div class="question-view" v-if="game.question">
    <!-- Progress bar -->
    <div class="hq-progress">
      <span class="hq-progress__label hq-label">Q{{ game.questionIdx + 1 }}</span>
      <div class="hq-progress__track">
        <div
          class="hq-progress__fill"
          :style="{ width: ((game.questionIdx + 1) / game.totalQs * 100) + '%' }"
        />
      </div>
      <span class="hq-progress__label">{{ game.totalQs }}</span>
    </div>

    <div class="hq-main">
      <header class="hq-header">
        <FxCountdown :total="game.question.timer" :remaining="remaining" size="large" />
      </header>

      <div class="hq-body">
        <div class="hq-q-meta">
          <div class="hq-q-meta__tags">
            <span
              v-for="tag in game.question.tags"
              :key="tag"
              class="hq-q-meta__tag"
            >{{ tag }}</span>
          </div>
          <span :class="['hq-difficulty', `hq-difficulty--${game.question.difficulty}`]">
            <span class="hq-difficulty__dot hq-difficulty__dot--1"></span>
            <span class="hq-difficulty__dot hq-difficulty__dot--2"></span>
            <span class="hq-difficulty__dot hq-difficulty__dot--3"></span>
          </span>
        </div>

        <h2 class="hq-question-text">{{ game.question.text.replace(/^#+\s/, '') }}</h2>

        <div class="hq-choices-grid">
          <div
            v-for="(choice, i) in game.question.choices"
            :key="choice.id"
            :class="['hq-choice-card', `hq-choice-card--${['a','b','c','d'][i]}`]"
          >
            <span class="hq-choice-card__id">{{ choice.id.toUpperCase() }}</span>
            <span>{{ choice.text }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="hq-controls">
      <p class="hq-controls__answered">{{ game.answerCount }} / {{ game.players.length }} answered</p>
      <button class="hq-btn-action" @click="game.send('host_reveal')">
        🔍 Reveal Answer
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted, watch } from 'vue'
import { useGameStore } from '../stores/game'
import { FxCountdown } from '@hashquiz/ui'

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
.hq-progress { display: flex; align-items: center; gap: 0.6rem; padding-right: 12rem; } /* clears the fullscreen button */
.hq-progress__label { font-size: clamp(0.8rem, 1.6vmin, 1.1rem); color: var(--hq-text-muted); min-width: 2rem; }
.hq-progress__label:last-child { text-align: right; }
.hq-progress__track { flex: 1; height: 4px; background: var(--hq-border); border-radius: 2px; overflow: hidden; }
.hq-progress__fill { height: 100%; background: var(--hq-progress); border-radius: 2px; transition: width 0.3s; }
.hq-main {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 5vmin;
  min-height: 0;
}
.hq-header { display: flex; align-items: center; justify-content: center; }
.hq-body { display: flex; flex-direction: column; min-height: 0; max-height: 100%; }
.hq-q-meta { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5vmin; }
.hq-q-meta__tags { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.hq-q-meta__tag { background: var(--hq-bg); border: 1px solid var(--hq-border); border-radius: var(--hq-radius-sm); padding: 0.15rem 0.5rem; font-size: clamp(0.75rem, 1.5vmin, 1rem); color: var(--hq-text-muted); }
/* 3-dot difficulty */
.hq-difficulty { display: flex; gap: 3px; align-items: center; flex-shrink: 0; }
.hq-difficulty__dot { width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid currentColor; background: transparent; }
.hq-difficulty--easy   { color: var(--hq-correct); }
.hq-difficulty--medium { color: var(--hq-warn); }
.hq-difficulty--hard   { color: var(--hq-wrong); }
.hq-difficulty--easy   .hq-difficulty__dot--1 { background: currentColor; }
.hq-difficulty--medium .hq-difficulty__dot--1,
.hq-difficulty--medium .hq-difficulty__dot--2 { background: currentColor; }
.hq-difficulty--hard   .hq-difficulty__dot { background: currentColor; }
.hq-question-text { font-size: clamp(1.4rem, 4.6vmin, 3.4rem); margin: 0 0 3vmin; line-height: 1.25; }
.hq-choices-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2vmin; font-size: clamp(1rem, 3vmin, 2.2rem); }
.hq-choice-card { display: flex; align-items: center; gap: 0.75em; padding: 2vmin 2.4vmin; border-radius: var(--hq-radius); background: var(--hq-surface-2); line-height: 1.25; }
.hq-choice-card--a { border-left: 4px solid var(--hq-choice-a); }
.hq-choice-card--b { border-left: 4px solid var(--hq-choice-b); }
.hq-choice-card--c { border-left: 4px solid var(--hq-choice-c); }
.hq-choice-card--d { border-left: 4px solid var(--hq-choice-d); }
.hq-choice-card__id { font-weight: 700; min-width: 1.5em; }
.hq-controls { display: flex; align-items: center; justify-content: center; gap: 3vmin; }
.hq-controls__answered { margin: 0; font-size: clamp(0.9rem, 2.2vmin, 1.5rem); color: var(--hq-text-muted); }
.hq-btn-action {
  padding: 1.4vmin 2.6vmin; background: var(--hq-surface-2); color: var(--hq-text);
  border: 1px solid var(--hq-border); border-radius: var(--hq-radius);
  cursor: pointer; font-size: clamp(1rem, 2.2vmin, 1.5rem); font-family: inherit;
  transition: background 0.15s;
}
.hq-btn-action:hover { background: var(--hq-surface); }
</style>
