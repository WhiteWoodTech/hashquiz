<template>
  <div class="podium-view">
    <div class="podium-view__scene">
      <h1 class="hq-pixel">🏆 Game Over!</h1>
      <FxPodium :podium="game.podium" />
    </div>
    <aside class="podium-view__ranking">
      <Podium :podium="game.podium" />
      <div class="podium-view__actions">
        <button class="hq-btn-primary hq-press" @click="game.send('host_reset')">
          🔁 Rejouer
        </button>
        <button v-if="game.canGoToMenu" class="hq-btn-primary hq-btn-primary--ghost hq-press" @click="game.backToMenu()">
          🏠 Menu
        </button>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '../stores/game'
import { FxPodium, Podium } from '@hashquiz/ui'
const game = useGameStore()
</script>

<style scoped>
/* Full-screen: animated podium on the left, full ranking (+ Rejouer / Menu) on the right. */
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
.podium-view :deep(.hq-podium) {
  width: 100%;
  min-height: 0;
  max-height: 100%;
  flex: 0 1 auto;
  overflow: auto;
  gap: 1.2vmin;
  font-size: clamp(1rem, 2.6vmin, 1.8rem);
}
.podium-view :deep(.hq-podium__row) { padding: 1.6vmin 2vmin; }
.podium-view :deep(.hq-podium__rank) { font-size: 1.3em; min-width: 2.2em; }
.podium-view__actions { flex: none; display: flex; gap: 2vmin; width: min(100%, 28rem); }
.hq-btn-primary {
  flex: 1 1 0;
  padding: 1.6vmin 2vmin;
  background: var(--hq-accent); color: var(--hq-text);
  border: 2px solid var(--hq-accent); border-radius: var(--hq-radius); font-size: clamp(1rem, 2.4vmin, 1.6rem);
  cursor: pointer; font-family: var(--hq-font-pixel); font-weight: 700;
}
.hq-btn-primary:hover { background: color-mix(in srgb, var(--hq-accent) 80%, var(--hq-bg)); }
.hq-btn-primary--ghost { background: transparent; color: var(--hq-accent); }
.hq-btn-primary--ghost:hover { background: var(--hq-accent); color: var(--hq-text); }
.hq-btn-primary:focus-visible { outline: 2px solid var(--hq-text); outline-offset: 3px; }
</style>
