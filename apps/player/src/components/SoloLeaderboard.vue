<template>
  <section class="solo-board" aria-labelledby="solo-board-title">
    <h3 id="solo-board-title" class="solo-board__title qv-label">Classement</h3>
    <ol v-if="live.length || rows.length" class="solo-board__list">
      <li v-for="p in live" :key="'live-' + p.key" class="solo-board__row solo-board__row--live">
        <span class="solo-board__rank solo-board__dot" aria-hidden="true" />
        <span class="solo-board__name">{{ p.pseudo }}</span>
        <span class="solo-board__meta"><span class="solo-board__badge">en cours</span> · Q{{ Math.min(p.index + 1, p.total) }}/{{ p.total }}</span>
        <span class="solo-board__score">{{ p.score }}</span>
      </li>
      <li
        v-for="r in rows"
        :key="r.id"
        :class="['solo-board__row', { 'solo-board__row--mine': r.mine, 'solo-board__row--gap': r.mine && r.rank > rows.length }]"
        :aria-current="r.mine ? 'true' : undefined"
      >
        <span class="solo-board__rank">{{ r.rank }}</span>
        <span class="solo-board__name">{{ r.pseudo }}<span v-if="r.mine" class="qv-sr-only"> (vous)</span></span>
        <span class="solo-board__meta">{{ formatDuration(r.totalTimeMs) }}</span>
        <span class="solo-board__score">{{ r.score }}</span>
      </li>
    </ol>
    <p v-else class="solo-board__empty">Aucun score pour l'instant. Soyez le premier !</p>
  </section>
</template>

<script setup lang="ts">
import type { LivePlayer } from '../solo/live'
import type { BoardRow } from '../stores/solo'
import { formatDuration } from '../solo/format'

defineProps<{ live: LivePlayer[]; rows: BoardRow[] }>()
</script>

<style scoped>
.solo-board { width: 100%; display: flex; flex-direction: column; gap: 0.5rem; }
.solo-board__title { margin: 0; font-size: 0.8rem; color: var(--qv-text-muted); }
.solo-board__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
.solo-board__row {
  display: grid; grid-template-columns: 2rem 1fr auto 3.5rem; align-items: center; gap: 0.5rem;
  padding: 0.55rem 0.75rem; background: var(--qv-surface);
  border: 1px solid var(--qv-border); border-radius: var(--qv-radius-sm);
  font-size: 0.95rem;
}
.solo-board__row--live { border-style: dashed; }
.solo-board__row--mine {
  border-color: var(--qv-accent);
  background: color-mix(in srgb, var(--qv-accent) 18%, var(--qv-surface));
}
.solo-board__row--gap { margin-top: 0.5rem; }
.solo-board__rank { font-weight: 700; color: var(--qv-text-muted); }
.solo-board__badge { font-weight: 600; color: var(--qv-accent-2); }
.solo-board__dot::before {
  content: ''; display: block; width: 0.5rem; height: 0.5rem; border-radius: 50%;
  background: var(--qv-accent-2); animation: solo-pulse 1.6s ease-in-out infinite;
}
@keyframes solo-pulse { 50% { opacity: 0.3; } }
@media (prefers-reduced-motion: reduce) { .solo-board__dot::before { animation: none; } }
.solo-board__name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.solo-board__meta { font-size: 0.8rem; color: var(--qv-text-muted); font-variant-numeric: tabular-nums; }
.solo-board__score { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
.solo-board__empty { margin: 0; color: var(--qv-text-muted); font-size: 0.9rem; }
</style>
