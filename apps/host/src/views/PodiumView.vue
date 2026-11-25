<template>
  <div class="podium-view">
    <h1>🏆 Game Over!</h1>
    <Podium :podium="game.podium" />
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '../stores/game'
import { Podium } from '@quizv/ui'
const game = useGameStore()
</script>

<style scoped>
/* Full-screen, centered column. */
.podium-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4vmin;
  padding: 4vmin;
  overflow: hidden;
}
h1 { font-size: clamp(2rem, 7vmin, 5rem); margin: 0; }
.podium-view :deep(.qv-podium) {
  width: min(100%, 70vmin);
  min-height: 0;
  overflow: auto;
  gap: 1.5vmin;
  font-size: clamp(1rem, 3vmin, 2rem);
}
.podium-view :deep(.qv-podium__row) { padding: 2vmin 2.4vmin; }
.podium-view :deep(.qv-podium__rank) { font-size: 1.3em; min-width: 2.2em; }
</style>
