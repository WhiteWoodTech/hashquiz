<template>
  <div class="reveal-view" v-if="game.question">
    <!-- Progress bar -->
    <div class="rv-progress">
      <span class="rv-progress__label qv-label">Q{{ game.questionIdx + 1 }}</span>
      <div class="rv-progress__track">
        <div
          class="rv-progress__fill"
          :style="{ width: ((game.questionIdx + 1) / game.totalQs * 100) + '%' }"
        />
      </div>
      <span class="rv-progress__label">{{ game.totalQs }}</span>
    </div>

    <h2 class="rv-question">{{ game.question.text.replace(/^#+\s/, '') }}</h2>

    <!-- Correct answer + explanation together -->
    <div class="rv-answer-block">
      <div v-if="game.explanation" class="rv-explanation">
        <span class="rv-correct__label qv-label">✓ {{ correctChoices.length > 1 ? 'Correct answers' : 'Correct answer' }}</span>
        <ul class="rv-correct__choices">
          <li
            v-for="choice in correctChoices"
            :key="choice.id"
            class="rv-correct__choice"
          >{{ choice.id.toUpperCase() }}. {{ choice.text }}</li>
        </ul>
        <p class="rv-explanation__label qv-label">Explanation</p>
        <div class="rv-explanation__body" v-html="renderedExplanation" />
      </div>
    </div>

    <AnswerBarChart
      :choices="game.question.choices"
      :counts="game.choiceCounts"
      :correct-ids="game.correctIds"
    />

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
import { computed } from 'vue'
import { marked } from 'marked'
import { useGameStore } from '../stores/game'
import { AnswerBarChart } from '@quizv/ui'

const game = useGameStore()

marked.setOptions({ breaks: true, gfm: true })

const correctChoices = computed(() =>
  game.question?.choices.filter(c => game.correctIds.includes(c.id)) ?? []
)

const renderedExplanation = computed(() =>
  game.explanation ? marked.parse(game.explanation) as string : ''
)
</script>

<style scoped>
.reveal-view { max-width: 960px; margin: 0 auto; }

.rv-progress { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1.5rem; }
.rv-progress__label { font-size: 0.8rem; color: var(--qv-text-muted); min-width: 2rem; }
.rv-progress__label:last-child { text-align: right; }
.rv-progress__track { flex: 1; height: 4px; background: var(--qv-border); border-radius: 2px; overflow: hidden; }
.rv-progress__fill { height: 100%; background: var(--qv-accent); border-radius: 2px; }

.rv-question { font-size: 1.4rem; margin: 0 0 1rem; }

.rv-explanation {
  background: var(--qv-surface-2);
  border-left: 3px solid var(--qv-accent-2);
  border-radius: var(--qv-radius-sm);
  padding: 1rem;
  display: flex; flex-direction: column; gap: 0.4rem;
}
.rv-correct__label { color: var(--qv-correct); font-weight: 700; font-size: 0.85rem; }
.rv-correct__choices {
  list-style: none;
  margin: 0 0 0.25rem;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.rv-correct__choice { font-weight: 600; color: var(--qv-correct); }
.rv-explanation__label { color: var(--qv-text-muted); font-size: 0.8rem; margin: 0; }
.rv-explanation__body { line-height: 1.5; }
.rv-explanation__body :deep(p) { margin: 0 0 0.5rem; }
.rv-explanation__body :deep(p:last-child) { margin: 0; }
.rv-explanation__body :deep(code) {
  background: var(--qv-surface);
  border: 1px solid var(--qv-border);
  border-radius: var(--qv-radius-sm);
  padding: 0.1rem 0.35rem;
  font-size: 0.9em;
}
.rv-explanation__body :deep(strong) { color: var(--qv-text); }
.rv-explanation__body :deep(ul),
.rv-explanation__body :deep(ol) { margin: 0.25rem 0; padding-left: 1.25rem; }
.rv-scores { margin: 1.5rem 0; }
.rv-scores h3 { margin: 0 0 0.75rem; font-size: 1rem; color: var(--qv-text-muted); }
.rv-score-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.4rem 0; border-bottom: 1px solid var(--qv-border); }
.rv-score-row span:first-child { flex: 1; }
.rv-score-delta { color: var(--qv-correct); font-weight: 600; }
.rv-score-delta--zero { color: var(--qv-text-muted); }
.rv-score-total { color: var(--qv-text-muted); font-size: 0.85rem; min-width: 4rem; text-align: right; }
.rv-answer-block { margin-bottom: 1.25rem; }
.rv-controls { margin-top: 1.5rem; display: flex; justify-content: center; }
.qv-btn-action {
  padding: 0.8rem 1.5rem; background: var(--qv-accent); color: var(--qv-text);
  border: none; border-radius: var(--qv-radius);
  cursor: pointer; font-size: 1rem; font-family: inherit; font-weight: 600;
  transition: background 0.15s;
}
.qv-btn-action:hover { background: color-mix(in srgb, var(--qv-accent) 80%, var(--qv-bg)); }
</style>
