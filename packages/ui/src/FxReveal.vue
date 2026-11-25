<template>
  <div class="fx-reveal" role="img" :aria-label="summary">
    <canvas ref="canvas" class="fx-reveal__canvas" aria-hidden="true" />
    <ul class="fx-reveal__labels" :style="{ gridTemplateColumns: `repeat(${choices.length}, minmax(0, 1fr))` }">
      <li
        v-for="(c, i) in choices"
        :key="c.id"
        class="fx-reveal__label"
        :class="{
          'fx-reveal__label--ok': revealed && isCorrect(c.id),
          'fx-reveal__label--dim': revealed && !isCorrect(c.id),
        }"
      >
        <span class="fx-reveal__letter" :style="{ color: `var(--qv-choice-${'abcd'[i % 4]})` }">{{ c.id.toUpperCase() }}</span>
        <span class="fx-reveal__text">{{ c.text }}</span>
        <span class="fx-reveal__votes">{{ counts[c.id] ?? 0 }} {{ (counts[c.id] ?? 0) === 1 ? 'vote' : 'votes' }}<span v-if="revealed && isCorrect(c.id)" class="fx-reveal__check"> ✓</span></span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { mountScene } from './fx/loop'
import { revealScene } from './fx/scenes/reveal'

const props = defineProps<{
  choices: { id: string; text: string }[]
  counts: Record<string, number>
  correctIds: string[]
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const revealed = ref(false)
let skipped = false
let handle: ReturnType<typeof mountScene> | null = null

const isCorrect = (id: string): boolean => props.correctIds.includes(id)

const summary = computed(() =>
  props.choices.map((c) => `${c.id.toUpperCase()}: ${props.counts[c.id] ?? 0}`).join(', '),
)

function restart(): void {
  skipped = false
  handle?.restart()
}

onMounted(() => {
  if (!canvas.value) return
  handle = mountScene(canvas.value, revealScene, () => ({
    counts: props.choices.map((c) => props.counts[c.id] ?? 0),
    correct: props.choices.flatMap((c, i) => (props.correctIds.includes(c.id) ? [i] : [])),
    skip: skipped,
    onPhase: (v: boolean) => {
      revealed.value = v
    },
  }))
})

// A new reveal (other correct answers or other votes) replays the sequence.
watch(
  () => [props.correctIds.join('|'), props.choices.map((c) => `${c.id}:${props.counts[c.id] ?? 0}`).join('|')],
  restart,
)

onBeforeUnmount(() => handle?.destroy())

defineExpose({
  /** Jumps to the final state (everything fallen, correct answers revealed). */
  skip(): void {
    skipped = true
  },
})
</script>

<style scoped>
.fx-reveal {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
}
.fx-reveal__canvas {
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  display: block;
}
.fx-reveal__labels {
  list-style: none;
  margin: 0 auto;
  padding: 0;
  width: 60%;
  display: grid;
  gap: 0.5vmin;
  flex: none;
}
.fx-reveal__label {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.2em;
  min-width: 0;
  opacity: 1;
  transition: opacity 0.7s ease;
}
.fx-reveal__label--dim { opacity: 0.4; }
.fx-reveal__letter {
  font-family: var(--qv-font-display);
  font-weight: 600;
  font-size: clamp(1.1rem, 3vmin, 2rem);
  line-height: 1;
}
.fx-reveal__text {
  font-family: var(--qv-font-display);
  color: var(--qv-text);
  font-size: clamp(0.85rem, 2.1vmin, 1.4rem);
  line-height: 1.2;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.fx-reveal__votes {
  color: var(--qv-text-muted);
  font-size: clamp(0.75rem, 1.7vmin, 1.1rem);
  font-variant-numeric: tabular-nums;
}
.fx-reveal__label--ok .fx-reveal__text,
.fx-reveal__check { color: var(--qv-correct); }
@media (prefers-reduced-motion: reduce) {
  .fx-reveal__label { transition: none; }
}
</style>
