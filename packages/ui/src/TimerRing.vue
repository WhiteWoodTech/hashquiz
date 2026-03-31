<template>
  <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" aria-label="`${remaining} seconds remaining`">
    <!-- Background track -->
    <circle
      :cx="cx" :cy="cy" :r="r"
      fill="none"
      stroke="var(--qv-surface-2)"
      :stroke-width="sw"
    />
    <!-- Animated progress arc -->
    <circle
      :cx="cx" :cy="cy" :r="r"
      fill="none"
      :stroke="color"
      :stroke-width="sw"
      :stroke-dasharray="circum"
      :stroke-dashoffset="offset"
      stroke-linecap="round"
      :transform="`rotate(-90 ${cx} ${cy})`"
      style="transition: stroke-dashoffset 1s linear, stroke 0.4s ease"
    />
    <!-- Remaining seconds label -->
    <text
      :x="cx" :y="cy + size * 0.1"
      text-anchor="middle"
      :fill="color"
      :font-size="size * 0.3"
      font-weight="bold"
      font-family="inherit"
    >{{ remaining }}</text>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  total: number
  remaining: number
  size?: number
}>()

const size = computed(() => props.size ?? 120)
const sw = computed(() => size.value * 0.08)            // stroke width
const cx = computed(() => size.value / 2)
const cy = computed(() => size.value / 2)
const r  = computed(() => (size.value - sw.value) / 2)
const circum = computed(() => 2 * Math.PI * r.value)

const fraction = computed(() =>
  props.total > 0 ? Math.max(0, props.remaining) / props.total : 0
)
const offset = computed(() => circum.value * (1 - fraction.value))

const color = computed(() => {
  if (fraction.value > 0.5) return 'var(--qv-accent)'   // purple
  if (fraction.value > 0.25) return 'var(--qv-warn)'    // orange
  return 'var(--qv-wrong)'                               // red
})
</script>
