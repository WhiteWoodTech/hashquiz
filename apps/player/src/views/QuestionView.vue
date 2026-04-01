<template>
  <div class="question-view" v-if="game.question">
    <!-- Progress bar: current question / total -->
    <div class="qv-progress">
      <span class="qv-progress__label">Q{{ game.questionIdx + 1 }}</span>
      <div class="qv-progress__track">
        <div
          class="qv-progress__fill"
          :style="{ width: ((game.questionIdx + 1) / (game.quizMeta?.totalQuestions ?? 1) * 100) + '%' }"
        />
      </div>
      <span class="qv-progress__label">{{ game.quizMeta?.totalQuestions ?? '?' }}</span>
    </div>

    <!-- Timer ring -->
    <div class="qv-timer-wrap">
      <TimerRing :total="game.question.timer" :remaining="remaining" :size="100" />
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

    <!-- Inline feedback overlay (revealed by host) -->
    <Transition name="reveal">
      <div v-if="revealed" :class="['qv-reveal', isCorrect ? 'qv-reveal--correct' : 'qv-reveal--wrong']">
        <span class="qv-reveal__icon">{{ isCorrect ? '✓' : '✗' }}</span>
        <span class="qv-reveal__delta">{{ game.lastDelta > 0 ? '+' + game.lastDelta : '+0' }} pts</span>
        <span v-if="game.answered" class="qv-reveal__info">Answered in {{ Math.round(game.answerTimeMs / 1000) }}s / {{ game.question.timer }}s</span>
        <span v-else class="qv-reveal__info">No answer submitted</span>
        <span v-if="game.totalScore > 0" class="qv-reveal__score">Score: <strong>{{ game.totalScore }}</strong> pts</span>
        <span class="qv-reveal__wait">Waiting for next question…</span>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useGameStore } from '../stores/game'
import { TimerRing, AnswerButton } from '@quizv/ui'

const game = useGameStore()
const remaining        = ref(game.question?.timer ?? 0)
const selected         = ref<Set<string>>(new Set())
const timerExpired     = ref(false)
const lastPressElapsed = ref(0)
let interval: ReturnType<typeof setInterval> | null = null
let startTime = 0
let totalTime = 0

const oneShoot   = computed(() => game.question?.oneShoot ?? true)
const isMultiple = computed(() => game.question?.type === 'multiple')
const revealed   = computed(() => game.correctIds.length > 0)
const isCorrect  = computed(() => game.correctIds.some(id => selected.value.has(id)))

watch(() => game.question, (q) => {
  if (!q) return
  selected.value         = new Set()
  timerExpired.value     = false
  lastPressElapsed.value = 0
  totalTime              = q.timer
  remaining.value        = totalTime
  startTime              = Date.now()
  if (interval) clearInterval(interval)
  interval = setInterval(() => {
    const left = Math.max(0, Math.round((totalTime - (Date.now() - startTime) / 1000) * 10) / 10)
    remaining.value = left
    if (left <= 0) {
      clearInterval(interval!)
      interval = null
      timerExpired.value = true
      // Auto-submit whatever is selected (all modes)
      if (selected.value.size > 0 && !game.answered) {
        game.submitAnswer([...selected.value], lastPressElapsed.value)
      }
    }
  }, 100)
}, { immediate: true })

onUnmounted(() => { if (interval) clearInterval(interval) })

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
.qv-progress__fill { height: 100%; background: var(--qv-accent); border-radius: 2px; transition: width 0.3s; }

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

/* Inline feedback reveal */
.qv-reveal {
  display: flex; flex-direction: column; align-items: center; gap: 0.25rem;
  width: 100%; padding: 1rem; border-radius: var(--qv-radius);
  text-align: center;
}
.qv-reveal--correct { background: color-mix(in srgb, var(--qv-correct) 12%, transparent); }
.qv-reveal--wrong   { background: color-mix(in srgb, var(--qv-wrong)   10%, transparent); }
.qv-reveal__icon  { font-size: 2.5rem; line-height: 1; }
.qv-reveal--correct .qv-reveal__icon { color: var(--qv-correct); }
.qv-reveal--wrong   .qv-reveal__icon { color: var(--qv-wrong); }
.qv-reveal__delta { font-size: 1.5rem; font-weight: 700; }
.qv-reveal--correct .qv-reveal__delta { color: var(--qv-correct); }
.qv-reveal--wrong   .qv-reveal__delta { color: var(--qv-text-muted); }
.qv-reveal__wait  { font-size: 0.8rem; color: var(--qv-text-muted); margin-top: 0.25rem; }

/* Reveal transition */
.reveal-enter-active { animation: reveal-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes reveal-pop {
  from { opacity: 0; transform: scale(0.8); }
  to   { opacity: 1; transform: scale(1); }
}

.qv-reveal__info  { font-size: 0.82rem; color: var(--qv-text-muted); }
.qv-reveal__score { font-size: 0.85rem; color: var(--qv-text-muted); }

.qv-validate-btn {
  margin-top: 0.5rem;
  padding: 0.75rem 2rem;
  border: 2px solid var(--qv-accent, #7c3aed);
  border-radius: var(--qv-radius);
  background: transparent;
  color: var(--qv-accent, #7c3aed);
  font-size: 1rem;
  font-family: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.qv-validate-btn:not(:disabled):hover {
  background: var(--qv-accent, #7c3aed);
  color: #fff;
}
.qv-validate-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
