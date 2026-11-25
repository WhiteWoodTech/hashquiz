<template>
  <div class="qv-chart">
    <div v-for="(choice, i) in choices" :key="choice.id" class="qv-chart__row">
      <span class="qv-chart__id">{{ choice.id.toUpperCase() }}</span>
      <div class="qv-chart__track">
        <div
          class="qv-chart__bar"
          :style="{ width: pct(choice.id) + '%', background: palette[i] }"
        />
      </div>
      <span class="qv-chart__count">{{ counts[choice.id] ?? 0 }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  choices: Array<{ id: string; text: string }>
  counts: Record<string, number>
  correctIds?: string[]
}>()

const palette = ['var(--qv-choice-a)', 'var(--qv-choice-b)', 'var(--qv-choice-c)', 'var(--qv-choice-d)']
const total = computed(() =>
  Object.values(props.counts).reduce((s, n) => s + n, 0)
)
function pct(id: string): number {
  return total.value > 0
    ? Math.round(((props.counts[id] ?? 0) / total.value) * 100)
    : 0
}
</script>

<style scoped>
.qv-chart { display: flex; flex-direction: column; gap: 0.6rem; }
.qv-chart__row { display: grid; grid-template-columns: 1.8rem 1fr 2.5rem; align-items: center; gap: 0.5rem; }
.qv-chart__id   { font-weight: 700; color: var(--qv-text-muted); font-size: 0.9rem; }
.qv-chart__track { height: 1.5rem; background: var(--qv-surface-2); border-radius: 4px; overflow: hidden; }
.qv-chart__bar  { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
.qv-chart__count { text-align: right; color: var(--qv-text-muted); font-size: 0.85rem; }
</style>
