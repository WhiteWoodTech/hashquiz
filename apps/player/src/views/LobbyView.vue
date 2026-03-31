<template>
  <div class="lobby">
    <div class="lobby__icon">⏳</div>
    <h2>Waiting for the host…</h2>
    <p class="lobby__count">{{ game.playerCount }} player{{ game.playerCount !== 1 ? 's' : '' }} connected</p>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '../stores/game'
const game = useGameStore()
</script>

<style scoped>
.lobby { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; text-align: center; gap: 0.75rem; }
.lobby__icon { font-size: 4rem; }
.lobby__count { color: var(--qv-text-muted); }
</style>
