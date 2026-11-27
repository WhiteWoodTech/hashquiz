<template>
  <section v-if="decks.length" class="solo-catalog" aria-labelledby="solo-catalog-title">
    <h2 id="solo-catalog-title" class="solo-catalog__title">Ou jouez en solo</h2>
    <ul class="solo-catalog__list">
      <li v-for="deck in decks" :key="deck.id">
        <a
          class="solo-catalog__card"
          :href="soloHash(deck.id)"
          :aria-label="`Jouer en solo : ${deck.info.title}`"
        >
          <QuizInfoPanel :quiz-info="deck.info" compact />
        </a>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { onMounted, shallowRef } from 'vue'
import { QuizInfoPanel } from '@hashquiz/ui'
import type { QuizInfo } from '@hashquiz/core'
import { deckInfo } from '@hashquiz/core/decks'
import { loadSoloDecks } from '../solo/decks'
import { soloHash } from '../solo/route'

// Filled once decks.json is loaded; the section stays hidden while loading, on error or without solo decks.
const decks = shallowRef<{ id: string; info: QuizInfo }[]>([])
onMounted(async () => {
  try {
    decks.value = (await loadSoloDecks()).map(d => ({ id: d.id, info: deckInfo(d) }))
  } catch (e) {
    console.error('Solo quizzes unavailable:', e)
  }
})
</script>

<style scoped>
.solo-catalog { width: 100%; margin-top: 2.5rem; }
.solo-catalog__title {
  margin: 0 0 1rem;
  font-size: 1rem;
  font-weight: 600;
  text-align: center;
  color: var(--hq-text-muted);
}
.solo-catalog__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; }
.solo-catalog__card {
  display: block;
  color: inherit;
  text-decoration: none;
  border-radius: var(--hq-radius);
}
.solo-catalog__card :deep(.qip) { transition: border-color 0.15s, transform 0.15s; }
.solo-catalog__card:hover :deep(.qip) { border-color: var(--hq-accent); transform: translateY(-2px); }
.solo-catalog__card:focus-visible { outline: 2px solid var(--hq-accent); outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) {
  .solo-catalog__card:hover :deep(.qip) { transform: none; }
}
</style>
