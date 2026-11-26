/** Decks playable solo (`solo: true` frontmatter), in their original order. */
export function soloDecks<D extends { quiz: { meta: { solo: boolean } } }>(decks: D[]): D[] {
  return decks.filter(d => d.quiz.meta.solo)
}
