<template>
  <div class="lobby">
    <FxLobby class="lobby__fx" :players="game.players" />

    <div class="lobby__col lobby__col--left">
      <h1 class="lobby__title">QuizV</h1>

      <!-- Quiz info panel -->
      <QuizInfoPanel v-if="game.quizMeta" :quizInfo="game.quizMeta" :playerCount="game.players.length" class="quiz-info lobby__panel" />

      <div class="lobby__panel lobby__players">
        <PlayerList :players="game.players" aria-live="polite" />
      </div>
    </div>

    <div class="lobby__col lobby__col--center">
      <div class="lobby__count" :class="{ 'lobby__count--pop': popping }">
        <span class="lobby__count-num">{{ String(game.players.length).padStart(2, '0') }}</span>
        <span class="lobby__count-label qv-label">Joueurs</span>
      </div>
      <button
        class="qv-btn-primary"
        :disabled="game.players.length === 0"
        @click="game.send('host_start')"
      >
        ▶ Start Game
      </button>
    </div>

    <div class="lobby__col lobby__col--right">
      <div class="lobby__qr lobby__panel">
        <QrCode :value="qrUrl" :size="800" />
        <p class="lobby__url">{{ qrUrl }}</p>
      </div>

      <div class="lobby__code-box lobby__panel">
        <p class="lobby__code-label qv-label">Join code</p>
        <p class="lobby__code">{{ game.joinCode }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useGameStore } from '../stores/game'
import { FxLobby, QrCode, PlayerList, QuizInfoPanel } from '@quizv/ui'

const game = useGameStore()
const qrUrl = computed(() =>
  game.playerUrl || `${location.origin}/?code=${game.joinCode}`
)

// The counter grows briefly on every change.
const popping = ref(false)
let popTimer: ReturnType<typeof setTimeout> | null = null
watch(() => game.players.length, () => {
  popping.value = true
  if (popTimer) clearTimeout(popTimer)
  popTimer = setTimeout(() => { popping.value = false }, 160)
})
onBeforeUnmount(() => { if (popTimer) clearTimeout(popTimer) })
</script>

<style scoped>
.lobby {
  position: relative;
  height: 100%;
  display: grid;
  grid-template-columns: minmax(0, 29vw) minmax(0, 1fr) minmax(0, 24vw);
  gap: 3vmin;
  padding: 3vmin;
  overflow: hidden;
}
.lobby .lobby__fx { position: absolute; inset: 0; z-index: 0; }
.lobby__col {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 2vmin;
  min-height: 0;
}
.lobby__col--center { justify-content: flex-end; align-items: center; }
/* Leaves room for the fixed fullscreen button. */
.lobby__col--right { padding-top: 4vmin; justify-content: flex-start; }

.lobby__panel {
  background: color-mix(in srgb, var(--qv-surface) 82%, transparent);
  border: 1px solid var(--qv-border);
  border-radius: var(--qv-radius);
  backdrop-filter: blur(6px);
}

.lobby__title { font-size: clamp(2rem, 6vmin, 4.5rem); line-height: 1; color: var(--qv-accent); margin: 0; }

.quiz-info {
  padding: 2vmin;
  flex: 0 1 auto;
  min-height: 0;
  overflow: auto;
  gap: 1.4vmin;
}
.quiz-info :deep(.qip__title) { font-size: clamp(1.5rem, 4.4vmin, 3rem); }
.quiz-info :deep(.qip__description) { font-size: clamp(0.9rem, 2vmin, 1.25rem); }
.quiz-info :deep(.qip__metric strong) { font-size: clamp(1.25rem, 3.4vmin, 2rem); }

.lobby__players { flex: 1 1 0; min-height: 14vh; overflow: auto; padding: 1.6vmin; }

.lobby__count {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6vmin;
  transform-origin: 50% 70%;
  transition: transform 0.45s cubic-bezier(0.2, 0.9, 0.3, 1);
}
.lobby__count--pop { transform: scale(1.25); transition-duration: 0.12s; }
.lobby__count-num {
  font-family: var(--qv-font-display);
  font-weight: 300;
  font-size: clamp(3rem, 13vmin, 10rem);
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: var(--qv-text);
  /* Keeps the number legible over the constellation lines. */
  text-shadow: 0 0 1.5vmin var(--qv-bg), 0 0 3vmin var(--qv-bg);
}
.lobby__count-label { font-size: clamp(0.75rem, 1.8vmin, 1.2rem); color: var(--qv-text-muted); }
@media (prefers-reduced-motion: reduce) {
  .lobby__count, .lobby__count--pop { transform: none; transition: none; }
}

.lobby__qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.2vmin;
  padding: 2vmin;
  min-height: 0;
}
/* qrcode sets an inline 800px size on the canvas: override it to fit the column. */
.lobby__qr :deep(.qv-qr) { width: min(100%, 44vh) !important; height: auto !important; aspect-ratio: 1; image-rendering: pixelated; }
.lobby__url { margin: 0; font-size: clamp(0.75rem, 1.6vmin, 1.1rem); color: var(--qv-text-muted); word-break: break-all; text-align: center; }
.lobby__code-box { padding: 2vmin; text-align: center; }
.lobby__code-label { margin: 0; color: var(--qv-text-muted); font-size: clamp(0.75rem, 1.6vmin, 1rem); }
.lobby__code { margin: 0.6vmin 0 0; font-size: clamp(2rem, 7vmin, 5rem); font-weight: 700; letter-spacing: 0.2em; color: var(--qv-accent); line-height: 1.1; }
.qv-btn-primary {
  width: min(100%, 28rem); padding: 1.6vmin 2vmin;
  background: var(--qv-accent); color: var(--qv-text);
  border: none; border-radius: var(--qv-radius); font-size: clamp(1rem, 2.4vmin, 1.6rem);
  cursor: pointer; font-family: inherit; font-weight: 600;
  transition: background 0.15s;
}
.qv-btn-primary:hover:not(:disabled) { background: color-mix(in srgb, var(--qv-accent) 80%, var(--qv-bg)); }
.qv-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
.qv-btn-primary:focus-visible { outline: 2px solid var(--qv-text); outline-offset: 3px; }
</style>
