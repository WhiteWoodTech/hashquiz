<template>
  <div class="fx-podium" role="img" :aria-label="summary">
    <canvas ref="canvas" class="fx-podium__canvas" aria-hidden="true" />
    <div
      v-for="(e, i) in top"
      :key="e.playerId"
      class="fx-podium__label"
      :class="{ 'fx-podium__label--on': shown[i], 'fx-podium__label--me': e.playerId === highlightId, 'fx-podium__label--first': i === 0 }"
      :style="{ left: `${PODIUM_SLOTS[i]! * 100}%` }"
    >
      <span class="fx-podium__name">{{ e.pseudo }}</span>
      <span class="fx-podium__score">{{ e.score.toLocaleString() }} pts</span>
    </div>
    <p v-if="outsideRank !== null" class="fx-podium__outside" :class="{ 'fx-podium__outside--on': shown[3] }">
      {{ outsideRank }}e / {{ podium.length }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PodiumEntry } from '@quizv/core'
import { mountScene } from './fx/loop'
import { PODIUM_SLOTS } from './fx/layout'
import { podiumScene } from './fx/scenes/podium'

const props = defineProps<{ podium: PodiumEntry[]; highlightId?: string }>()

const canvas = ref<HTMLCanvasElement | null>(null)
const shown = ref<boolean[]>([])
let handle: ReturnType<typeof mountScene> | null = null

const top = computed(() => props.podium.slice(0, 3))
const highlightIdx = computed(() => {
  const i = top.value.findIndex((e) => e.playerId === props.highlightId)
  return i >= 0 ? i : null
})
const outsideRank = computed<number | null>(() => {
  if (!props.highlightId || highlightIdx.value !== null) return null
  return props.podium.find((e) => e.playerId === props.highlightId)?.rank ?? null
})
const summary = computed(() => top.value.map((e) => `${e.rank}. ${e.pseudo} ${e.score}`).join(', '))

onMounted(() => {
  if (!canvas.value) return
  handle = mountScene(canvas.value, podiumScene, () => ({
    scores: top.value.map((e) => e.score),
    highlight: highlightIdx.value,
    outsideRank: outsideRank.value,
    onShown: (v: boolean[]) => {
      shown.value = v
    },
  }))
})

watch(
  () => props.podium.map((e) => `${e.playerId}:${e.score}`).join('|'),
  () => handle?.restart(),
)

onBeforeUnmount(() => handle?.destroy())
</script>

<style scoped>
.fx-podium {
  position: relative;
  width: 100%;
  height: 100%;
  container-type: size;
  pointer-events: none;
}
.fx-podium__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
.fx-podium__label {
  position: absolute;
  top: calc(74% + 2cqh);
  transform: translateX(-50%);
  width: 26cqw;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.2em;
  opacity: 0;
  transition: opacity 0.6s ease;
}
.fx-podium__label--on { opacity: 1; }
.fx-podium__name {
  font-family: var(--qv-font-display);
  font-size: clamp(1rem, 4cqh, 3.2rem);
  font-weight: 600;
  color: var(--qv-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fx-podium__label--first .fx-podium__name { font-size: clamp(1.15rem, 5cqh, 4rem); }
.fx-podium__score {
  font-size: clamp(0.85rem, 3cqh, 2.4rem);
  color: var(--qv-text-muted);
}
.fx-podium__label--me .fx-podium__name,
.fx-podium__label--me .fx-podium__score { color: var(--qv-accent); }
.fx-podium__outside {
  position: absolute;
  left: 50%;
  top: 5cqh;
  transform: translateX(-50%);
  margin: 0;
  font-family: var(--qv-font-display);
  font-size: clamp(1.2rem, 5cqh, 4rem);
  font-weight: 700;
  color: var(--qv-accent);
  opacity: 0;
  transition: opacity 0.6s ease;
}
.fx-podium__outside--on { opacity: 1; }
</style>
