<template>
  <div :class="['hq-players', { 'hq-players--end': align === 'end' }]">
    <div v-for="p in players" :key="p.id" class="hq-players__chip">
      <span class="hq-players__avatar">{{ initial(p.pseudo) }}</span>
      <span>{{ p.pseudo }}</span>
    </div>
    <div v-if="players.length === 0" class="hq-players__empty">
      Waiting for players…
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PlayerState } from '@hashquiz/core'
withDefaults(defineProps<{ players: PlayerState[]; align?: 'start' | 'end' }>(), { align: 'start' })
function initial(pseudo: string): string {
  return (pseudo[0] ?? '?').toUpperCase()
}
</script>

<style scoped>
.hq-players { display: flex; flex-wrap: wrap; gap: 0.5rem; min-height: 2.5rem; align-items: flex-start; }
.hq-players--end { justify-content: flex-end; text-align: right; }
.hq-players__chip { display: flex; align-items: center; gap: 0.45rem; background: var(--hq-surface-2); padding: 0.3rem 0.65rem; border-radius: 2rem; font-size: 0.9rem; }
.hq-players__avatar { width: 1.5rem; height: 1.5rem; background: var(--hq-accent); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.75rem; flex-shrink: 0; }
.hq-players__empty { color: var(--hq-text-muted); font-size: 0.9rem; }
</style>
