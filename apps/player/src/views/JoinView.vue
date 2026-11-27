<template>
  <div class="join">
    <p class="join__sub">Enter the game code to join</p>

    <div class="join__form">
      <input
        v-model="code"
        class="hq-input"
        placeholder="Game code (e.g. ABC123)"
        style="text-transform:uppercase;letter-spacing:0.12em"
        maxlength="8"
      />
      <input v-model="pseudo" class="hq-input" placeholder="Your name" maxlength="20" />
      <input v-model="email"  class="hq-input" type="email" placeholder="Email (optional)" />

      <p v-if="game.connectError" class="join__error">{{ game.connectError }}</p>

      <button class="hq-btn-primary hq-press" :disabled="!code.trim() || !pseudo.trim()" @click="joinGame">
        Join Game
      </button>
    </div>

    <SoloCatalog v-if="soloEnabled" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, defineAsyncComponent } from 'vue'
import { useGameStore } from '../stores/game'
import { soloAvailable } from '@hashquiz/core'
import { config } from '../config'

// The solo list (and the deck bundle it needs) loads in its own chunk, only when solo can work.
const SoloCatalog = defineAsyncComponent(() => import('../components/SoloCatalog.vue'))
const soloEnabled = soloAvailable(config)

const game = useGameStore()
const code   = ref('')
const pseudo = ref('')
const email  = ref('')

onMounted(() => {
  const param = new URLSearchParams(location.search).get('code')
  if (param) code.value = param.toUpperCase()
  // Auto-rejoin if a persisted session exists for this code (sessionStorage survives reload and screen-lock)
  try {
    const raw = sessionStorage.getItem('hashquiz:player-session')
    if (raw && code.value) {
      const s = JSON.parse(raw) as { code: string; pseudo: string; email: string }
      if (s.code === code.value) {
        pseudo.value = s.pseudo
        email.value  = s.email
        game.connect(code.value, s.pseudo, s.email)
      }
    }
  } catch { /* ignore */ }
})

function joinGame() {
  game.connect(code.value.trim().toUpperCase(), pseudo.value.trim(), email.value.trim())
}
</script>

<style scoped>
.join { display: flex; flex-direction: column; align-items: center; padding-top: 2rem; }
.join__sub   { color: var(--hq-text-muted); margin: 0.5rem 0 2rem; }
.join__form  { width: 100%; display: flex; flex-direction: column; gap: 0.75rem; }
.join__error { color: var(--hq-wrong); font-size: 0.9rem; margin: 0; }
.hq-input {
  width: 100%; padding: 0.85rem; background: var(--hq-surface);
  border: 1px solid var(--hq-border); border-radius: var(--hq-radius);
  color: var(--hq-text); font-size: 1rem; font-family: inherit;
}
.hq-input:focus { outline: none; border-color: var(--hq-accent); }
.hq-btn-primary {
  padding: 0.9rem; background: var(--hq-accent); color: var(--hq-text);
  border: none; border-radius: var(--hq-radius); font-size: 1.1rem;
  cursor: pointer; font-family: var(--hq-font-pixel); font-weight: 700; margin-top: 0.25rem;
}
.hq-btn-primary:hover:not(:disabled) { background: color-mix(in srgb, var(--hq-accent) 80%, var(--hq-bg)); }
.hq-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
