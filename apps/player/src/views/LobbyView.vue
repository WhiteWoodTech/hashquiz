<template>
  <div class="lobby">
    <!-- Quiz info (when available) -->
    <template v-if="game.quizMeta">
      <QuizInfoPanel :quizInfo="game.quizMeta" :playerCount="game.playerCount" />
      <div class="lobby__divider" />
    </template>

    <!-- Waiting section -->
    <div class="lobby__wait">
      <div class="lobby__icon">⏳</div>
      <h2>Waiting for the host…</h2>
    </div>

    <!-- Room constellation: the player is the first, highlighted dot -->
    <FxLobby class="lobby__fx" :players="dots" :highlightId="'p0'" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/game'
import { FxLobby, QuizInfoPanel } from '@quizv/ui'
const game = useGameStore()
// The player only knows the head count: anonymous dots, 'p0' being themself.
const dots = computed(() =>
  Array.from({ length: Math.max(game.playerCount, 1) }, (_, i) => ({ id: 'p' + i })),
)
</script>

<style scoped>
.lobby {
  max-width: 480px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.lobby__divider { height: 1px; background: var(--qv-border); margin: 0.5rem 0; }

.lobby__wait { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; text-align: center; padding: 1rem 0; }
.lobby__icon { font-size: 2.5rem; }
.lobby .lobby__fx { height: clamp(180px, 32vh, 280px); }
</style>
