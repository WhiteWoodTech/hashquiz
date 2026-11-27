// Browser-safe: the local solo backend over HTTP + WS to the `hashquiz dev` server. No Bun import.
import {
  EMAIL_RE,
  type LivePlayer, type LiveState, type Outcome, type RankedRun, type SoloApiPort, type SoloBackend,
  type SoloLivePort, type SoloRunSubmission, type SubmittedRun,
} from '@hashquiz/core'
import { SOLO_WS_ROLE, type SoloClientMsg, type SoloServerMsg } from './protocol'

export * from './protocol'

/** Base URL of the dev server for the page hostname: `http://<hostname>:3030`, like the rooms WS. */
export function localSoloBaseUrl(hostname: string): string {
  return `http://${hostname}:3030`
}

export interface LocalSoloOptions {
  baseUrl: string
  fetch?: typeof fetch
  WebSocket?: typeof WebSocket
  /** Delay before reopening a socket closed while still in use, in ms (default 2_000). */
  reconnectMs?: number
}

const DEFAULT_RECONNECT_MS = 2_000

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e))
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })
const enc = encodeURIComponent

/** Presence key: `Math.random`, as `crypto.randomUUID` only exists in secure contexts (not `http://<lan-ip>`). */
const randomKey = (): string => Math.random().toString(36).slice(2, 12).padEnd(6, '0')

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

interface Ctx {
  baseUrl: string
  fetch: typeof fetch
  WebSocket: typeof WebSocket
  reconnectMs: number
}

/** Solo REST calls (`/solo/*`). No method throws: failures resolve to `{ ok: false }`. */
class LocalSoloApi implements SoloApiPort {
  constructor(private ctx: Ctx) {}

  private async call(path: string, body?: unknown): Promise<Outcome<unknown>> {
    try {
      const init: RequestInit = body === undefined
        ? { method: 'GET' }
        : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
      const res = await this.ctx.fetch(`${this.ctx.baseUrl}${path}`, init)
      if (res.status === 204) return { ok: true, value: undefined }
      let data: unknown
      try { data = await res.json() } catch { data = undefined }
      if (!res.ok) {
        const reason = isRecord(data) && typeof data.reason === 'string' ? data.reason : `HTTP ${res.status}`
        return fail(reason)
      }
      return { ok: true, value: data }
    } catch (e) {
      return fail(message(e))
    }
  }

  /** The server rescores the raw answers: `quiz` is unused. */
  async submitRun(sub: SoloRunSubmission): Promise<Outcome<SubmittedRun>> {
    const r = await this.call('/solo/runs', sub)
    if (!r.ok) return r
    const d = r.value
    if (!isRecord(d) || typeof d.runId !== 'string') return fail('invalid response')
    return { ok: true, value: { runId: d.runId, rank: typeof d.rank === 'number' ? d.rank : null } }
  }

  async fetchTop(deckId: string, limit = 20): Promise<Outcome<RankedRun[]>> {
    const r = await this.call(`/solo/runs?deck=${enc(deckId)}&limit=${limit}`)
    if (!r.ok) return r
    return Array.isArray(r.value) ? { ok: true, value: r.value as RankedRun[] } : fail('invalid response')
  }

  async fetchRun(runId: string): Promise<Outcome<RankedRun>> {
    const r = await this.call(`/solo/runs/${enc(runId)}`)
    if (!r.ok) return r
    return isRecord(r.value) ? { ok: true, value: r.value as unknown as RankedRun } : fail('invalid response')
  }

  async fetchCount(deckId: string): Promise<Outcome<number>> {
    const r = await this.call(`/solo/count?deck=${enc(deckId)}`)
    if (!r.ok) return r
    const d = r.value
    return isRecord(d) && typeof d.count === 'number' ? { ok: true, value: d.count } : fail('invalid response')
  }

  async fetchRank(runId: string): Promise<Outcome<number>> {
    const r = await this.call(`/solo/rank/${enc(runId)}`)
    if (!r.ok) return r
    const d = r.value
    return isRecord(d) && typeof d.rank === 'number' ? { ok: true, value: d.rank } : fail('invalid response')
  }

  async submitLead(email: string, deckId: string): Promise<Outcome<void>> {
    const trimmed = email.trim()
    if (!EMAIL_RE.test(trimmed)) return fail('invalid email')
    const r = await this.call('/solo/leads', { email: trimmed, deckId })
    return r.ok ? { ok: true, value: undefined } : r
  }

  /** One socket of its own (never tracked); reopened after an unexpected close, with a refresh `cb()`. */
  onNewRun(deckId: string, cb: () => void): () => void {
    let reopened = false
    const sock = new SoloSocket(this.ctx, deckId, randomKey(), {
      open: () => {
        // Runs stored while the socket was down were missed.
        if (reopened) cb()
        reopened = true
      },
      message: msg => { if (msg.type === 'solo_new_run' && msg.deckId === deckId) cb() },
    })
    return () => sock.stop()
  }
}

