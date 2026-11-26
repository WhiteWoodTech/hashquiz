<template>
  <div class="solo-intro">
    <p v-if="solo.phase === 'unavailable' || !solo.deck" class="solo-intro__unavailable" role="status">
      Ce quiz n'est pas disponible en solo.
    </p>
    <template v-else>
      <QuizInfoPanel :quiz-info="info!" compact />

      <form class="solo-intro__form" @submit.prevent="solo.start(pseudo)">
        <label class="solo-label" for="solo-pseudo">Votre pseudo</label>
        <input
          id="solo-pseudo"
          v-model="pseudo"
          class="solo-input"
          autocomplete="nickname"
          required
          :maxlength="PSEUDO_MAX"
        />
        <button class="solo-btn" type="submit" :disabled="!pseudo.trim()">Commencer</button>
      </form>

      <SoloLeaderboard :live="solo.liveOthers" :rows="solo.board" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { QuizInfoPanel } from '@quizv/ui'
import { useSoloStore, PSEUDO_MAX } from '../stores/solo'
import { deckInfo } from '../solo/deck-info'
import SoloLeaderboard from '../components/SoloLeaderboard.vue'
import '../solo/solo.css'

const solo = useSoloStore()
const pseudo = ref(solo.pseudo)
const info = computed(() => (solo.deck ? deckInfo(solo.deck) : null))
</script>

<style scoped>
.solo-intro { display: flex; flex-direction: column; gap: 1.25rem; padding-top: 1rem; }
.solo-intro__form { display: flex; flex-direction: column; gap: 0.6rem; }
.solo-intro__unavailable { text-align: center; color: var(--qv-text-muted); padding-top: 3rem; font-size: 1.1rem; }
</style>
