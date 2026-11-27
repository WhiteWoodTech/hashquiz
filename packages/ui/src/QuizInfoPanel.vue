<template>
  <div :class="['qip', { 'qip--compact': compact }]">
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
import type { QuizInfo } from '@hashquiz/core'
import DifficultyBar from './DifficultyBar.vue'

defineProps<{
  quizInfo: QuizInfo
  playerCount?: number
  /** Smaller type and spacing (phones, deck grid). */
  compact?: boolean
}>()
</script>

<style scoped>
.qip {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem;
  min-width: 0;
  background: color-mix(in srgb, var(--hq-surface) 82%, transparent);
  border: 1px solid var(--hq-border);
  border-radius: var(--hq-radius);
  backdrop-filter: blur(6px);
}
.qip--compact { gap: 0.75rem; padding: 1rem; }
.qip--compact .qip__title { font-size: 1.5rem; overflow-wrap: anywhere; }
.qip--compact .qip__description {
  font-size: 1rem;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.qip--compact .qip__badge { font-size: 0.75rem; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qip--compact .qip__metrics { gap: 0.5rem; }
.qip--compact .qip__metric { min-width: 0; flex: 1 1 0; padding: 0.4rem 0.5rem; }
.qip--compact .qip__metric strong { font-size: 1.4rem; }
.qip--compact .qip__metric span { font-size: 0.75rem; }
.qip--compact .qip__tag { font-size: 0.75rem; }

.qip__badge {
  display: inline-block;
  align-self: flex-start;
  background: linear-gradient(135deg, var(--hq-accent), var(--hq-accent-2));
  color: var(--hq-text);
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.3rem 0.75rem;
  border-radius: var(--hq-radius-sm);
}

.qip__header { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; }
.qip__title { font-size: 3rem; font-weight: 700; margin: 0; color: var(--hq-text); }

.qip__content { display: flex; flex-direction: column; gap: 0; }
.qip__tags { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.5rem; }
.qip__tag {
  background: var(--hq-surface);
  border: 1px solid var(--hq-border);
  border-radius: var(--hq-radius-sm);
  padding: 0.2rem 0.55rem;
  font-size: 0.875rem;
  color: var(--hq-text-muted);
}
.qip__description { margin: 0; color: var(--hq-text-muted); font-size: 1.25rem; line-height: 1.5; }

.qip__target-badge {
  flex-shrink: 0;
  padding: 0.3rem 0.75rem;
  border-radius: var(--hq-radius-sm);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}
.qip__target-badge--easy   { background: color-mix(in srgb, var(--hq-correct) 15%, transparent); color: var(--hq-correct); }
.qip__target-badge--medium { background: color-mix(in srgb, var(--hq-warn)    15%, transparent); color: var(--hq-warn); }
.qip__target-badge--hard   { background: color-mix(in srgb, var(--hq-wrong)   15%, transparent); color: var(--hq-wrong); }

.qip__metrics { display: flex; gap: 1rem; justify-content: center; }
.qip__metric {
  display: flex; flex-direction: column; align-items: center;
  background: var(--hq-surface);
  border: 1px solid var(--hq-border);
  border-radius: var(--hq-radius-sm);
  padding: 0.5rem 1rem;
  min-width: 70px;
}
.qip__metric strong { font-size: 2rem; font-weight: 700; color: var(--hq-accent); line-height: 1; }
.qip__metric span { font-size: 0.875rem; color: var(--hq-text-muted); margin-top: 0.15rem; }
</style>
