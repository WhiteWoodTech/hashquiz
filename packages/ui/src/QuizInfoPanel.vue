<template>
  <div class="qip">
    <div class="qip__badge">🧠 {{ quizInfo.title }}</div>

    <div class="qip__header">
      <h2 class="qip__title">{{ quizInfo.title }}</h2>
      <span
        v-if="quizInfo.targetDifficulty"
        :class="['qip__target-badge', `qip__target-badge--${quizInfo.targetDifficulty}`]"
      >🎯 {{ quizInfo.targetDifficulty.toUpperCase() }}</span>
    </div>

    <div class="qip__content">
      <div v-if="quizInfo.tags.length" class="qip__tags">
        <span v-for="tag in quizInfo.tags" :key="tag" class="qip__tag">{{ tag }}</span>
      </div>
      <p v-if="quizInfo.description" class="qip__description">
        {{ quizInfo.description }}
      </p>
    </div>

    <div class="qip__metrics">
      <div class="qip__metric">
        <strong>{{ quizInfo.totalQuestions }}</strong>
        <span>questions</span>
      </div>
      <div v-if="quizInfo.tags.length" class="qip__metric">
        <strong>{{ quizInfo.tags.length }}</strong>
        <span>tags</span>
      </div>
      <div v-if="playerCount !== undefined" class="qip__metric">
        <strong>{{ playerCount }}</strong>
        <span>players</span>
      </div>
    </div>

    <DifficultyBar :distribution="quizInfo.difficultyDistribution" />
  </div>
</template>

<script setup lang="ts">
import type { QuizInfo } from '@quizv/core'
import DifficultyBar from './DifficultyBar.vue'

defineProps<{
  quizInfo: QuizInfo
  playerCount?: number
}>()
</script>

<style scoped>
.qip {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.qip__badge {
  display: inline-block;
  align-self: flex-start;
  background: linear-gradient(135deg, var(--qv-accent), var(--qv-accent-2));
  color: var(--qv-text);
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.3rem 0.75rem;
  border-radius: var(--qv-radius-sm);
}

.qip__header { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; }
.qip__title { font-size: 3rem; font-weight: 700; margin: 0; color: var(--qv-text); }

.qip__content { display: flex; flex-direction: column; gap: 0; }
.qip__tags { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.5rem; }
.qip__tag {
  background: var(--qv-surface);
  border: 1px solid var(--qv-border);
  border-radius: var(--qv-radius-sm);
  padding: 0.2rem 0.55rem;
  font-size: 0.875rem;
  color: var(--qv-text-muted);
}
.qip__description { margin: 0; color: var(--qv-text-muted); font-size: 1.25rem; line-height: 1.5; }

.qip__target-badge {
  flex-shrink: 0;
  padding: 0.3rem 0.75rem;
  border-radius: var(--qv-radius-sm);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}
.qip__target-badge--easy   { background: color-mix(in srgb, var(--qv-correct) 15%, transparent); color: var(--qv-correct); }
.qip__target-badge--medium { background: color-mix(in srgb, var(--qv-warn)    15%, transparent); color: var(--qv-warn); }
.qip__target-badge--hard   { background: color-mix(in srgb, var(--qv-wrong)   15%, transparent); color: var(--qv-wrong); }

.qip__metrics { display: flex; gap: 1rem; justify-content: center; }
.qip__metric {
  display: flex; flex-direction: column; align-items: center;
  background: var(--qv-surface);
  border: 1px solid var(--qv-border);
  border-radius: var(--qv-radius-sm);
  padding: 0.5rem 1rem;
  min-width: 70px;
}
.qip__metric strong { font-size: 2rem; font-weight: 700; color: var(--qv-accent); line-height: 1; }
.qip__metric span { font-size: 0.875rem; color: var(--qv-text-muted); margin-top: 0.15rem; }
</style>
