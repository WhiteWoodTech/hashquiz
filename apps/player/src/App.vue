<template>
  <FxBackdrop />
  <BrandLogo />
  <div class="app">
    <template v-if="soloDeckId !== null">
      <SoloQuestionView v-if="solo.phase === 'question' || solo.phase === 'revealed'" />
      <SoloEndView      v-else-if="solo.phase === 'end'" />
      <SoloIntroView    v-else-if="soloReady" :key="soloDeckId" />
    </template>
    <template v-else>
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
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue'
import { BrandLogo, FxBackdrop } from '@hashquiz/ui'
import { useGameStore } from './stores/game'
import { useSoloStore, setSoloDeps } from './stores/solo'
import { parseSoloHash } from './solo/route'
import JoinView     from './views/JoinView.vue'
import LobbyView    from './views/LobbyView.vue'
import QuestionView from './views/QuestionView.vue'
import PodiumView   from './views/PodiumView.vue'

// Solo screens (and the deck list, decks.json) load only on a `#/solo/<deckId>` route.
const SoloIntroView    = defineAsyncComponent(() => import('./views/SoloIntroView.vue'))
const SoloQuestionView = defineAsyncComponent(() => import('./views/SoloQuestionView.vue'))
const SoloEndView      = defineAsyncComponent(() => import('./views/SoloEndView.vue'))

const game = useGameStore()
const solo = useSoloStore()
const soloDeckId = ref<string | null>(null)
const soloReady = ref(false)
let depsLoaded = false

/** Follows the hash; `reopen` restarts the current solo deck even when the hash is unchanged. */
async function syncRoute(reopen = false) {
  const deckId = parseSoloHash(location.hash)?.deckId ?? null
  if (deckId === soloDeckId.value && !reopen) return
  if (soloDeckId.value !== null) solo.abandon()
  soloDeckId.value = deckId
  soloReady.value = false
  if (deckId === null) return
  if (!depsLoaded) {
    const { defaultSoloDeps } = await import('./solo/deps')
    setSoloDeps(defaultSoloDeps())
    depsLoaded = true
  }
  if (soloDeckId.value !== deckId) return
  // open() sets the phase (`loading`) synchronously; the deck, then the leaderboard, fill in when they arrive.
  const opening = solo.open(deckId)
  soloReady.value = true
  await opening
}

// Leaving the page mid-run abandons it but keeps the solo route (blank until reopened, never the room
// JoinView); coming back from the back/forward cache reopens the deck on its intro screen.
function onPageHide() {
  if (soloDeckId.value === null) return
  solo.abandon()
  soloReady.value = false
}
function onPageShow(e: PageTransitionEvent) {
  if (e.persisted) void syncRoute(true)
}
const onHashChange = () => { void syncRoute() }

onMounted(() => {
  void syncRoute()
  window.addEventListener('hashchange', onHashChange)
  window.addEventListener('pagehide', onPageHide)
  window.addEventListener('pageshow', onPageShow)
})
onUnmounted(() => {
  window.removeEventListener('hashchange', onHashChange)
  window.removeEventListener('pagehide', onPageHide)
  window.removeEventListener('pageshow', onPageShow)
})

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
.app { position: relative; z-index: 1; min-height: 100vh; min-height: 100dvh; max-width: 480px; margin: 0 auto; padding: 2.5rem 1.25rem 1.25rem; }

.status-banner {
  position: sticky; top: 0; z-index: 10;
  margin: 0 -1.25rem 0.75rem;
  padding: 0.4rem 1rem;
  text-align: center;
  font-size: 0.85rem;
  font-weight: 500;
  border-bottom: 1px solid var(--hq-border);
}
.status-banner--connecting,
.status-banner--reconnecting {
  background: color-mix(in srgb, var(--hq-warn) 18%, transparent);
  color: var(--hq-warn);
}
.status-banner--offline {
  background: color-mix(in srgb, var(--hq-wrong) 18%, transparent);
  color: var(--hq-wrong);
}
.status-enter-active, .status-leave-active { transition: opacity 0.2s, transform 0.2s; }
.status-enter-from, .status-leave-to { opacity: 0; transform: translateY(-100%); }
</style>
