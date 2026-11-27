<template>
  <div class="feedback">
    <div v-if="game.lastDelta > 0" class="feedback__correct">
      <p class="feedback__icon">✓</p>
      <p class="feedback__delta">+{{ game.lastDelta }} pts</p>
    </div>
    <div v-else class="feedback__wrong">
      <p class="feedback__icon">✗</p>
      <p class="feedback__delta">+0 pts</p>
    </div>
    <p class="feedback__total">Total: <strong>{{ game.totalScore }} pts</strong></p>
    <p class="feedback__wait">Waiting for next question…</p>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '../stores/game'
const game = useGameStore()
</script>

<style scoped>
.feedback { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; text-align: center; gap: 0.75rem; }
.feedback__icon   { font-size: 5rem; margin: 0; line-height: 1; }
.feedback__delta  { font-family: var(--hq-font-pixel); font-size: 2rem; font-weight: 700; margin: 0; }
.feedback__correct .feedback__icon  { color: var(--hq-correct); }
.feedback__correct .feedback__delta { color: var(--hq-correct); }
.feedback__wrong .feedback__icon    { color: var(--hq-wrong); }
.feedback__wrong .feedback__delta   { color: var(--hq-text-muted); }
.feedback__total { color: var(--hq-text-muted); margin: 0; }
.feedback__wait  { font-size: 0.85rem; color: var(--hq-text-muted); margin-top: 1rem; }
</style>
