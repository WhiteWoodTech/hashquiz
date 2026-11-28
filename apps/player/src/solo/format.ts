/** Total time as `m:ss`. */
export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** French ordinal place: 1er, 2e, 3e… */
export function ordinal(n: number): string {
  return n === 1 ? '1er' : `${n}e`
}
