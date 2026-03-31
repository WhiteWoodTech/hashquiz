<template>
  <div class="reveal-view" v-if="game.question">
    <header class="rv-header">
      <span>Q{{ game.questionIdx + 1 }} — Reveal</span>
    </header>

    <h2 class="rv-question">{{ game.question.text.replace(/^#+\s/, '') }}</h2>

    <AnswerBarChart
      :choices="game.question.choices"
      :counts="game.choiceCounts"
      :correct-ids="game.correctIds"
    />

    <div v-if="game.explanation" class="rv-explanation">
      <p class="rv-explanation__label">Explanation</p>
      <p>{{ game.explanation }}</p>
    </div>

    <div class="rv-scores">
      <h3>Scores this round</h3>
      <div v-for="s in game.scores.slice(0, 5)" :key="s.playerId" class="rv-score-row">
        <span>{{ s.pseudo }}</span>
        <span :class="['rv-score-delta', s.delta === 0 ? 'rv-score-delta--zero' : '']">{{ s.delta > 0 ? '+' : '' }}{{ s.delta }} pts</span>
        <span class="rv-score-total">{{ s.score }}</span>
      </div>
    </div>

    <div class="rv-controls">
      <button class="qv-btn-action" @click="game.send('host_next')">⏭ Next Question</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '../stores/game'
import { AnswerBarChart } from '@quizv/ui'
const game = useGameStore()
</script>

<style scoped>
.reveal-view { max-width: 960px; margin: 0 auto; }
.rv-header { color: var(--qv-text-muted); margin-bottom: 1rem; font-size: 0.9rem; }
.rv-question { font-size: 1.4rem; margin: 0 0 1.5rem; }
.rv-explanation { background: var(--qv-surface-2); border-left: 3px solid var(--qv-accent-2); border-radius: var(--qv-radius-sm); padding: 1rem; margin: 1.5rem 0; }
.rv-explanation__label { color: var(--qv-text-muted); font-size: 0.8rem; margin: 0 0 0.25rem; }
.rv-explanation p:last-child { margin: 0; }
.rv-scores { margin: 1.5rem 0; }
.rv-scores h3 { margin: 0 0 0.75rem; font-size: 1rem; color: var(--qv-text-muted); }
.rv-score-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.4rem 0; border-bottom: 1px solid var(--qv-border); }
.rv-score-row span:first-child { flex: 1; }
.rv-score-delta { color: var(--qv-correct); font-weight: 600; }
.rv-score-delta--zero { color: var(--qv-text-muted); }
.rv-score-total { color: var(--qv-text-muted); font-size: 0.85rem; min-width: 4rem; text-align: right; }
.rv-controls { margin-top: 1.5rem; }
.qv-btn-action {
  padding: 0.8rem 1.5rem; background: var(--qv-accent); color: #fff;
  border: none; border-radius: var(--qv-radius);
  cursor: pointer; font-size: 1rem; font-family: inherit; font-weight: 600;
  transition: background 0.15s;
}
.qv-btn-action:hover { background: #6d28d9; }
</style>
