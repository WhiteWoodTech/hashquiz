<template>
  <canvas ref="canvas" class="fx-verdict" aria-hidden="true" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { mountScene } from './fx/loop'
import { verdictScene } from './fx/scenes/verdict'

const props = defineProps<{
  correct: boolean
  delta: number
  answered: boolean
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
let handle: ReturnType<typeof mountScene> | null = null

onMounted(() => {
  if (!canvas.value) return
  handle = mountScene(canvas.value, verdictScene, () => ({
    correct: props.correct,
    delta: props.delta,
    answered: props.answered,
  }))
})

watch(() => props.correct, () => handle?.restart())

onBeforeUnmount(() => handle?.destroy())
</script>

<style scoped>
.fx-verdict {
  display: block;
  width: 100%;
  height: 84px;
  pointer-events: none;
}
</style>
