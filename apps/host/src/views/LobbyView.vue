<template>
  <div class="lobby">
    <h1 class="lobby__title">QuizV</h1>

    <!-- Quiz info panel -->
    <div v-if="game.quizMeta" class="quiz-info">
      <div class="quiz-info__header">
        <div>
          <h2 class="quiz-info__title">{{ game.quizMeta.title }}</h2>
          <p v-if="game.quizMeta.description" class="quiz-info__description">
            {{ game.quizMeta.description }}
          </p>
          <div v-if="game.quizMeta.tags.length" class="quiz-info__tags">
            <span
              v-for="tag in game.quizMeta.tags"
              :key="tag"
              class="quiz-info__tag"
            >{{ tag }}</span>
          </div>
        </div>
        <span
          v-if="game.quizMeta.targetDifficulty"
          :class="['quiz-info__target-badge', `quiz-info__target-badge--${game.quizMeta.targetDifficulty}`]"
        >🎯 {{ game.quizMeta.targetDifficulty.toUpperCase() }}</span>
      </div>

      <div class="quiz-info__metrics">
        <span class="quiz-info__metric">{{ game.quizMeta.totalQuestions }} questions</span>
        <span class="quiz-info__metric">{{ game.quizMeta.tags.length }} tags</span>
      </div>

      <DifficultyBar :distribution="game.quizMeta.difficultyDistribution" />
    </div>

    <div class="lobby__main">
      <div class="lobby__qr">
        <QrCode :value="game.playerUrl" :size="220" />
        <p class="lobby__url">{{ game.playerUrl }}</p>
      </div>

      <div class="lobby__info">
        <div class="lobby__code-box">
          <p class="lobby__code-label">Join code</p>
          <p class="lobby__code">{{ game.joinCode }}</p>
        </div>
        <p class="lobby__count">{{ game.players.length }} player{{ game.players.length !== 1 ? 's' : '' }} connected</p>
        <PlayerList :players="game.players" />
        <button
          class="qv-btn-primary"
          :disabled="game.players.length === 0"
          @click="game.send('host_start')"
        >
          ▶ Start Game
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '../stores/game'
import { QrCode, PlayerList } from '@quizv/ui'
import DifficultyBar from '../components/DifficultyBar.vue'
const game = useGameStore()
</script>

<style scoped>
.lobby { max-width: 960px; margin: 0 auto; }
.lobby__title { font-size: 2.5rem; color: var(--qv-accent); margin-bottom: 2rem; }
.lobby__main { display: grid; grid-template-columns: auto 1fr; gap: 3rem; align-items: start; }
.lobby__qr { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
.lobby__url { font-size: 0.75rem; color: var(--qv-text-muted); word-break: break-all; max-width: 220px; text-align: center; }
.lobby__code-box { background: var(--qv-surface); border-radius: var(--qv-radius); padding: 1.25rem; margin-bottom: 1rem; }
.lobby__code-label { margin: 0; color: var(--qv-text-muted); font-size: 0.85rem; }
.lobby__code { margin: 0.25rem 0 0; font-size: 3rem; font-weight: 700; letter-spacing: 0.2em; color: var(--qv-accent); }
.lobby__count { color: var(--qv-text-muted); margin: 0 0 0.75rem; }
.qv-btn-primary {
  margin-top: 1.5rem; width: 100%; padding: 0.9rem;
  background: var(--qv-accent); color: #fff;
  border: none; border-radius: var(--qv-radius); font-size: 1.1rem;
  cursor: pointer; font-family: inherit; font-weight: 600;
  transition: background 0.15s;
}
.qv-btn-primary:hover:not(:disabled) { background: #6d28d9; }
.qv-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

/* Quiz info panel */
.quiz-info {
  background: var(--qv-surface);
  border: 1px solid var(--qv-border);
  border-radius: var(--qv-radius);
  padding: 1.5rem;
  margin-bottom: 2rem;
}
.quiz-info__header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.75rem; }
.quiz-info__title { font-size: 1.4rem; font-weight: 700; margin: 0 0 0.25rem; color: var(--qv-text); }
.quiz-info__description { margin: 0 0 0.75rem; color: var(--qv-text-muted); font-size: 0.9rem; line-height: 1.5; }
.quiz-info__tags { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.25rem; }
.quiz-info__tag {
  background: var(--qv-bg);
  border: 1px solid var(--qv-border);
  border-radius: var(--qv-radius-sm);
  padding: 0.2rem 0.6rem;
  font-size: 0.75rem;
  color: var(--qv-text-muted);
}
.quiz-info__target-badge {
  flex-shrink: 0;
  padding: 0.3rem 0.75rem;
  border-radius: var(--qv-radius-sm);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}
.quiz-info__target-badge--easy   { background: rgba(34,197,94,0.15);  color: var(--qv-correct); }
.quiz-info__target-badge--medium { background: rgba(249,115,22,0.15); color: var(--qv-warn); }
.quiz-info__target-badge--hard   { background: rgba(239,68,68,0.15);  color: var(--qv-wrong); }
.quiz-info__metrics { display: flex; gap: 1.5rem; margin-bottom: 0.75rem; }
.quiz-info__metric { font-size: 0.8rem; color: var(--qv-text-muted); }
</style>
