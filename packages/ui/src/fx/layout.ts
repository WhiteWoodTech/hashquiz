export interface CountdownState {
  dots: number
  lit: number
  danger: boolean
  fraction: number
  seconds: number
}

const MAX_DOTS = 30
const DANGER_SECONDS = 4

/** Derived values for the countdown ring, from the remaining and total seconds. */
export function countdownState(remaining: number, total: number): CountdownState {
  const dots = Math.max(0, Math.min(Math.floor(total), MAX_DOTS))
  const raw = total > 0 ? remaining / total : 0
  const fraction = Math.min(Math.max(raw, 0), 1)
  return {
    dots,
    lit: Math.ceil(fraction * dots),
    danger: remaining > 0 && remaining <= DANGER_SECONDS,
    fraction,
    seconds: Math.max(0, Math.ceil(remaining)),
  }
}
