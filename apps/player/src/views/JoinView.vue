<template>
  <div class="join">
    <h1 class="join__title">QuizV</h1>
    <p class="join__sub">Enter the game code to join</p>

    <div class="join__form">
      <input
        v-model="code"
        class="qv-input"
        placeholder="Game code (e.g. ABC123)"
        style="text-transform:uppercase;letter-spacing:0.12em"
        maxlength="8"
      />
      <input v-model="pseudo" class="qv-input" placeholder="Your name" maxlength="20" />
      <input v-model="email"  class="qv-input" type="email" placeholder="Email (optional)" />

      <p v-if="game.connectError" class="join__error">{{ game.connectError }}</p>

      <button class="qv-btn-primary" :disabled="!code.trim() || !pseudo.trim()" @click="joinGame">
        Join Game
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useGameStore } from '../stores/game'

const game = useGameStore()
const code   = ref('')
const pseudo = ref('')
const email  = ref('')

onMounted(() => {
  const param = new URLSearchParams(location.search).get('code')
  if (param) code.value = param.toUpperCase()
  // Auto-rejoin if a persisted session exists for this code (sessionStorage survives reload and screen-lock)
  try {
    const raw = sessionStorage.getItem('quizv:player-session')
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
.join { display: flex; flex-direction: column; align-items: center; padding-top: 3rem; }
.join__title { font-size: 2.5rem; color: var(--qv-accent); margin: 0; }
.join__sub   { color: var(--qv-text-muted); margin: 0.5rem 0 2rem; }
.join__form  { width: 100%; display: flex; flex-direction: column; gap: 0.75rem; }
.join__error { color: var(--qv-wrong); font-size: 0.9rem; margin: 0; }
.qv-input {
  width: 100%; padding: 0.85rem; background: var(--qv-surface);
  border: 1px solid var(--qv-border); border-radius: var(--qv-radius);
  color: var(--qv-text); font-size: 1rem; font-family: inherit;
}
.qv-input:focus { outline: none; border-color: var(--qv-accent); }
.qv-btn-primary {
  padding: 0.9rem; background: var(--qv-accent); color: #fff;
  border: none; border-radius: var(--qv-radius); font-size: 1.1rem;
  cursor: pointer; font-family: inherit; font-weight: 600; margin-top: 0.25rem;
  transition: background 0.15s;
}
.qv-btn-primary:hover:not(:disabled) { background: #6d28d9; }
.qv-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
