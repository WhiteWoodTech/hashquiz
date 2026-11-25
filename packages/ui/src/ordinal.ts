/** French ordinal for a rank: "1er", "2e", "3e"... */
export function ordinalFr(n: number): string {
  return n === 1 ? '1er' : `${n}e`
}
