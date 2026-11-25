<template>
  <li class="deck-card">
    <button class="deck-card__btn" type="button" @click="emit('pick', deck)">
      <QuizInfoPanel :quizInfo="info" compact />
    </button>
  </li>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { QuizInfoPanel } from '@quizv/ui'
import type { BundledDeck } from '../decks'
import { deckInfo } from '../deck-browse'

const props = defineProps<{ deck: BundledDeck }>()
const emit = defineEmits<{ pick: [deck: BundledDeck] }>()
const info = computed(() => deckInfo(props.deck))
</script>

<style scoped>
.deck-card { display: flex; min-width: 0; }
.deck-card__btn {
  flex: 1;
  min-width: 0;
  padding: 0;
  text-align: left;
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  border-radius: var(--qv-radius);
  cursor: pointer;
}
.deck-card__btn :deep(.qip) { height: 100%; transition: border-color 0.15s, transform 0.15s; }
.deck-card__btn:hover :deep(.qip) { border-color: var(--qv-accent); transform: translateY(-2px); }
.deck-card__btn:focus-visible { outline: 2px solid var(--qv-accent); outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) {
  .deck-card__btn:hover :deep(.qip) { transform: none; }
}
</style>
