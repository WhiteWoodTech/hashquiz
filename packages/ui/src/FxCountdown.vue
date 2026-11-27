<template>
  <div
    class="fx-countdown"
    :class="[`fx-countdown--${size ?? 'compact'}`, { 'fx-countdown--danger': state.danger }]"
    role="timer"
    aria-live="off"
    :aria-label="`${remaining.toFixed(1)} seconds remaining`"
  >
    <canvas ref="canvas" class="fx-countdown__canvas" aria-hidden="true" />
    <span class="fx-countdown__num" aria-hidden="true">{{ state.seconds }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { mountScene } from './fx/loop'
import { countdownState } from './fx/layout'
import { countdownScene } from './fx/scenes/countdown'

const props = defineProps<{
  total: number
  remaining: number
  size?: 'compact' | 'large'
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const state = computed(() => countdownState(props.remaining, props.total))
let handle: ReturnType<typeof mountScene> | null = null

onMounted(() => {
  if (!canvas.value) return
  handle = mountScene(canvas.value, countdownScene, () => ({
    total: props.total,
    remaining: props.remaining,
  }))
})

// A new question (different duration) rebuilds the ring.
watch(() => props.total, () => handle?.restart())

onBeforeUnmount(() => handle?.destroy())
</script>

<style scoped>
.fx-countdown {
  position: relative;
  display: grid;
  place-items: center;
  flex: none;
}
/* Capped so the host question view (progress, question, choices, controls) fits in 100vh. */
.fx-countdown--large {
  width: min(38vmin, 32vw);
  height: min(38vmin, 32vw);
}
.fx-countdown--compact {
  width: 140px;
  height: 140px;
}
.fx-countdown__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.fx-countdown__num {
  position: relative;
  font-family: var(--hq-font-display);
  font-weight: 300;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: var(--hq-text);
  transition: color 0.3s ease;
}
.fx-countdown--large .fx-countdown__num { font-size: min(12vmin, 10vw); }
.fx-countdown--compact .fx-countdown__num { font-size: 52px; }
.fx-countdown--danger .fx-countdown__num { color: var(--hq-wrong); }
</style>
