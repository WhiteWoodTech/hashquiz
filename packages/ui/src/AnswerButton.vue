<template>
  <button
    :class="['qv-btn', `qv-btn--${colorId}`, `qv-btn--${state}`]"
    :disabled="state !== 'idle' && state !== 'selected'"
    @click="emit('select', id)"
  >
    <span class="qv-btn__badge">{{ id.toUpperCase() }}</span>
    <span class="qv-btn__text">{{ text }}</span>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  id: string
  text: string
  state: 'idle' | 'selected' | 'correct' | 'wrong' | 'disabled'
  colorId: 'a' | 'b' | 'c' | 'd'
}>()
const emit = defineEmits<{ select: [id: string] }>()
</script>

<style scoped>
.qv-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.85rem 1rem;
  border: 2px solid transparent;
  border-radius: var(--qv-radius);
  background: var(--qv-surface-2);
  color: var(--qv-text);
  font-size: 1rem;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, opacity 0.15s;
  text-align: left;
}
.qv-btn--a { --c: var(--qv-choice-a); }
.qv-btn--b { --c: var(--qv-choice-b); }
.qv-btn--c { --c: var(--qv-choice-c); }
.qv-btn--d { --c: var(--qv-choice-d); }

@media (hover: hover) {
  .qv-btn:not(:disabled):hover    { border-color: var(--c); }
}
.qv-btn--selected                  { border-color: var(--c); background: color-mix(in srgb, var(--c) 18%, var(--qv-surface-2)); }
.qv-btn--correct                   { border-color: var(--qv-correct); background: color-mix(in srgb, var(--qv-correct) 18%, var(--qv-surface-2)); }
.qv-btn--wrong                     { border-color: var(--qv-wrong); background: color-mix(in srgb, var(--qv-wrong) 12%, var(--qv-surface-2)); opacity: 0.65; }
.qv-btn--disabled                  { opacity: 0.45; cursor: not-allowed; }

.qv-btn__badge {
  min-width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--c);
  color: var(--qv-text);
  border-radius: 6px;
  font-weight: 700;
  font-size: 0.9rem;
  flex-shrink: 0;
}
</style>