interface SocketHandlers {
  open(): void
  message(msg: SoloServerMsg): void
}

/**
 * One solo socket (`/ws?role=solo&deck=…&key=…`) that reconnects after `reconnectMs` until stopped.
 * Events of a replaced socket are ignored; sends are dropped unless the socket is open.
 */
class SoloSocket {
  private ws: WebSocket | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private stopped = false
  private readonly url: string

  constructor(private ctx: Ctx, deckId: string, key: string, private on: SocketHandlers) {
    const ws = ctx.baseUrl.replace(/^http/, 'ws')
    this.url = `${ws}/ws?role=${SOLO_WS_ROLE}&deck=${enc(deckId)}&key=${enc(key)}`
    this.connect()
  }

  private connect(): void {
    this.timer = null
    if (this.stopped) return
    let ws: WebSocket
    try {
      ws = new this.ctx.WebSocket(this.url)
    } catch {
      this.retry()
      return
    }
    this.ws = ws
    ws.onopen = () => { if (ws === this.ws) this.on.open() }
    ws.onmessage = (ev: MessageEvent) => {
      if (ws !== this.ws) return
      let msg: unknown
      try { msg = JSON.parse(String(ev.data)) } catch { return }
      if (isRecord(msg) && typeof msg.type === 'string') this.on.message(msg as unknown as SoloServerMsg)
    }
    ws.onclose = () => {
      if (ws !== this.ws) return
      this.ws = null
      this.retry()
    }
    // An error is followed by a close, which reconnects.
    ws.onerror = () => {}
  }

  private retry(): void {
    if (this.stopped || this.timer) return
    this.timer = setTimeout(() => this.connect(), this.ctx.reconnectMs)
  }

  send(msg: SoloClientMsg): void {
    const ws = this.ws
    if (ws && ws.readyState === this.ctx.WebSocket.OPEN) ws.send(JSON.stringify(msg))
  }

  stop(): void {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    const ws = this.ws
    this.ws = null
    try { ws?.close() } catch { /* already closed */ }
  }
}

/** Live presence of one deck over a local solo socket. The server drops our row when the socket closes. */
class LocalSoloLive implements SoloLivePort {
  readonly key = randomKey()
  private readonly sock: SoloSocket
  private listeners: Array<(players: LivePlayer[]) => void> = []
  /** Last tracked state, re-tracked after a reconnect; null when not listed. */
  private me: LiveState | null = null
  private resolveWatch!: () => void
  private readonly watched = new Promise<void>(r => { this.resolveWatch = r })

  constructor(ctx: Ctx, private deckId: string) {
    this.sock = new SoloSocket(ctx, deckId, this.key, {
      open: () => { if (this.me) this.sock.send({ type: 'solo_track', state: this.me }) },
      message: msg => {
        if (msg.type !== 'solo_presence' || msg.deckId !== this.deckId || !Array.isArray(msg.players)) return
        this.resolveWatch()
        for (const cb of this.listeners) cb(msg.players)
      },
    })
  }

  /** Resolves on the first presence list (the server sends it on open). */
  watch(): Promise<void> {
    return this.watched
  }

  /** Sent now when the socket is open, otherwise on (re)open. */
  async join(me: LiveState): Promise<void> {
    this.track(me)
  }

  async update(me: LiveState): Promise<void> {
    this.track(me)
  }

  private track(me: LiveState): void {
    this.me = { ...me }
    this.sock.send({ type: 'solo_track', state: this.me })
  }

  async untrack(): Promise<void> {
    this.me = null
    this.sock.send({ type: 'solo_untrack' })
  }

  /** Closes the socket and stops reconnecting; never rejects. */
  async leave(): Promise<void> {
    this.me = null
    this.sock.stop()
  }

  onChange(cb: (players: LivePlayer[]) => void): () => void {
    this.listeners.push(cb)
    return () => { this.listeners = this.listeners.filter(l => l !== cb) }
  }
}

/** Solo backend on the `hashquiz dev` server: one socket per `live()` and per `onNewRun`. */
export function createLocalSoloBackend(o: LocalSoloOptions): SoloBackend {
  const ctx: Ctx = {
    baseUrl: o.baseUrl.replace(/\/+$/, ''),
    // Called through a wrapper: a bare `window.fetch` reference throws "Illegal invocation" when called unbound.
    fetch: o.fetch ?? (((input, init) => globalThis.fetch(input, init)) as typeof fetch),
    WebSocket: o.WebSocket ?? globalThis.WebSocket,
    reconnectMs: o.reconnectMs ?? DEFAULT_RECONNECT_MS,
  }
  return { api: new LocalSoloApi(ctx), live: deckId => new LocalSoloLive(ctx, deckId) }
}
