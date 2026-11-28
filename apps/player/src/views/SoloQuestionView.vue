<template>
  <div class="solo-q" v-if="q">
    <!-- Progress: current question / total -->
    <div class="solo-q__progress">
      <span class="solo-q__progress-label hq-label">Q{{ solo.index + 1 }}</span>
      <div class="solo-q__track hq-steps">
        <div class="solo-q__fill" :style="{ width: ((solo.index + 1) / (solo.total || 1) * 100) + '%' }" />
      </div>
      <span class="solo-q__progress-label">{{ solo.total }}</span>
    </div>

    <div v-if="!revealed" class="solo-q__timer">
      <FxCountdown :total="q.timer" :remaining="remaining" size="compact" />
    </div>
    <div v-else-if="result" role="status" :class="['solo-q__result', result.isCorrect ? 'solo-q__result--correct' : 'solo-q__result--wrong']">
      <FxVerdict class="solo-q__fx" :correct="result.isCorrect" :delta="result.points" :answered="result.answered" />
      <span class="hq-sr-only">{{ result.isCorrect ? 'Bonne réponse' : result.answered ? 'Mauvaise réponse' : 'Temps écoulé' }}</span>
      <span class="solo-q__delta">+{{ result.points }} pts</span>
      <span class="solo-q__score">{{ solo.score }} <small>pts</small></span>
      <span class="solo-q__rank">
        {{ ordinal(solo.liveRank.rank) }}
        <small>{{ solo.liveRank.of > 1 ? `sur ${solo.liveRank.of} joueurs en cours` : 'seul en cours' }}</small>
      </span>
      <span class="solo-q__info">
        {{ result.answered ? `Répondu en ${Math.round(result.answerTimeMs / 1000)} s / ${q.timer} s` : 'Pas de réponse' }}
      </span>
    </div>

    <h2 class="solo-q__text">{{ q.text.replace(/^#+\s/, '') }}</h2>

    <div class="solo-q__grid">
      <AnswerButton
        v-for="(choice, i) in q.choices"
        :key="choice.id"
        :id="choice.id"
        :text="choice.text"
        :color-id="(['a', 'b', 'c', 'd'][i] as 'a' | 'b' | 'c' | 'd')"
        :state="btnState(choice.id)"
        :aria-pressed="!revealed && selected.has(choice.id)"
        @select="handleSelect(choice.id)"
      />
    </div>

    <button
      v-if="needsValidate && !revealed"
      class="solo-btn solo-btn--ghost hq-press"
      :disabled="selected.size === 0"
      @click="validate"
    >
      Valider →
    </button>

    <template v-if="revealed && result">
      <!-- Bundled deck content (trusted), rendered like the host reveal screen. -->
      <div v-if="explanationHtml" class="solo-q__explanation" v-html="explanationHtml" />

      <section v-if="solo.liveOthers.length" class="solo-q__live" aria-label="Joueurs en cours">
        <h3 class="solo-q__live-title hq-label">En ce moment</h3>
        <ul>
          <li v-for="p in solo.liveOthers" :key="p.key">
            <span class="solo-q__live-name">{{ p.pseudo }}</span>
            <span class="solo-q__live-meta">Q{{ Math.min(p.index + 1, p.total) }}/{{ p.total }} · {{ p.score }} pts</span>
          </li>
        </ul>
      </section>

      <button ref="nextBtn" class="solo-btn hq-press" @click="solo.next()">Suivant →</button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { marked } from 'marked'
import { AnswerButton, FxCountdown, FxVerdict } from '@hashquiz/ui'
import { useSoloStore } from '../stores/solo'
import { ordinal } from '../solo/format'
import '../solo/solo.css'

const solo = useSoloStore()
const q = computed(() => solo.question)
const result = computed(() => solo.lastResult)
const revealed = computed(() => solo.phase === 'revealed')
const explanationHtml = computed(() =>
  result.value?.explanation ? (marked.parse(result.value.explanation, { breaks: true, gfm: true, async: false }) as string) : '',
)
// Spec §4.2: only single + one-shoot answers on tap; every other case is made final with Valider.
const needsValidate = computed(() => !(q.value?.type === 'single' && q.value.oneShoot))

const selected = ref<Set<string>>(new Set())
const remaining = ref(0)
const nextBtn = ref<HTMLButtonElement | null>(null)
let interval: ReturnType<typeof setInterval> | null = null

function stopTimer() {
  if (interval) { clearInterval(interval); interval = null }
}

function tick() {
  const dl = solo.deadlineMs
  if (dl === null) { stopTimer(); return }
  remaining.value = Math.max(0, Math.round((dl - Date.now()) / 100) / 10)
  if (remaining.value > 0) return
  stopTimer()
  // Timeout takes the current selection if any (answer time is then the full timer).
  solo.timeout([...selected.value])
}

/** A tap at or after the deadline is late: run the timeout now instead of waiting for the next tick. */
function late(): boolean {
  const dl = solo.deadlineMs
  if (dl === null || Date.now() < dl) return false
  tick()
  return true
}

// New question: clear the selection and restart the countdown.
watch(() => [solo.index, solo.session] as const, () => {
  selected.value = new Set()
  stopTimer()
  if (solo.phase !== 'question') return
  tick()
  interval = setInterval(tick, 100)
}, { immediate: true })

// Reveal: stop the countdown and move focus to Suivant.
watch(revealed, async (on) => {
  if (!on) return
  stopTimer()
  await nextTick()
  nextBtn.value?.focus()
})

onUnmounted(stopTimer)

function btnState(id: string): 'idle' | 'selected' | 'correct' | 'wrong' | 'disabled' {
  if (revealed.value) {
    if (result.value?.correctIds.includes(id)) return 'correct'
    return selected.value.has(id) ? 'wrong' : 'disabled'
  }
  return selected.value.has(id) ? 'selected' : 'idle'
}

function handleSelect(id: string) {
  if (solo.phase !== 'question' || late()) return
  if (!needsValidate.value) {
    selected.value = new Set([id])
    solo.answer([id])
    return
  }
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else if (q.value?.type === 'single') { next.clear(); next.add(id) }
  else next.add(id)
  selected.value = next
}

function validate() {
  if (solo.phase !== 'question' || late() || selected.value.size === 0) return
  solo.answer([...selected.value])
}
</script>

<style scoped>
.solo-q { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; padding-top: 0.5rem; }

.solo-q__progress { display: flex; align-items: center; gap: 0.6rem; width: 100%; }
.solo-q__progress-label { font-size: 0.8rem; color: var(--hq-text-muted); min-width: 2rem; }
.solo-q__progress-label:last-child { text-align: right; }
.solo-q__track { flex: 1; height: 6px; background: var(--hq-border); border-radius: var(--hq-radius-sm); overflow: hidden; }
.solo-q__fill { height: 100%; background: var(--hq-progress); transition: width 0.3s; }

.solo-q__timer { margin: 0.5rem 0; }
.solo-q__text { font-size: 1.25rem; text-align: center; margin: 0.5rem 0; line-height: 1.4; }
.solo-q__grid { width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem; }
@media (max-width: 640px) {
  .solo-q__grid { grid-template-columns: 1fr; }
}

.solo-q__result {
  display: flex; flex-direction: column; align-items: center; gap: 0.15rem;
  width: 100%; padding: 0.25rem 0.75rem 0.5rem; text-align: center;
  animation: solo-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.solo-q__result .solo-q__fx { height: 88px; }
.solo-q__delta { font-size: 1.15rem; font-weight: 700; }
.solo-q__result--correct .solo-q__delta { color: var(--hq-correct); }
.solo-q__result--wrong   .solo-q__delta { color: var(--hq-text-muted); }
.solo-q__score { font-family: var(--hq-font-pixel); font-size: 1.6rem; font-weight: 700; line-height: 1.1; }
.solo-q__score small { font-size: 0.8rem; font-weight: 500; color: var(--hq-text-muted); }
.solo-q__rank { font-family: var(--hq-font-pixel); font-size: 1.15rem; color: var(--hq-figure); }
.solo-q__rank small { font-family: var(--hq-font-display); font-size: 0.8rem; color: var(--hq-text-muted); }
.solo-q__info { font-size: 0.8rem; color: var(--hq-text-muted); }
@keyframes solo-pop {
  from { opacity: 0; transform: scale(0.8); }
  to   { opacity: 1; transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .solo-q__result { animation: none; }
}

.solo-q__explanation {
  width: 100%; margin: 0; padding: 0.75rem 1rem; line-height: 1.5;
  background: var(--hq-surface); border: 1px solid var(--hq-border); border-radius: var(--hq-radius);
  color: var(--hq-text-muted);
}

.solo-q__explanation :deep(p) { margin: 0 0 0.5rem; }
.solo-q__explanation :deep(p:last-child) { margin: 0; }
.solo-q__explanation :deep(code) {
  background: var(--hq-surface-2); border: 1px solid var(--hq-border); border-radius: var(--hq-radius-sm);
  padding: 0.1rem 0.35rem; font-size: 0.9em;
}
.solo-q__explanation :deep(strong) { color: var(--hq-text); }
.solo-q__explanation :deep(ul),
.solo-q__explanation :deep(ol) { margin: 0.25rem 0; padding-left: 1.25rem; }

.solo-q__live { width: 100%; }
.solo-q__live-title { margin: 0 0 0.35rem; font-size: 0.75rem; color: var(--hq-text-muted); }
.solo-q__live ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.solo-q__live li { display: flex; justify-content: space-between; gap: 0.5rem; font-size: 0.85rem; }
.solo-q__live-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.solo-q__live-meta { color: var(--hq-text-muted); font-variant-numeric: tabular-nums; flex-shrink: 0; }
</style>
