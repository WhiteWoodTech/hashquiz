<template>
  <div class="fx-lobby">
    <canvas ref="canvas" class="fx-lobby__canvas" aria-hidden="true" />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { mountScene } from './fx/loop'
import { lobbyScene } from './fx/scenes/lobby'

const props = withDefaults(
  defineProps<{
    players: { id: string; pseudo?: string }[]
    highlightId?: string
    labels?: number
    spread?: number
  }>(),
  { labels: 8 },
)

const canvas = ref<HTMLCanvasElement | null>(null)
let handle: ReturnType<typeof mountScene> | null = null

onMounted(() => {
  if (!canvas.value) return
  handle = mountScene(canvas.value, lobbyScene, () => ({
    players: props.players,
    highlightId: props.highlightId,
    labels: props.labels,
    spread: props.spread,
  }))
})

onBeforeUnmount(() => handle?.destroy())
</script>

<style scoped>
.fx-lobby {
  position: relative;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.fx-lobby__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
