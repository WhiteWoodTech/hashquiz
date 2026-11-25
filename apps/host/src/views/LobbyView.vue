<template>
  <div class="lobby">
    <!-- Left side: constellation of half the players, their names at the bottom. -->
    <aside class="lobby__side lobby__side--left">
      <FxLobby class="lobby__fx" :players="leftPlayers" />
      <div class="lobby__bare lobby__players">
        <PlayerList :players="leftPlayers" aria-live="polite" />
      </div>
    </aside>

    <!-- Single central column: scrolls through three sections. -->
    <div class="lobby__col">
      <section class="lobby__section lobby__section--card">
        <h1 class="lobby__title">QuizV</h1>
        <QuizInfoPanel v-if="game.quizMeta" :quizInfo="game.quizMeta" :playerCount="game.players.length" class="quiz-info lobby__panel" />
      </section>

      <section class="lobby__section lobby__section--join">
        <a class="lobby__link lobby__bare" :href="qrUrl" target="_blank" rel="noopener">{{ qrUrl }}</a>
        <div class="lobby__code-box lobby__bare">
          <p class="lobby__code-label qv-label">Join code</p>
          <p class="lobby__code">{{ game.joinCode }}</p>
        </div>
        <div class="lobby__qr lobby__bare">
          <QrCode :value="qrUrl" :size="800" />
        </div>
      </section>

      <section class="lobby__section lobby__section--start">
        <div class="lobby__count" :class="{ 'lobby__count--pop': popping }">
          <span class="lobby__count-num">{{ String(game.players.length).padStart(2, '0') }}</span>
          <span class="lobby__count-label qv-label">Joueurs</span>
        </div>
        <button
          class="qv-btn-primary"
          :disabled="game.players.length === 0"
          @click="game.send('host_start')"
        >
          ▶ Start Game
        </button>
      </section>
    </div>

    <!-- Right side: the other half. -->
    <aside class="lobby__side lobby__side--right">
      <FxLobby class="lobby__fx" :players="rightPlayers" />
      <div class="lobby__bare lobby__players">
        <PlayerList :players="rightPlayers" aria-live="polite" />
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useGameStore } from '../stores/game'
import { FxLobby, QrCode, PlayerList, QuizInfoPanel } from '@quizv/ui'

const game = useGameStore()
const qrUrl = computed(() =>
  game.playerUrl || `${location.origin}/?code=${game.joinCode}`
)

// Players are split between the two side areas. A player keeps its side for its whole
// stay; each arrival goes to the side with fewer players.
const sideOf = new Map<string, 'l' | 'r'>()
const split = computed(() => {
  const present = new Set(game.players.map((p) => p.id))
  for (const id of [...sideOf.keys()]) if (!present.has(id)) sideOf.delete(id)
  let l = 0
  let r = 0
  for (const v of sideOf.values()) v === 'l' ? l++ : r++
  for (const p of game.players) {
    if (sideOf.has(p.id)) continue
    const side = l <= r ? 'l' : 'r'
    sideOf.set(p.id, side)
    side === 'l' ? l++ : r++
  }
  return {
    left: game.players.filter((p) => sideOf.get(p.id) === 'l'),
    right: game.players.filter((p) => sideOf.get(p.id) === 'r'),
  }
})
const leftPlayers = computed(() => split.value.left)
const rightPlayers = computed(() => split.value.right)

// The counter grows briefly on every change.
const popping = ref(false)
let popTimer: ReturnType<typeof setTimeout> | null = null
watch(() => game.players.length, () => {
  popping.value = true
  if (popTimer) clearTimeout(popTimer)
  popTimer = setTimeout(() => { popping.value = false }, 160)
})
onBeforeUnmount(() => { if (popTimer) clearTimeout(popTimer) })
</script>

<style scoped>
.lobby {
  position: relative;
  height: 100%;
  display: grid;
  /* Side areas around one centred column. */
  grid-template-columns: minmax(0, 1fr) minmax(0, min(48rem, 56vw)) minmax(0, 1fr);
  overflow: hidden;
}

/* Side areas: constellation on top, names at the bottom. */
.lobby__side {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 3vmin;
  gap: 2vmin;
}
.lobby__side .lobby__fx { flex: 1 1 0; min-height: 0; }
.lobby__players { flex: 0 1 auto; max-height: 40%; overflow: auto; padding: 1.2vmin; }
.lobby__side :deep(.qv-players) { gap: 0.4rem; }
.lobby__side :deep(.qv-players__chip) { font-size: clamp(0.7rem, 1.6vmin, 1rem); padding: 0.2rem 0.5rem; }

