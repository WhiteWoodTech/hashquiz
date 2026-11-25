<template>
  <canvas ref="canvas" class="fx-backdrop" aria-hidden="true" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { mountScene } from './fx/loop'
import { backdropScene } from './fx/scenes/backdrop'

const canvas = ref<HTMLCanvasElement | null>(null)
let handle: ReturnType<typeof mountScene> | null = null

onMounted(() => {
  if (!canvas.value) return
  handle = mountScene(canvas.value, backdropScene, () => ({}))
})

onBeforeUnmount(() => handle?.destroy())
</script>

<style scoped>
/* Full-bleed behind every screen, whatever the content height or scroll. */
.fx-backdrop {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  z-index: 0;
  display: block;
  pointer-events: none;
}
</style>
