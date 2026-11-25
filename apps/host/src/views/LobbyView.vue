<template>
  <div class="lobby">
    <h1 class="lobby__title">QuizV</h1>

    <!-- Quiz info panel -->
    <QuizInfoPanel v-if="game.quizMeta" :quizInfo="game.quizMeta" :playerCount="game.players.length" class="quiz-info" />

    <div class="lobby__qr">
      <QrCode :value="qrUrl" :size="800" />
      <p class="lobby__url">{{ qrUrl }}</p>
    </div>

    <div class="lobby__info">
      <div class="lobby__code-box">
        <p class="lobby__code-label qv-label">Join code</p>
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
.lobby__qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 2rem;
}
.lobby__qr :deep(.qv-qr) { width: 100%; height: auto; max-width: 100%; image-rendering: pixelated; }
.lobby__url { font-size: 0.95rem; color: var(--qv-text-muted); word-break: break-all; text-align: center; }
.lobby__code-box { background: var(--qv-surface); border-radius: var(--qv-radius); padding: 1.25rem; margin-bottom: 1rem; }
.lobby__code-label { margin: 0; color: var(--qv-text-muted); font-size: 0.85rem; }
.lobby__code { margin: 0.25rem 0 0; font-size: 3rem; font-weight: 700; letter-spacing: 0.2em; color: var(--qv-accent); }
.qv-btn-primary {
  margin-top: 1.5rem; width: 100%; padding: 0.9rem;
  background: var(--qv-accent); color: var(--qv-text);
  border: none; border-radius: var(--qv-radius); font-size: 1.1rem;
  cursor: pointer; font-family: inherit; font-weight: 600;
  transition: background 0.15s;
}
.qv-btn-primary:hover:not(:disabled) { background: color-mix(in srgb, var(--qv-accent) 80%, var(--qv-bg)); }
.qv-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

.quiz-info {
  background: var(--qv-surface);
  border: 1px solid var(--qv-border);
  border-radius: var(--qv-radius);
  padding: 1.5rem;
  margin-bottom: 2rem;
}
</style>
