<template>
  <div class="solo-end">
    <div class="solo-end__summary">
      <p class="solo-end__name">{{ solo.pseudo }}</p>
      <p class="solo-end__score">{{ solo.score.toLocaleString('fr-FR') }} pts</p>
      <p class="solo-end__meta">
        {{ solo.correctCount }}/{{ solo.total }} bonnes réponses · {{ formatDuration(solo.totalTimeMs) }}
      </p>
      <p v-if="solo.myRank !== null" class="solo-end__rank">
        #{{ solo.myRank }}<template v-if="solo.runCount !== null"> sur {{ solo.runCount }}</template>
      </p>
    </div>

    <div class="solo-end__status" role="status">
      <template v-if="solo.submitState === 'saving'">Enregistrement du score…</template>
      <button v-else-if="solo.submitState === 'error'" class="solo-end__retry" @click="solo.retrySubmit()">
        Score non enregistré — réessayer
      </button>
      <template v-else-if="solo.submitState === 'stale'">
        Score non enregistré : ce quiz a été mis à jour. Rejouez pour utiliser la nouvelle version.
      </template>
    </div>

    <button class="solo-btn hq-press" @click="solo.playAgain()">Rejouer</button>

    <SoloLeaderboard :live="solo.liveOthers" :rows="solo.board" />

    <LeadForm />
  </div>
</template>

<script setup lang="ts">
import { useSoloStore } from '../stores/solo'
import { formatDuration } from '../solo/format'
import SoloLeaderboard from '../components/SoloLeaderboard.vue'
import LeadForm from '../components/LeadForm.vue'
import '../solo/solo.css'

const solo = useSoloStore()
</script>

<style scoped>
.solo-end { display: flex; flex-direction: column; align-items: center; gap: 1.25rem; padding-top: 1rem; }
.solo-end__summary { text-align: center; }
.solo-end__name  { font-size: 1.3rem; font-weight: 700; margin: 0 0 0.25rem; }
.solo-end__score { font-family: var(--hq-font-pixel); color: var(--hq-figure); font-size: 2rem; font-weight: 700; margin: 0; }
.solo-end__meta  { color: var(--hq-text-muted); margin: 0.35rem 0 0; font-variant-numeric: tabular-nums; }
.solo-end__rank  { font-size: 1.15rem; font-weight: 700; margin: 0.5rem 0 0; }
.solo-end__status { margin: 0; font-size: 0.9rem; color: var(--hq-text-muted); }
.solo-end__status:empty { display: none; }
.solo-end__retry {
  background: none; border: none; padding: 0.25rem; font-family: inherit;
  color: var(--hq-wrong); text-decoration: underline; cursor: pointer;
}
</style>
