<template>
  <div class="app">
    <Transition name="status">
      <p
        v-if="game.phase !== 'join' && game.status !== 'connected'"
        class="status-banner"
        :class="`status-banner--${game.status}`"
      >
        {{ statusLabel }}
      </p>
    </Transition>
    <JoinView     v-if="game.phase === 'join'"      />
    <LobbyView    v-else-if="game.phase === 'lobby'"     />
    <QuestionView v-else-if="game.phase === 'question'"  />
    <PodiumView   v-else-if="game.phase === 'podium'"    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from './stores/game'
import JoinView     from './views/JoinView.vue'
import LobbyView    from './views/LobbyView.vue'
import QuestionView from './views/QuestionView.vue'
import PodiumView   from './views/PodiumView.vue'

const game = useGameStore()
const statusLabel = computed(() => {
  switch (game.status) {
    case 'connecting':   return 'Connexion…'
    case 'reconnecting': return 'Reconnexion…'
    case 'offline':      return 'Hors ligne'
    default:             return ''
  }
})
</script>

<style>
.app { min-height: 100vh; max-width: 480px; margin: 0 auto; padding: 1.25rem; }

.status-banner {
  position: sticky; top: 0; z-index: 10;
  margin: 0 -1.25rem 0.75rem;
  padding: 0.4rem 1rem;
  text-align: center;
  font-size: 0.85rem;
  font-weight: 500;
  border-bottom: 1px solid var(--qv-border);
}
.status-banner--connecting,
.status-banner--reconnecting {
  background: color-mix(in srgb, var(--qv-warn) 18%, transparent);
  color: var(--qv-warn);
}
.status-banner--offline {
  background: color-mix(in srgb, var(--qv-wrong) 18%, transparent);
  color: var(--qv-wrong);
}
.status-enter-active, .status-leave-active { transition: opacity 0.2s, transform 0.2s; }
.status-enter-from, .status-leave-to { opacity: 0; transform: translateY(-100%); }
</style>
