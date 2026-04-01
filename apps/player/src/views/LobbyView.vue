<template>
  <div class="lobby">
    <!-- Quiz info (when available) -->
    <template v-if="game.quizMeta">
      <div class="lobby__badge">🧠 {{ game.quizMeta.title }}</div>

      <div class="lobby__header">
        <div>
          <h1 class="lobby__title">{{ game.quizMeta.title }}</h1>
          <p v-if="game.quizMeta.description" class="lobby__description">
            {{ game.quizMeta.description }}
          </p>
          <div v-if="game.quizMeta.tags.length" class="lobby__tags">
            <span
              v-for="tag in game.quizMeta.tags"
              :key="tag"
              class="lobby__tag"
            >{{ tag }}</span>
          </div>
        </div>
        <span
          v-if="game.quizMeta.targetDifficulty"
          :class="['lobby__target-badge', `lobby__target-badge--${game.quizMeta.targetDifficulty}`]"
        >🎯 {{ game.quizMeta.targetDifficulty.toUpperCase() }}</span>
      </div>

      <div class="lobby__metrics">
        <div class="lobby__metric">
          <strong>{{ game.quizMeta.totalQuestions }}</strong>
          <span>questions</span>
        </div>
        <div v-if="game.quizMeta.tags.length" class="lobby__metric">
          <strong>{{ game.quizMeta.tags.length }}</strong>
          <span>tags</span>
        </div>
        <div class="lobby__metric">
          <strong>{{ game.playerCount }}</strong>
          <span>players</span>
        </div>
      </div>

      <DifficultyBar :distribution="game.quizMeta.difficultyDistribution" />

      <div class="lobby__divider" />
    </template>

    <!-- Waiting section -->
    <div class="lobby__wait">
      <div class="lobby__icon">⏳</div>
      <h2>Waiting for the host…</h2>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '../stores/game'
import { DifficultyBar } from '@quizv/ui'
const game = useGameStore()
</script>

<style scoped>
.lobby {
  max-width: 480px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.lobby__badge {
  display: inline-block;
  align-self: flex-start;
  background: linear-gradient(135deg, var(--qv-accent), var(--qv-accent-2));
  color: var(--qv-text);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.3rem 0.75rem;
  border-radius: var(--qv-radius-sm);
}

.lobby__header { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; }
.lobby__title { font-size: 1.6rem; font-weight: 700; margin: 0 0 0.25rem; color: var(--qv-text); }
.lobby__description { margin: 0 0 0.75rem; color: var(--qv-text-muted); font-size: 0.875rem; line-height: 1.5; }

.lobby__tags { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.lobby__tag {
  background: var(--qv-surface);
  border: 1px solid var(--qv-border);
  border-radius: var(--qv-radius-sm);
  padding: 0.2rem 0.55rem;
  font-size: 0.72rem;
  color: var(--qv-text-muted);
}

.lobby__target-badge {
  flex-shrink: 0;
  padding: 0.3rem 0.75rem;
  border-radius: var(--qv-radius-sm);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}
.lobby__target-badge--easy   { background: color-mix(in srgb, var(--qv-correct) 15%, transparent); color: var(--qv-correct); }
.lobby__target-badge--medium { background: color-mix(in srgb, var(--qv-warn)    15%, transparent); color: var(--qv-warn); }
.lobby__target-badge--hard   { background: color-mix(in srgb, var(--qv-wrong)   15%, transparent); color: var(--qv-wrong); }

.lobby__metrics { display: flex; gap: 1rem; justify-content: center; }
.lobby__metric {
  display: flex; flex-direction: column; align-items: center;
  background: var(--qv-surface);
  border: 1px solid var(--qv-border);
  border-radius: var(--qv-radius-sm);
  padding: 0.5rem 1rem;
  min-width: 70px;
}
.lobby__metric strong { font-size: 1.25rem; font-weight: 700; color: var(--qv-accent); line-height: 1; }
.lobby__metric span { font-size: 0.7rem; color: var(--qv-text-muted); margin-top: 0.15rem; }

.lobby__divider { height: 1px; background: var(--qv-border); margin: 0.5rem 0; }

.lobby__wait { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; text-align: center; padding: 1rem 0; }
.lobby__icon { font-size: 2.5rem; }
</style>
