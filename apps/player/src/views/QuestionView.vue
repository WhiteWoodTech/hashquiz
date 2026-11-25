<template>
  <div class="question-view" v-if="game.question">
    <!-- Progress bar: current question / total -->
    <div class="qv-progress">
      <span class="qv-progress__label qv-label">Q{{ game.questionIdx + 1 }}</span>
      <div class="qv-progress__track">
        <div
          class="qv-progress__fill"
          :style="{ width: ((game.questionIdx + 1) / (game.quizMeta?.totalQuestions ?? 1) * 100) + '%' }"
        />
      </div>
      <span class="qv-progress__label">{{ game.quizMeta?.totalQuestions ?? '?' }}</span>
    </div>

    <!-- Timer ring, replaced by the result block once the answer is revealed -->
    <div v-if="!revealed" class="qv-timer-wrap">
      <FxCountdown :total="game.question.timer" :remaining="remaining" size="compact" />
    </div>
    <div
      v-else
      role="status"
      :class="['qv-result', isCorrect ? 'qv-result--correct' : 'qv-result--wrong']"
    >
      <!-- FxVerdict draws the check / cross; screen readers get the verdict as text. -->
      <FxVerdict class="qv-result__fx" :correct="isCorrect" :delta="game.lastDelta" :answered="game.answered" />
      <span class="qv-sr-only">{{ isCorrect ? 'Correct' : 'Wrong' }}</span>
      <div class="qv-result__line">
        <span class="qv-result__score">{{ game.totalScore }} <small>pts</small></span>
        <span v-if="game.rank !== null" class="qv-result__rank qv-label">{{ ordinalFr(game.rank) }} / {{ game.playerTotal }}</span>
      </div>
      <span class="qv-result__delta">{{ shownDelta > 0 ? '+' + shownDelta : '+0' }} pts</span>
      <span v-if="game.answered" class="qv-result__info">Answered in {{ Math.round(game.answerTimeMs / 1000) }}s / {{ game.question.timer }}s</span>
      <span v-else class="qv-result__info">No answer submitted</span>
    </div>

    <!-- Question meta: tags left, difficulty dot right -->
    <div class="qv-q-meta">
      <div class="qv-q-meta__tags">
        <span
          v-for="tag in game.question.tags"
          :key="tag"
          class="qv-q-meta__tag"
        >{{ tag }}</span>
      </div>
      <span :class="['qv-difficulty', `qv-difficulty--${game.question.difficulty}`]">
        <span class="qv-difficulty__dot qv-difficulty__dot--1"></span>
        <span class="qv-difficulty__dot qv-difficulty__dot--2"></span>
        <span class="qv-difficulty__dot qv-difficulty__dot--3"></span>
      </span>
    </div>

    <!-- Question text -->
    <h2 class="qv-q-text">{{ game.question.text.replace(/^#+\s/, '') }}</h2>

    <!-- 2×2 answer grid -->
    <div class="qv-grid">
      <AnswerButton
        v-for="(choice, i) in game.question.choices"
        :key="choice.id"
        :id="choice.id"
        :text="choice.text"
        :color-id="(['a','b','c','d'][i] as 'a'|'b'|'c'|'d')"
        :state="btnState(choice.id)"
        @select="handleSelect(choice.id)"
      />
    </div>

    <!-- Valider button: one-shoot + multiple, before submission -->
    <button
      v-if="oneShoot && isMultiple && !game.answered && !timerExpired"
      class="qv-validate-btn"
      :disabled="selected.size === 0"
      @click="validateMultiple"
    >
      Valider →
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useGameStore } from '../stores/game'
import { FxCountdown, FxVerdict, AnswerButton, ordinalFr } from '@quizv/ui'

const game = useGameStore()
const remaining        = ref(game.question?.timer ?? 0)
const selected         = ref<Set<string>>(new Set())
const timerExpired     = ref(false)
const lastPressElapsed = ref(0)
let interval: ReturnType<typeof setInterval> | null = null
let totalTime = 0
let deadlineAt = 0   // Unix ms

const oneShoot   = computed(() => game.question?.oneShoot ?? true)
const isMultiple = computed(() => game.question?.type === 'multiple')
const revealed   = computed(() => game.correctIds.length > 0)
// Server verdict: points are only awarded for an exact match (calcPoints > 0 iff correct).
const isCorrect  = computed(() => game.lastDelta > 0)

// Points gained scroll from 0 to lastDelta in ~0.6s (shown directly with reduced motion).
const shownDelta = ref(0)
let deltaRaf = 0
watch(revealed, (on) => {
  cancelAnimationFrame(deltaRaf)
  if (!on) { shownDelta.value = 0; return }
  const target = game.lastDelta
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce || target <= 0) { shownDelta.value = target; return }
  const t0 = performance.now()
  const step = (now: number) => {
    const u = Math.min((now - t0) / 600, 1)
    shownDelta.value = Math.round(target * (1 - Math.pow(1 - u, 3)))
    if (u < 1) deltaRaf = requestAnimationFrame(step)
  }
  deltaRaf = requestAnimationFrame(step)
}, { immediate: true })

function startTimerLoop() {
  if (interval) clearInterval(interval)
  interval = setInterval(() => {
    const left = Math.min(totalTime, Math.max(0, Math.round((deadlineAt - Date.now()) / 100) / 10))
    remaining.value = left
    if (left <= 0) {
      clearInterval(interval!)
      interval = null
      timerExpired.value = true
      if (selected.value.size > 0 && !game.answered) {
        game.submitAnswer([...selected.value], lastPressElapsed.value)
      }
    }
  }, 100)
}

// Reset per-question UI state when the question changes (new round or rehydration of a different idx)
watch(
  () => game.question?.idx,
  () => {
    selected.value         = new Set()
    timerExpired.value     = false
    lastPressElapsed.value = 0
  },
  { immediate: true },
)

// Recompute deadline whenever the question changes OR the server-provided deadline updates
// (e.g. after a state_snapshot following a reconnect, or null after reveal)
watch(
  () => [game.question?.idx, game.deadlineMs] as const,
  ([, dl]) => {
    const q = game.question
    if (!q) return
    totalTime  = q.timer
    if (dl === null || dl === undefined) {
      // Round is over (reveal) or no server-authoritative deadline yet — stop the timer.
      if (interval) { clearInterval(interval); interval = null }
      return
    }
    deadlineAt      = dl
    remaining.value = Math.min(totalTime, Math.max(0, Math.round((deadlineAt - Date.now()) / 100) / 10))
    if (remaining.value <= 0) {
      timerExpired.value = true
      if (interval) { clearInterval(interval); interval = null }
    } else {
      startTimerLoop()
    }
  },
  { immediate: true },
)

// On mount, if we already have a question (rehydrated from snapshot), make sure the timer is live
onMounted(() => {
  if (game.question && deadlineAt > Date.now() && !interval) startTimerLoop()
})

onUnmounted(() => { if (interval) clearInterval(interval); cancelAnimationFrame(deltaRaf) })

function btnState(id: string): 'idle' | 'selected' | 'correct' | 'wrong' | 'disabled' {
  if (revealed.value) {
    const isCorrectChoice = game.correctIds.includes(id)
    const wasSelected = selected.value.has(id)
    if (isCorrectChoice) return 'correct'
    if (wasSelected) return 'wrong'
    return 'disabled'
  }
  if (timerExpired.value || game.answered) return selected.value.has(id) ? 'selected' : 'disabled'
  return selected.value.has(id) ? 'selected' : 'idle'
}

function handleSelect(id: string) {
  if (timerExpired.value || game.answered || revealed.value) return

  if (!oneShoot.value) {
    lastPressElapsed.value = (game.question!.timer - remaining.value) * 1000
    const next = new Set(selected.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selected.value = next
    return
  }

  if (!isMultiple.value) {
    if (selected.value.size > 0) return
    const elapsed = (game.question!.timer - remaining.value) * 1000
    selected.value = new Set([id])
    game.submitAnswer([id], elapsed)
    return
  }

  lastPressElapsed.value = (game.question!.timer - remaining.value) * 1000
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

function validateMultiple() {
  if (timerExpired.value || game.answered || selected.value.size === 0) return
  game.submitAnswer([...selected.value], lastPressElapsed.value)
}
</script>

<style scoped>
.question-view { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; padding-top: 0.5rem; }

/* Progress bar */
.qv-progress { display: flex; align-items: center; gap: 0.6rem; width: 100%; }
.qv-progress__label { font-size: 0.8rem; color: var(--qv-text-muted); min-width: 2rem; }
.qv-progress__label:last-child { text-align: right; }
.qv-progress__track { flex: 1; height: 4px; background: var(--qv-border); border-radius: 2px; overflow: hidden; }
.qv-progress__fill { height: 100%; background: var(--qv-progress); border-radius: 2px; transition: width 0.3s; }

/* Question meta */
.qv-q-meta { display: flex; align-items: center; justify-content: space-between; width: 100%; }
.qv-q-meta__tags { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.qv-q-meta__tag { background: var(--qv-bg); border: 1px solid var(--qv-border); border-radius: var(--qv-radius-sm); padding: 0.15rem 0.5rem; font-size: 0.75rem; color: var(--qv-text-muted); }
/* 3-dot difficulty */
.qv-difficulty { display: flex; gap: 3px; align-items: center; flex-shrink: 0; }
.qv-difficulty__dot { width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid currentColor; background: transparent; }
.qv-difficulty--easy   { color: var(--qv-correct); }
.qv-difficulty--medium { color: var(--qv-warn); }
.qv-difficulty--hard   { color: var(--qv-wrong); }
.qv-difficulty--easy   .qv-difficulty__dot--1 { background: currentColor; }
.qv-difficulty--medium .qv-difficulty__dot--1,
.qv-difficulty--medium .qv-difficulty__dot--2 { background: currentColor; }
.qv-difficulty--hard   .qv-difficulty__dot { background: currentColor; }

.qv-timer-wrap { margin: 0.5rem 0; }
.qv-q-text { font-size: 1.25rem; text-align: center; margin: 0.5rem 0; line-height: 1.4; }
.qv-grid { width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem; }
@media (max-width: 640px) {
  .qv-grid { grid-template-columns: 1fr; }
}

/* Result block (replaces the countdown after reveal) */
.qv-result {
  display: flex; flex-direction: column; align-items: center; gap: 0.15rem;
  width: 100%; padding: 0.25rem 0.75rem 0.5rem; border-radius: var(--qv-radius);
  text-align: center; animation: reveal-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.qv-result .qv-result__fx { height: 72px; }
.qv-result__line { display: flex; align-items: baseline; justify-content: center; gap: 0.75rem; }
.qv-result__score { font-size: 1.6rem; font-weight: 700; line-height: 1.1; }
.qv-result__score small { font-size: 0.8rem; font-weight: 500; color: var(--qv-text-muted); }
.qv-result__rank  { font-size: 0.85rem; color: var(--qv-text); text-transform: none; letter-spacing: 0.08em; }
.qv-result__delta { font-size: 1.15rem; font-weight: 700; }
.qv-result--correct .qv-result__delta { color: var(--qv-correct); }
.qv-result--wrong   .qv-result__delta { color: var(--qv-text-muted); }
.qv-result__info  { font-size: 0.8rem; color: var(--qv-text-muted); }
@keyframes reveal-pop {
  from { opacity: 0; transform: scale(0.8); }
  to   { opacity: 1; transform: scale(1); }
}

.qv-validate-btn {
  margin-top: 0.5rem;
  padding: 0.75rem 2rem;
  border: 2px solid var(--qv-accent);
  border-radius: var(--qv-radius);
  background: transparent;
  color: var(--qv-accent);
  font-size: 1rem;
  font-family: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.qv-validate-btn:not(:disabled):hover {
  background: var(--qv-accent);
  color: var(--qv-text);
}
.qv-validate-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
