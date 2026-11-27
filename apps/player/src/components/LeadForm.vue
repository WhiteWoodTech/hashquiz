<template>
  <section class="lead" aria-labelledby="lead-title">
    <p v-if="state === 'done'" class="lead__thanks" role="status">Merci, on vous tient au courant de HashQuiz !</p>
    <form v-else class="lead__form" novalidate @submit.prevent="send">
      <h3 id="lead-title" class="lead__title">HashQuiz arrive bientôt</h3>
      <label class="solo-label" for="lead-email">Email</label>
      <input
        id="lead-email"
        v-model="email"
        class="solo-input"
        type="email"
        autocomplete="email"
        inputmode="email"
        required
        :aria-invalid="email !== '' && !emailOk"
      />
      <label class="lead__consent">
        <input v-model="consent" type="checkbox" required />
        <span>J'accepte d'être recontacté·e au sujet de HashQuiz</span>
      </label>
      <button class="solo-btn solo-btn--ghost" type="submit" :disabled="!canSend">Tenir au courant</button>
      <p v-if="state === 'error'" class="lead__error" role="status">Oups, réessayez.</p>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { EMAIL_RE } from '@quizv/core'
import { useSoloStore } from '../stores/solo'

const solo = useSoloStore()
const email = ref('')
const consent = ref(false)
const state = ref<'idle' | 'sending' | 'done' | 'error'>('idle')

const emailOk = computed(() => EMAIL_RE.test(email.value.trim()))
const canSend = computed(() => emailOk.value && consent.value && state.value !== 'sending')

async function send() {
  if (!canSend.value) return
  state.value = 'sending'
  // Same outcome whether or not the email was already known.
  const r = await solo.submitLead(email.value)
  state.value = r.ok ? 'done' : 'error'
}
</script>

<style scoped>
.lead {
  width: 100%; padding: 1rem; background: var(--qv-surface);
  border: 1px solid var(--qv-border); border-radius: var(--qv-radius);
}
.lead__form { display: flex; flex-direction: column; gap: 0.6rem; }
.lead__title { margin: 0 0 0.25rem; font-size: 1.05rem; }
.lead__consent { display: flex; gap: 0.6rem; align-items: flex-start; font-size: 0.9rem; color: var(--qv-text-muted); cursor: pointer; }
.lead__consent input { margin-top: 0.2rem; accent-color: var(--qv-accent); width: 1.1rem; height: 1.1rem; flex-shrink: 0; }
.lead__error { margin: 0; color: var(--qv-wrong); font-size: 0.9rem; }
.lead__thanks { margin: 0; text-align: center; color: var(--qv-correct); font-weight: 600; }
</style>
