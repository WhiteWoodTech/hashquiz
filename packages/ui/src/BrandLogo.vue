<template>
  <span :class="['qv-logo', { 'qv-logo--center': centered }]" aria-label="QuizV">QuizV</span>
</template>

<script setup lang="ts">
/** QuizV wordmark. Corner (default): fixed top left, grey and discreet like the fullscreen button. */
defineProps<{ centered?: boolean }>()
</script>

<style scoped>
.qv-logo {
  position: fixed;
  top: 1.5vmin;
  left: 1.5vmin;
  z-index: 50;
  font-size: clamp(0.9rem, 2vmin, 1.5rem);
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1;
  color: var(--qv-text-muted);
  opacity: 0.7;
  pointer-events: none;
}
/* Centered variant: a large accent wordmark in the page flow. */
.qv-logo--center {
  position: static;
  display: block;
  text-align: center;
  font-size: clamp(2rem, 6vmin, 4.5rem);
  color: var(--qv-accent);
  opacity: 1;
  pointer-events: auto;
}
</style>
