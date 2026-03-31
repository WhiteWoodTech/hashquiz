<template>
  <div class="qv-players">
    <div v-for="p in players" :key="p.id" class="qv-players__chip">
      <span class="qv-players__avatar">{{ initial(p.pseudo) }}</span>
      <span>{{ p.pseudo }}</span>
    </div>
    <div v-if="players.length === 0" class="qv-players__empty">
      Waiting for players…
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PlayerState } from '@quizv/core'
defineProps<{ players: PlayerState[] }>()
function initial(pseudo: string): string {
  return (pseudo[0] ?? '?').toUpperCase()
}
</script>

<style scoped>
.qv-players { display: flex; flex-wrap: wrap; gap: 0.5rem; min-height: 2.5rem; align-items: flex-start; }
.qv-players__chip { display: flex; align-items: center; gap: 0.45rem; background: var(--qv-surface-2); padding: 0.3rem 0.65rem; border-radius: 2rem; font-size: 0.9rem; }
.qv-players__avatar { width: 1.5rem; height: 1.5rem; background: var(--qv-accent); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.75rem; flex-shrink: 0; }
.qv-players__empty { color: var(--qv-text-muted); font-size: 0.9rem; }
</style>
