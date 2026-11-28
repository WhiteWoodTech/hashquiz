import { ordinal } from './format'
import { soloHash } from './route'

export interface ShareRun {
  title: string
  score: number
  /** Leaderboard rank of the run, null when it is not stored. */
  rank: number | null
}

/** Link to the deck's solo intro, on the current page (origin + path, the hash replaced). */
export function shareUrl(deckId: string, loc: Pick<Location, 'origin' | 'pathname'>): string {
  return `${loc.origin}${loc.pathname}${soloHash(deckId)}`
}

export function shareText(run: ShareRun): string {
  const place = run.rank !== null ? ` (${ordinal(run.rank)} au classement)` : ''
  return `J'ai fait ${run.score.toLocaleString('fr-FR')} pts sur le quiz « ${run.title} »${place}. À toi de jouer !`
}

/** What the share button did: the share sheet, a copied link, the user closing the sheet, or nothing available. */
export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed'

export interface SharePayload { title: string; text: string; url: string }

type ShareNavigator = {
  share?: (data: SharePayload) => Promise<void>
  clipboard?: { writeText: (text: string) => Promise<void> }
}

/** Native share sheet (phones) when available, otherwise copies the text and link to the clipboard. */
export async function shareQuiz(data: SharePayload, nav: ShareNavigator): Promise<ShareOutcome> {
  if (nav.share) {
    try {
      await nav.share(data)
      return 'shared'
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return 'cancelled'
      // Share refused (no user gesture, unsupported data): fall back to the clipboard.
    }
  }
  if (!nav.clipboard) return 'failed'
  try {
    await nav.clipboard.writeText(`${data.text} ${data.url}`)
    return 'copied'
  } catch {
    return 'failed'
  }
}
