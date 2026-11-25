<template>
  <div class="podium-view">
    <div class="podium-view__scene">
      <h1>🏆 Game Over!</h1>
      <FxPodium :podium="game.podium" />
    </div>
    <aside class="podium-view__ranking">
      <Podium :podium="game.podium" />
    </aside>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '../stores/game'
import { FxPodium, Podium } from '@quizv/ui'
const game = useGameStore()
</script>

<style scoped>
/* Full-screen: animated podium on the left, full ranking on the right. */
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
  align-items: center;
  padding: 4vmin 3vmin;
}
.podium-view :deep(.qv-podium) {
  width: 100%;
  max-height: 100%;
  overflow: auto;
  gap: 1.2vmin;
  font-size: clamp(1rem, 2.6vmin, 1.8rem);
}
.podium-view :deep(.qv-podium__row) { padding: 1.6vmin 2vmin; }
.podium-view :deep(.qv-podium__rank) { font-size: 1.3em; min-width: 2.2em; }
</style>
