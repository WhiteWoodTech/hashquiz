<template>
  <canvas ref="canvasEl" class="qv-qr" />
</template>

<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import QRCode from 'qrcode'

const props = defineProps<{ value: string; size?: number }>()
const canvasEl = ref<HTMLCanvasElement>()

watchEffect(async () => {
  if (!canvasEl.value || !props.value) return
  const css = getComputedStyle(document.documentElement)
  const dark = css.getPropertyValue('--qv-qr-dark').trim()
  const light = css.getPropertyValue('--qv-qr-light').trim()
  await QRCode.toCanvas(canvasEl.value, props.value, {
    width: props.size ?? 200,
    margin: 1,
    color: { dark, light },
  })
})
</script>

<style scoped>
.qv-qr { border-radius: var(--qv-radius-sm); display: block; }
</style>
