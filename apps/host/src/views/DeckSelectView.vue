<template>
  <div class="deck-select">
    <h1>Pick a quiz</h1>
    <ul>
      <li v-for="deck in decks" :key="deck.id">
        <button class="qv-btn-primary" @click="pick(deck)">
          {{ deck.name }}
          <small>{{ deck.quiz.questions.length }} questions</small>
        </button>
      </li>
      <li v-if="decks.length === 0">
        No bundled decks found in <code>decks/</code>.
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '../stores/game'
import { bundledDecks, type BundledDeck } from '../decks'

const game = useGameStore()
const decks = bundledDecks

function pick(deck: BundledDeck) {
  game.startWithDeck(deck)
}
</script>

<style scoped>
.deck-select { max-width: 720px; margin: 0 auto; padding: 2rem; }
ul { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; }
button { width: 100%; text-align: left; display: flex; justify-content: space-between; }
small { color: var(--qv-text-muted); margin-left: 1rem; }
</style>
