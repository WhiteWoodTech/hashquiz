<template>
  <div class="diff-bar">
    <div class="diff-bar__track hq-steps">
      <div
        class="diff-bar__seg diff-bar__seg--easy"
        :style="{ width: distribution.easy + '%' }"
      />
      <div
        class="diff-bar__seg diff-bar__seg--medium"
        :style="{ width: distribution.medium + '%' }"
      />
      <div
        class="diff-bar__seg diff-bar__seg--hard"
        :style="{ width: distribution.hard + '%' }"
      />
    </div>
    <p class="diff-bar__legend">
      <span class="diff-bar__dot diff-bar__dot--easy" />easy {{ distribution.easy }}%
      <span class="diff-bar__dot diff-bar__dot--medium" />medium {{ distribution.medium }}%
      <span class="diff-bar__dot diff-bar__dot--hard" />hard {{ distribution.hard }}%
    </p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  distribution: { easy: number; medium: number; hard: number }
}>()
</script>

<style scoped>
.diff-bar__track { display: flex; height: 8px; border-radius: var(--hq-radius-sm); overflow: hidden; background: var(--hq-border); }
.diff-bar__seg { height: 100%; transition: width 0.4s ease; }
.diff-bar__seg--easy   { background: var(--hq-correct); }
.diff-bar__seg--medium { background: var(--hq-warn); }
.diff-bar__seg--hard   { background: var(--hq-wrong); }
.diff-bar__legend { margin: 0.4rem 0 0; font-size: 0.875rem; color: var(--hq-text-muted); display: flex; align-items: center; gap: 0.5rem; }
.diff-bar__dot { display: inline-block; width: 8px; height: 8px; border-radius: var(--hq-radius-sm); }
.diff-bar__dot--easy   { background: var(--hq-correct); }
.diff-bar__dot--medium { background: var(--hq-warn); }
.diff-bar__dot--hard   { background: var(--hq-wrong); }
</style>
