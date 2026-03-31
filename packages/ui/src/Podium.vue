<template>
  <ol class="qv-podium">
    <li
      v-for="entry in podium"
      :key="entry.rank"
      :class="['qv-podium__row', rankClass(entry.rank)]"
    >
      <span class="qv-podium__rank">{{ medal(entry.rank) }}</span>
      <span class="qv-podium__name">{{ entry.pseudo }}</span>
      <span class="qv-podium__score">{{ entry.score.toLocaleString() }} pts</span>
    </li>
  </ol>
</template>

<script setup lang="ts">
import type { PodiumEntry } from '@quizv/core'
defineProps<{ podium: PodiumEntry[] }>()

function medal(rank: number): string {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`
}
function rankClass(rank: number): string {
  return rank <= 3 ? `qv-podium__row--top${rank}` : ''
}
</script>

<style scoped>
.qv-podium { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.qv-podium__row { display: flex; align-items: center; gap: 0.9rem; padding: 0.75rem 1rem; border-radius: var(--qv-radius-sm); background: var(--qv-surface); border: 1px solid transparent; }
.qv-podium__row--top1 { border-color: #ffd700; background: color-mix(in srgb, #ffd700 10%, var(--qv-surface)); }
.qv-podium__row--top2 { border-color: #c0c0c0; background: color-mix(in srgb, #c0c0c0 8%, var(--qv-surface)); }
.qv-podium__row--top3 { border-color: #cd7f32; background: color-mix(in srgb, #cd7f32 8%, var(--qv-surface)); }
.qv-podium__rank  { font-size: 1.3rem; min-width: 2.2rem; }
.qv-podium__name  { flex: 1; font-weight: 600; }
.qv-podium__score { font-weight: 700; color: var(--qv-accent); }
</style>
