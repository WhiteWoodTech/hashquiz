// Server-side only (Bun): the local solo HTTP endpoints and WS presence hub of `hashquiz dev`.
import { EMAIL_RE, verifySoloRun, type LivePlayer, type LiveState, type SoloRunSubmission } from '@quizv/core'
import type { SoloDeckSource } from '@quizv/core/solo-decks'
import { soloTopic, type SoloServerMsg } from './protocol'
import type { SoloStore } from './store'

/** Largest accepted request body (and WS message), in bytes. */
export const SOLO_MAX_BODY = 65_536

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export interface SoloServiceOptions {
  decks: SoloDeckSource
  store: SoloStore
  publish: (topic: string, msg: SoloServerMsg) => void
}

const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
}

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } })
const empty = (status: number): Response => new Response(null, { status, headers: CORS })
const reason = (status: number, r: string): Response => json(status, { reason: r })

class TooLarge extends Error {}

/** Reads the body as text, stopping as soon as it exceeds `SOLO_MAX_BODY` bytes. */
async function readBody(req: Request): Promise<string> {
  const declared = Number(req.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > SOLO_MAX_BODY) throw new TooLarge()
  if (!req.body) return ''
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > SOLO_MAX_BODY) {
      await reader.cancel()
      throw new TooLarge()
    }
    chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

type Parsed = { ok: true; value: unknown } | { ok: false; res: Response }

async function parseBody(req: Request): Promise<Parsed> {
  let text: string
  try {
    text = await readBody(req)
  } catch (e) {
    if (e instanceof TooLarge) return { ok: false, res: reason(413, 'body too large') }
    throw e
  }
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch {
    return { ok: false, res: reason(422, 'invalid json') }
  }
}

