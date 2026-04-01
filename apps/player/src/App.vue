<template>
  <div class="app">
    <JoinView     v-if="game.phase === 'join'"      />
    <LobbyView    v-else-if="game.phase === 'lobby'"     />
    <QuestionView v-else-if="game.phase === 'question'"  />
    <PodiumView   v-else-if="game.phase === 'podium'"    />
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from './stores/game'
import JoinView     from './views/JoinView.vue'
import LobbyView    from './views/LobbyView.vue'
import QuestionView from './views/QuestionView.vue'
import PodiumView   from './views/PodiumView.vue'

const game = useGameStore()
</script>

<style>
.app { min-height: 100vh; max-width: 480px; margin: 0 auto; padding: 1.25rem; }
</style>
