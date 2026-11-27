<template>
  <div class="podium-view">
    <div class="podium-view__rank">
      <p class="podium-view__medal">{{ medal }}</p>
      <p class="podium-view__name">{{ myEntry?.pseudo ?? '' }}</p>
      <p class="podium-view__score">{{ game.totalScore.toLocaleString() }} pts</p>
    </div>
    <div class="podium-view__fx">
      <FxPodium :podium="game.podium" :highlight-id="game.playerId" />
    </div>
    <Podium :podium="game.podium" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/game'
import { FxPodium, Podium } from '@hashquiz/ui'

const game = useGameStore()

const myEntry = computed(() =>
  game.podium.find(e => e.playerId === game.playerId)
)
const medal = computed(() => {
  const r = myEntry.value?.rank ?? 99
  return r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `#${r}`
})
</script>

<style scoped>
.podium-view { display: flex; flex-direction: column; gap: 1.5rem; }
.podium-view__rank { text-align: center; }
.podium-view__medal { font-size: 3.5rem; margin: 0; line-height: 1; }
.podium-view__name  { font-size: 1.3rem; font-weight: 700; margin: 0.5rem 0 0.25rem; }
.podium-view__score { color: var(--hq-accent); font-size: 1.5rem; font-weight: 700; margin: 0; }
.podium-view__fx { height: 22rem; }
</style>
