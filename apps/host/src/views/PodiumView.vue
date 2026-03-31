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
.podium-view { max-width: 640px; margin: 0 auto; }
h1 { font-size: 2rem; margin-bottom: 1.5rem; }
</style>
