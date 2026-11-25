<template>
  <button
    v-if="supported && !isFullscreen"
    type="button"
    class="fs-btn qv-label"
    @click="enter"
  >
    ⛶ Fullscreen
  </button>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const supported = typeof document !== 'undefined' && typeof document.documentElement.requestFullscreen === 'function'
const isFullscreen = ref(false)

function sync() {
  isFullscreen.value = document.fullscreenElement != null
}

function enter() {
  document.documentElement.requestFullscreen().catch(() => {
    // Refused (no user gesture, iframe policy…): the button simply stays visible.
  })
}

onMounted(() => {
  sync()
  document.addEventListener('fullscreenchange', sync)
})
onBeforeUnmount(() => document.removeEventListener('fullscreenchange', sync))
</script>

<style scoped>
.fs-btn {
  position: fixed;
  top: 1.5vmin;
  right: 1.5vmin;
  z-index: 50;
  padding: 0.6vmin 1.2vmin;
  font-size: clamp(0.65rem, 1.1vmin, 0.9rem);
  color: var(--qv-text-muted);
  background: transparent;
  border: 1px solid var(--qv-border);
  border-radius: var(--qv-radius-sm);
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s, color 0.2s;
}
.fs-btn:hover,
.fs-btn:focus-visible { opacity: 1; color: var(--qv-text); }
.fs-btn:focus-visible { outline: 2px solid var(--qv-accent); outline-offset: 2px; }
</style>
