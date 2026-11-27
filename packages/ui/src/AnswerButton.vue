<template>
  <button
    :class="['hq-btn', `hq-btn--${colorId}`, `hq-btn--${state}`]"
    :disabled="state !== 'idle' && state !== 'selected'"
    @click="emit('select', id)"
  >
    <span class="hq-btn__badge">{{ id.toUpperCase() }}</span>
    <span class="hq-btn__text">{{ text }}</span>
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
.hq-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.85rem 1rem;
  border: 2px solid transparent;
  border-radius: var(--hq-radius);
  background: var(--hq-surface-2);
  color: var(--hq-text);
  font-size: 1rem;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, opacity 0.15s;
  text-align: left;
}
.hq-btn--a { --c: var(--hq-choice-a); }
.hq-btn--b { --c: var(--hq-choice-b); }
.hq-btn--c { --c: var(--hq-choice-c); }
.hq-btn--d { --c: var(--hq-choice-d); }

@media (hover: hover) {
  .hq-btn:not(:disabled):hover    { border-color: var(--c); }
}
.hq-btn--selected                  { border-color: var(--c); background: color-mix(in srgb, var(--c) 18%, var(--hq-surface-2)); }
.hq-btn--correct                   { border-color: var(--hq-correct); background: color-mix(in srgb, var(--hq-correct) 18%, var(--hq-surface-2)); }
.hq-btn--wrong                     { border-color: var(--hq-wrong); background: color-mix(in srgb, var(--hq-wrong) 12%, var(--hq-surface-2)); opacity: 0.65; }
.hq-btn--disabled                  { opacity: 0.45; cursor: not-allowed; }

.hq-btn__badge {
  min-width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--c);
  color: var(--hq-text);
  border-radius: 6px;
  font-weight: 700;
  font-size: 0.9rem;
  flex-shrink: 0;
}
</style>
