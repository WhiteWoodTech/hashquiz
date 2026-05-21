<template>
  <div class="lobby">
    <h1 class="lobby__title">QuizV</h1>

    <!-- Quiz info panel -->
    <QuizInfoPanel v-if="game.quizMeta" :quizInfo="game.quizMeta" :playerCount="game.players.length" class="quiz-info" />

    <div class="lobby__main">
      <div class="lobby__qr">
        <QrCode :value="qrUrl" :size="220" />
        <p class="lobby__url">{{ qrUrl }}</p>
      </div>

      <div class="lobby__info">
        <div class="lobby__code-box">
          <p class="lobby__code-label">Join code</p>
          <p class="lobby__code">{{ game.joinCode }}</p>
        </div>
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
import { computed } from 'vue'
import { useGameStore } from '../stores/game'
import { QrCode, PlayerList, QuizInfoPanel } from '@quizv/ui'

const game = useGameStore()
const qrUrl = computed(() =>
  game.playerUrl || `${location.origin}/?code=${game.joinCode}`
)
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
.qv-btn-primary {
  margin-top: 1.5rem; width: 100%; padding: 0.9rem;
  background: var(--qv-accent); color: #fff;
  border: none; border-radius: var(--qv-radius); font-size: 1.1rem;
  cursor: pointer; font-family: inherit; font-weight: 600;
  transition: background 0.15s;
}
.qv-btn-primary:hover:not(:disabled) { background: #6d28d9; }
.qv-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

.quiz-info {
  background: var(--qv-surface);
  border: 1px solid var(--qv-border);
  border-radius: var(--qv-radius);
  padding: 1.5rem;
  margin-bottom: 2rem;
}
</style>
