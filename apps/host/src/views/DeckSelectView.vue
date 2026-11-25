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
/* Full-screen: title then a grid of decks that fits the viewport. */
.deck-select {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 3vmin;
  padding: 5vmin 6vmin;
  overflow: hidden;
}
h1 { margin: 0; font-size: clamp(1.8rem, 6vmin, 4rem); }
ul {
  list-style: none; margin: 0; padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 24rem), 1fr));
  align-content: start;
  gap: 1.5vmin;
  min-height: 0;
  overflow: auto;
}
button {
  width: 100%; text-align: left; display: flex; justify-content: space-between; align-items: baseline;
  padding: 2vmin 2.4vmin; font-size: clamp(1rem, 2.2vmin, 1.5rem); font-family: inherit;
  color: var(--qv-text); background: var(--qv-surface-2);
  border: 1px solid var(--qv-border); border-radius: var(--qv-radius); cursor: pointer;
}
button:hover { background: var(--qv-surface); }
button:focus-visible { outline: 2px solid var(--qv-accent); outline-offset: 2px; }
small { color: var(--qv-text-muted); margin-left: 1rem; }
</style>
