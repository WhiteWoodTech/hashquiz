import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { EMAIL_RE, type RankedRun, type VerifiedRun } from '@quizv/core'

/** Server-side only (`bun:sqlite`): never import this from an app bundle. */
export const DEFAULT_SOLO_DB = '.hashquiz/solo.db'

// Mirrors supabase/migrations/20261126090000_solo_live.sql and 20261126120000_solo_hardening.sql.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS solo_runs (
  id TEXT PRIMARY KEY,
  deck_id TEXT NOT NULL,
  deck_version TEXT NOT NULL,
  room_id TEXT,
  pseudo TEXT NOT NULL CHECK (length(pseudo) BETWEEN 1 AND 24),
  score INTEGER NOT NULL,
  correct_count INTEGER NOT NULL,
  question_count INTEGER NOT NULL,
  total_time_ms INTEGER NOT NULL,
  finished_at TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS solo_runs_leaderboard_idx
  ON solo_runs (deck_id, score DESC, total_time_ms, finished_at);
CREATE TABLE IF NOT EXISTS solo_answers (
  run_id TEXT NOT NULL REFERENCES solo_runs (id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  deck_index INTEGER NOT NULL,
  choices TEXT NOT NULL,
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  answer_time_ms INTEGER NOT NULL,
  points INTEGER NOT NULL,
  PRIMARY KEY (run_id, position)
) STRICT;
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL CHECK (length(email) <= 254),
  consent INTEGER NOT NULL CHECK (consent = 1),
  deck_id TEXT CHECK (length(deck_id) <= 200),
  created_at TEXT NOT NULL
) STRICT;
`

interface RankedRow {
  id: string
  pseudo: string
  score: number
  totalTimeMs: number
  finishedAt: string
}

const RANKED_COLS = 'id, pseudo, score, total_time_ms AS totalTimeMs, finished_at AS finishedAt'

export class SoloStore {
  private readonly insertRunStmt
  private readonly insertAnswerStmt
  private readonly topStmt
  private readonly runStmt
  private readonly countStmt
  private readonly rankStmt
  private readonly leadStmt
  private readonly insertAll

  private constructor(private readonly db: Database) {
    db.run('PRAGMA journal_mode = WAL')
    db.run('PRAGMA foreign_keys = ON')
    db.run(SCHEMA)
    db.run('PRAGMA user_version = 1')
    this.insertRunStmt = db.prepare(
      `INSERT INTO solo_runs (id, deck_id, deck_version, pseudo, score, correct_count, question_count, total_time_ms, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    this.insertAnswerStmt = db.prepare(
      `INSERT INTO solo_answers (run_id, position, deck_index, choices, is_correct, answer_time_ms, points)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    this.topStmt = db.prepare<RankedRow, [string, number]>(
      `SELECT ${RANKED_COLS} FROM solo_runs WHERE deck_id = ?
       ORDER BY score DESC, total_time_ms ASC, finished_at ASC LIMIT ?`,
    )
    this.runStmt = db.prepare<RankedRow, [string]>(`SELECT ${RANKED_COLS} FROM solo_runs WHERE id = ?`)
    this.countStmt = db.prepare<{ n: number }, [string]>('SELECT count(*) AS n FROM solo_runs WHERE deck_id = ?')
    // Same predicate as public.solo_rank in the Supabase migration.
    this.rankStmt = db.prepare<{ rank: number }, [string]>(
      `SELECT 1 + (
         SELECT count(*) FROM solo_runs o
         WHERE o.deck_id = r.deck_id AND (
           o.score > r.score
           OR (o.score = r.score AND o.total_time_ms < r.total_time_ms)
           OR (o.score = r.score AND o.total_time_ms = r.total_time_ms AND o.finished_at < r.finished_at)
         )
       ) AS rank
       FROM solo_runs r WHERE r.id = ?`,
    )
    this.leadStmt = db.prepare(
      'INSERT INTO leads (email, consent, deck_id, created_at) VALUES (?, 1, ?, ?)',
    )
    this.insertAll = db.transaction((id: string, run: VerifiedRun, finishedAt: string) => {
      this.insertRunStmt.run(
        id, run.deckId, run.deckVersion, run.pseudo, run.score, run.correctCount, run.questionCount,
        run.totalTimeMs, finishedAt,
      )
      for (const a of run.answers) {
        this.insertAnswerStmt.run(
          id, a.position, a.deckIndex, JSON.stringify(a.choices), a.isCorrect ? 1 : 0, a.answerTimeMs, a.points,
        )
      }
    })
  }

  /** `':memory:'` is allowed; any other path gets its parent directory created. */
  static open(path: string): SoloStore {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    return new SoloStore(new Database(path))
  }

  /** Stores a verified run and its answers in one transaction; returns the new run id. */
  insertRun(run: VerifiedRun, finishedAt: string = new Date().toISOString()): string {
    const n = run.answers.length
    if (n < 1 || n > 200) throw new Error('solo run must have between 1 and 200 answers')
    if (n !== run.questionCount) throw new Error('solo run answer count does not match questionCount')
    const id = crypto.randomUUID()
    this.insertAll(id, run, finishedAt)
    return id
  }

  top(deckId: string, limit: number): RankedRun[] {
    return this.topStmt.all(deckId, limit)
  }

  run(runId: string): RankedRun | null {
    return this.runStmt.get(runId) ?? null
  }

  count(deckId: string): number {
    return this.countStmt.get(deckId)?.n ?? 0
  }

  rank(runId: string): number | null {
    return this.rankStmt.get(runId)?.rank ?? null
  }

  /** Throws on a malformed email, a too long email or deck id. Consent is implied by submitting. */
  insertLead(email: string, deckId: string | null): void {
    if (!EMAIL_RE.test(email)) throw new Error('invalid email')
    this.leadStmt.run(email, deckId, new Date().toISOString())
  }

  close(): void {
    this.db.close()
  }
}
