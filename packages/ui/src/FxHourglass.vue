<template>
  <canvas ref="canvas" class="fx-hourglass" aria-hidden="true" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { mountScene } from './fx/loop'
import { hourglassScene } from './fx/scenes/hourglass'

const canvas = ref<HTMLCanvasElement | null>(null)
let handle: ReturnType<typeof mountScene> | null = null

onMounted(() => {
  if (canvas.value) handle = mountScene(canvas.value, hourglassScene, () => ({}))
})
onBeforeUnmount(() => handle?.destroy())
</script>

<style scoped>
.fx-hourglass {
  display: block;
  width: 56px;
  height: 80px;
  pointer-events: none;
}
</style>
