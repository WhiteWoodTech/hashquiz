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

    <div class="rv-main">
      <div class="rv-left">
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

        <div class="rv-fx">
          <FxReveal
            ref="fx"
            :choices="game.question.choices"
            :counts="game.choiceCounts"
            :correct-ids="game.correctIds"
          />
        </div>
      </div>

      <div class="rv-scores">
        <h3>Scores this round</h3>
        <div v-for="s in game.scores.slice(0, 5)" :key="s.playerId" class="rv-score-row">
          <span>{{ s.pseudo }}</span>
          <span :class="['rv-score-delta', s.delta === 0 ? 'rv-score-delta--zero' : '']">{{ s.delta > 0 ? '+' : '' }}{{ s.delta }} pts</span>
          <span class="rv-score-total">{{ s.score }}</span>
        </div>
      </div>
    </div>

    <div class="rv-controls">
      <button class="qv-btn-action" @click="next">⏭ Next Question</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { marked } from 'marked'
import { useGameStore } from '../stores/game'
import { FxReveal } from '@quizv/ui'

const game = useGameStore()
const fx = ref<InstanceType<typeof FxReveal> | null>(null)

// Next stays active during the animation: jump to the final state, then advance.
function next(): void {
  fx.value?.skip()
  game.send('host_next')
}

marked.setOptions({ breaks: true, gfm: true })

const correctChoices = computed(() =>
  game.question?.choices.filter(c => game.correctIds.includes(c.id)) ?? []
)

const renderedExplanation = computed(() =>
  game.explanation ? marked.parse(game.explanation) as string : ''
)
</script>

<style scoped>
/* Full-screen grid: progress / question / answer + chart beside scores / controls. */
.reveal-view {
  height: 100%;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: 2.5vmin;
  padding: 3vmin 4vmin;
  overflow: hidden;
}
.rv-main {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
  gap: 4vmin;
  min-height: 0;
}
.rv-left { display: flex; flex-direction: column; gap: 2.5vmin; min-height: 0; }
.rv-fx { flex: 1 1 0; min-height: 22vmin; }

.rv-progress { display: flex; align-items: center; gap: 0.6rem; padding-right: 12rem; } /* clears the fullscreen button */
.rv-progress__label { font-size: clamp(0.8rem, 1.6vmin, 1.1rem); color: var(--qv-text-muted); min-width: 2rem; }
.rv-progress__label:last-child { text-align: right; }
.rv-progress__track { flex: 1; height: 4px; background: var(--qv-border); border-radius: 2px; overflow: hidden; }
.rv-progress__fill { height: 100%; background: var(--qv-accent); border-radius: 2px; }

.rv-question { font-size: clamp(1.3rem, 3.6vmin, 2.6rem); margin: 0; line-height: 1.25; }

.rv-explanation {
  background: var(--qv-surface-2);
  border-left: 3px solid var(--qv-accent-2);
  border-radius: var(--qv-radius-sm);
  padding: 2vmin 2.4vmin;
  display: flex; flex-direction: column; gap: 0.8vmin;
  font-size: clamp(0.95rem, 2.1vmin, 1.5rem);
}
.rv-correct__label { color: var(--qv-correct); font-weight: 700; font-size: 0.8em; }
.rv-correct__choices {
  list-style: none;
  margin: 0 0 0.25rem;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.rv-correct__choice { font-weight: 600; color: var(--qv-correct); }
.rv-explanation__label { color: var(--qv-text-muted); font-size: 0.75em; margin: 0; }
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
.rv-scores { min-height: 0; overflow: auto; font-size: clamp(0.95rem, 2.2vmin, 1.5rem); }
.rv-scores h3 { margin: 0 0 1.2vmin; font-size: 1em; color: var(--qv-text-muted); }
.rv-score-row { display: flex; align-items: center; gap: 0.75rem; padding: 1vmin 0; border-bottom: 1px solid var(--qv-border); }
.rv-score-row span:first-child { flex: 1; }
.rv-score-delta { color: var(--qv-correct); font-weight: 600; }
.rv-score-delta--zero { color: var(--qv-text-muted); }
.rv-score-total { color: var(--qv-text-muted); font-size: 0.85em; min-width: 4rem; text-align: right; }
.rv-answer-block { min-height: 0; overflow: auto; flex: 0 1 auto; }
.rv-controls { display: flex; justify-content: center; }
.qv-btn-action {
  padding: 1.4vmin 2.6vmin; background: var(--qv-accent); color: var(--qv-text);
  border: none; border-radius: var(--qv-radius);
  cursor: pointer; font-size: clamp(1rem, 2.2vmin, 1.5rem); font-family: inherit; font-weight: 600;
  transition: background 0.15s;
}
.qv-btn-action:hover { background: color-mix(in srgb, var(--qv-accent) 80%, var(--qv-bg)); }
</style>
