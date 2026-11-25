<template>
  <div class="podium-view">
    <div class="podium-view__scene">
      <h1>🏆 Game Over!</h1>
      <FxPodium :podium="game.podium" />
    </div>
    <aside class="podium-view__ranking">
      <Podium :podium="game.podium" />
      <button class="qv-btn-primary" @click="game.send('host_reset')">
        🔁 Rejouer
      </button>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '../stores/game'
import { FxPodium, Podium } from '@quizv/ui'
const game = useGameStore()
</script>

<style scoped>
/* Full-screen: animated podium on the left, full ranking (+ Rejouer) on the right. */
.podium-view {
  height: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(18rem, 30vw);
  overflow: hidden;
}
.podium-view__scene { position: relative; min-height: 0; }
h1 {
  position: absolute;
  top: 3vmin;
  left: 0;
  right: 0;
  z-index: 1;
  text-align: center;
  font-size: clamp(2rem, 7vmin, 5rem);
  margin: 0;
}
.podium-view__ranking {
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 2.4vmin;
  padding: 4vmin 3vmin;
}
.podium-view :deep(.qv-podium) {
  width: 100%;
  min-height: 0;
  max-height: 100%;
  flex: 0 1 auto;
  overflow: auto;
  gap: 1.2vmin;
  font-size: clamp(1rem, 2.6vmin, 1.8rem);
}
.podium-view :deep(.qv-podium__row) { padding: 1.6vmin 2vmin; }
.podium-view :deep(.qv-podium__rank) { font-size: 1.3em; min-width: 2.2em; }
.qv-btn-primary {
  flex: none;
  width: min(100%, 28rem); padding: 1.6vmin 2vmin;
  background: var(--qv-accent); color: var(--qv-text);
  border: none; border-radius: var(--qv-radius); font-size: clamp(1rem, 2.4vmin, 1.6rem);
  cursor: pointer; font-family: inherit; font-weight: 600;
  transition: background 0.15s;
}
.qv-btn-primary:hover { background: color-mix(in srgb, var(--qv-accent) 80%, var(--qv-bg)); }
.qv-btn-primary:focus-visible { outline: 2px solid var(--qv-text); outline-offset: 3px; }
</style>