/* Central column: first screen is the quiz card, then the join info, then the start. */
.lobby__col {
  min-height: 0;
  overflow-y: auto;
  scroll-snap-type: y proximity;
  scrollbar-width: none;
}
.lobby__col::-webkit-scrollbar { display: none; }
.lobby__section {
  min-height: 100%;
  scroll-snap-align: start;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3vmin;
  padding: 4vmin 1vmin;
}
.lobby__section--card { justify-content: flex-start; align-items: stretch; }
.lobby__section--start { min-height: 60%; }

.lobby__panel {
  background: color-mix(in srgb, var(--qv-surface) 82%, transparent);
  border: 1px solid var(--qv-border);
  border-radius: var(--qv-radius);
  backdrop-filter: blur(6px);
}
/* Names, QR and join code sit directly on the backdrop: a halo of the page
   background keeps their text legible over dust and lines. */
.lobby__bare { text-shadow: 0 0 1vmin var(--qv-bg), 0 0 2vmin var(--qv-bg); }

.lobby__title { font-size: clamp(2rem, 6vmin, 4.5rem); line-height: 1; color: var(--qv-accent); margin: 0; text-align: center; }

.quiz-info {
  padding: 3vmin;
  flex: 1 1 auto;
  justify-content: center;
  gap: 2vmin;
}
.quiz-info :deep(.qip__title) { font-size: clamp(1.75rem, 5vmin, 3.5rem); }
.quiz-info :deep(.qip__description) { font-size: clamp(1rem, 2.4vmin, 1.5rem); }
.quiz-info :deep(.qip__metric strong) { font-size: clamp(1.25rem, 3.4vmin, 2.2rem); }

.lobby__link {
  font-size: clamp(1rem, 2.6vmin, 1.8rem);
  color: var(--qv-accent);
  word-break: break-all;
  text-align: center;
}
.lobby__link:hover { text-decoration: underline; }
.lobby__code-box { text-align: center; }
.lobby__code-label { margin: 0; color: var(--qv-text-muted); font-size: clamp(0.75rem, 1.8vmin, 1.1rem); }
.lobby__code { margin: 0.6vmin 0 0; font-size: clamp(2.5rem, 10vmin, 7rem); font-weight: 700; letter-spacing: 0.2em; color: var(--qv-accent); line-height: 1.1; }
.lobby__qr { display: flex; justify-content: center; width: 100%; }
/* qrcode sets an inline 800px size on the canvas: override it to fit the column. */
.lobby__qr :deep(.qv-qr) { width: min(100%, 48vh) !important; height: auto !important; aspect-ratio: 1; image-rendering: pixelated; }

.lobby__count {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6vmin;
  transform-origin: 50% 70%;
  transition: transform 0.45s cubic-bezier(0.2, 0.9, 0.3, 1);
}
.lobby__count--pop { transform: scale(1.25); transition-duration: 0.12s; }
.lobby__count-num {
  font-family: var(--qv-font-display);
  font-weight: 300;
  font-size: clamp(3rem, 16vmin, 12rem);
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: var(--qv-text);
  text-shadow: 0 0 1.5vmin var(--qv-bg), 0 0 3vmin var(--qv-bg);
}
.lobby__count-label { font-size: clamp(0.75rem, 1.8vmin, 1.2rem); color: var(--qv-text-muted); }
@media (prefers-reduced-motion: reduce) {
  .lobby__count, .lobby__count--pop { transform: none; transition: none; }
  .lobby__col { scroll-behavior: auto; }
}

.qv-btn-primary {
  width: min(100%, 28rem); padding: 1.6vmin 2vmin;
  background: var(--qv-accent); color: var(--qv-text);
  border: none; border-radius: var(--qv-radius); font-size: clamp(1rem, 2.4vmin, 1.6rem);
  cursor: pointer; font-family: inherit; font-weight: 600;
  transition: background 0.15s;
}
.qv-btn-primary:hover:not(:disabled) { background: color-mix(in srgb, var(--qv-accent) 80%, var(--qv-bg)); }
.qv-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
.qv-btn-primary:focus-visible { outline: 2px solid var(--qv-text); outline-offset: 3px; }
</style>