/** `limit` query value clamped to 1..100 (SQLite reads a negative LIMIT as unlimited); 20 when absent or invalid. */
function clampLimit(raw: string | null): number {
  const n = raw === null ? NaN : Math.trunc(Number(raw))
  if (!Number.isFinite(n)) return DEFAULT_LIMIT
  return Math.min(MAX_LIMIT, Math.max(1, n))
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Handles /solo/* and CORS preflight; null for any other path. */
export function createSoloHttpHandler(o: SoloServiceOptions): (req: Request) => Promise<Response | null> {
  async function submitRun(req: Request): Promise<Response> {
    const body = await parseBody(req)
    if (!body.ok) return body.res
    if (!isRecord(body.value)) return reason(422, 'invalid submission')
    const { deckId, deckVersion, pseudo, answers } = body.value
    if (typeof deckId !== 'string') return reason(422, 'invalid deckId')
    if (typeof deckVersion !== 'string') return reason(422, 'invalid deckVersion')
    // Only the raw answers go on: any submitted score, rank or date is dropped.
    const sub = { deckId, deckVersion, pseudo, answers } as SoloRunSubmission
    const found = await o.decks.resolve(deckId, deckVersion)
    if (!found.ok) return reason(found.reason === 'decks unavailable' ? 503 : 422, found.reason)
    const verified = verifySoloRun(found.deck.quiz, sub)
    if (!verified.ok) return reason(422, verified.reason)
    const runId = o.store.insertRun(verified.run, new Date().toISOString())
    o.publish(soloTopic(deckId), { type: 'solo_new_run', deckId })
    // The run is stored: a rank failure must not turn into an error a client would retry (duplicate run).
    let rank: number | null = null
    try {
      rank = o.store.rank(runId)
    } catch (e) {
      console.error('Failed to rank solo run:', e)
    }
    return json(200, { runId, rank })
  }

  async function submitLead(req: Request): Promise<Response> {
    const body = await parseBody(req)
    if (!body.ok) return body.res
    if (!isRecord(body.value)) return reason(422, 'invalid lead')
    const { email, deckId } = body.value
    if (typeof email !== 'string' || email.length > 254 || !EMAIL_RE.test(email)) return reason(422, 'invalid email')
    if (deckId !== undefined && deckId !== null && (typeof deckId !== 'string' || deckId.length > 200)) {
      return reason(422, 'invalid deckId')
    }
    // Inputs are validated above: a throw here is a real store failure, answered by the router's catch.
    o.store.insertLead(email, typeof deckId === 'string' ? deckId : null)
    return empty(204)
  }

  return async (req) => {
    const url = new URL(req.url)
    if (!url.pathname.startsWith('/solo/')) return null
    if (req.method === 'OPTIONS') return empty(204)
    try {
      return await dispatch(req, url)
    } catch (e) {
      // Answered here, with CORS headers: the dev server's generic 500 would reach the browser as a CORS error.
      console.error('Solo store failed:', e)
      return reason(500, 'store failed')
    }
  }

  async function dispatch(req: Request, url: URL): Promise<Response> {
    const parts = url.pathname.slice('/solo/'.length).split('/')
    const route = parts[0]
    let id: string | undefined
    try {
      id = parts.length === 2 && parts[1] ? decodeURIComponent(parts[1]) : undefined
    } catch {
      return reason(404, 'not found')
    }
    const deck = url.searchParams.get('deck')

    if (req.method === 'POST' && parts.length === 1) {
      if (route === 'runs') return submitRun(req)
      if (route === 'leads') return submitLead(req)
    }
    if (req.method === 'GET') {
      if (route === 'runs' && parts.length === 1) {
        if (!deck) return reason(422, 'missing deck')
        return json(200, o.store.top(deck, clampLimit(url.searchParams.get('limit'))))
      }
      if (route === 'runs' && id) {
        const run = o.store.run(id)
        return run ? json(200, run) : reason(404, 'unknown run')
      }
      if (route === 'count' && parts.length === 1) {
        if (!deck) return reason(422, 'missing deck')
        return json(200, { count: o.store.count(deck) })
      }
      if (route === 'rank' && id) {
        const rank = o.store.rank(id)
        return rank === null ? reason(404, 'unknown run') : json(200, { rank })
      }
    }
    return reason(404, 'not found')
  }
}

/**
 * One solo socket. `send` must drop the message unless the socket is still open
 * (`ws.readyState === WebSocket.OPEN`): the hub never checks.
 */
export interface SoloConn {
  deckId: string
  key: string
  send(data: string): void
}

interface Row {
  conn: SoloConn
  player: LivePlayer
}

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0

function validState(s: unknown): LiveState | null {
  if (!isRecord(s) || typeof s.pseudo !== 'string') return null
  const pseudo = s.pseudo.trim()
  if (pseudo.length < 1 || pseudo.length > 24) return null
  if (!isCount(s.index) || !isCount(s.total) || !isCount(s.score)) return null
  return { pseudo, index: s.index, total: s.total, score: s.score }
}

/**
 * Live presence per deck. Rows are keyed by `deckId` + `key` and owned by the connection that last
 * tracked them: a reconnect with the same key takes the row over, and a late close (or untrack) of the
 * old socket leaves it alone.
 */
export class SoloPresenceHub {
  private readonly decks = new Map<string, Map<string, Row>>()

  constructor(private readonly publish: SoloServiceOptions['publish']) {}

  /** Sends the current solo_presence to conn only. */
  open(conn: SoloConn): void {
    const msg: SoloServerMsg = { type: 'solo_presence', deckId: conn.deckId, players: this.list(conn.deckId) }
    conn.send(JSON.stringify(msg))
  }

  message(conn: SoloConn, raw: string): void {
    if (raw.length > SOLO_MAX_BODY) return
    let msg: unknown
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }
    if (!isRecord(msg)) return
    if (msg.type === 'solo_track') {
      const state = validState(msg.state)
      if (!state) return
      let rows = this.decks.get(conn.deckId)
      if (!rows) this.decks.set(conn.deckId, (rows = new Map()))
      rows.set(conn.key, { conn, player: { key: conn.key, ...state } })
      this.changed(conn.deckId)
    } else if (msg.type === 'solo_untrack') {
      this.remove(conn)
    }
  }

  /** Removes conn's row, publishes if it had one. */
  close(conn: SoloConn): void {
    this.remove(conn)
  }

  list(deckId: string): LivePlayer[] {
    return [...(this.decks.get(deckId)?.values() ?? [])].map((r) => ({ ...r.player }))
  }

  private remove(conn: SoloConn): void {
    const rows = this.decks.get(conn.deckId)
    if (rows?.get(conn.key)?.conn !== conn) return
    rows.delete(conn.key)
    if (rows.size === 0) this.decks.delete(conn.deckId)
    this.changed(conn.deckId)
  }

  private changed(deckId: string): void {
    this.publish(soloTopic(deckId), { type: 'solo_presence', deckId, players: this.list(deckId) })
  }
}
