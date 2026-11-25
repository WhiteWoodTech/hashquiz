<template>
  <div class="app">
    <FullscreenButton />
    <DeckSelectView v-if="game.phase === 'deck-select'" />
    <LobbyView    v-else-if="game.phase === 'lobby'"     />
    <QuestionView v-else-if="game.phase === 'question'" />
    <RevealView   v-else-if="game.phase === 'revealed'" />
    <PodiumView   v-else-if="game.phase === 'finished'" />
    <div v-else class="connecting">
      <p>Connecting to server…</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { useGameStore } from './stores/game'
import DeckSelectView from './views/DeckSelectView.vue'
import LobbyView    from './views/LobbyView.vue'
import QuestionView from './views/QuestionView.vue'
import RevealView   from './views/RevealView.vue'
import PodiumView   from './views/PodiumView.vue'
import FullscreenButton from './components/FullscreenButton.vue'

const game = useGameStore()
onMounted(() => game.connect())
onBeforeUnmount(() => game.disposeSession?.())
</script>

<style>
.app { height: 100vh; overflow: hidden; padding: 0; }
.connecting { display: flex; align-items: center; justify-content: center; height: 100vh; color: var(--qv-text-muted); }
</style>
