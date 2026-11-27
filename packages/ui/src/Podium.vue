<template>
  <ol class="hq-podium">
    <li
      v-for="entry in podium"
      :key="entry.rank"
      :class="['hq-podium__row', rankClass(entry.rank)]"
    >
      <span class="hq-podium__rank">{{ medal(entry.rank) }}</span>
      <span class="hq-podium__name">{{ entry.pseudo }}</span>
      <span class="hq-podium__score">{{ entry.score.toLocaleString() }} pts</span>
    </li>
  </ol>
</template>

<script setup lang="ts">
import type { PodiumEntry } from '@hashquiz/core'
defineProps<{ podium: PodiumEntry[] }>()

function medal(rank: number): string {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`
}
function rankClass(rank: number): string {
  return rank <= 3 ? `hq-podium__row--top${rank}` : ''
}
</script>

<style scoped>
.hq-podium { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.hq-podium__row { display: flex; align-items: center; gap: 0.9rem; padding: 0.75rem 1rem; border-radius: var(--hq-radius-sm); background: var(--hq-surface); border: 1px solid transparent; }
.hq-podium__row--top1 { box-shadow: var(--hq-pixel) var(--hq-pixel) 0 var(--hq-accent-2); border-color: var(--hq-warn); background: color-mix(in srgb, var(--hq-warn) 10%, var(--hq-surface)); }
.hq-podium__row--top2 { border-color: var(--hq-text-muted); background: color-mix(in srgb, var(--hq-text-muted) 8%, var(--hq-surface)); }
.hq-podium__row--top3 { border-color: var(--hq-choice-c); background: color-mix(in srgb, var(--hq-choice-c) 8%, var(--hq-surface)); }
.hq-podium__rank  { font-size: 1.3rem; min-width: 2.2rem; }
.hq-podium__name  { flex: 1; font-weight: 600; }
.hq-podium__score { font-family: var(--hq-font-pixel); font-weight: 700; color: var(--hq-figure); }
</style>
