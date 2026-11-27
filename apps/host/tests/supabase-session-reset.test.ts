import { describe, test, expect } from 'bun:test'
import type { GameEvent, IRealtimeTransport, PlayerState } from '@hashquiz/core'
import type { Quiz } from '@hashquiz/parser'
import { SupabaseHostSession, type HostEvent } from '../src/session/supabase-session'

/** Minimal in-memory transport: broadcasts loop back to subscribers, presence is manual. */
function memoryTransport() {
  const subs = new Set<(e: GameEvent) => void>()
  const presenceSubs = new Set<(p: PlayerState[]) => void>()
  const transport: IRealtimeTransport = {
    broadcast: async (_c, e) => { for (const s of subs) s(e) },
    subscribe: (_c, cb) => { subs.add(cb); return () => subs.delete(cb) },
    presence: {
      track: async () => {},
      untrack: async () => {},
      list: () => [],
      onChange: (_c, cb) => { presenceSubs.add(cb); return () => presenceSubs.delete(cb) },
    },
  }
  const setPresence = (players: PlayerState[]) => { for (const s of presenceSubs) s(players) }
  return { transport, setPresence }
}

const quiz: Quiz = {
  meta: { title: 'T', theme: 'default', tags: [], oneShoot: true },
  questions: [{
    type: 'single', timer: 20, difficulty: 'easy', tags: [], text: 'Q1?',
    choices: [{ id: 'a', text: 'Right', isCorrect: true }, { id: 'b', text: 'Wrong', isCorrect: false }],
  }],
}

describe('SupabaseHostSession — reset (Rejouer)', () => {
  test('reset() after the last question emits game_reset and allows a new start', async () => {
    const { transport, setPresence } = memoryTransport()
    const session = new SupabaseHostSession({ quiz, transport, joinCode: 'ABC123', origin: 'http://x', graceMs: 0 })
    const events: HostEvent[] = []
    session.on(e => events.push(e))
    setPresence([{ id: 'p1', pseudo: 'Alice', email: '', score: 0, joinedAt: 1 }])

    await session.start()
    await session.reveal()
    await session.next()
    expect(events.some(e => e.type === 'game_ended')).toBe(true)

    await session.reset()
    expect(events.at(-1)?.type).toBe('game_reset')

    const mark = events.length
    await session.start()
    expect(events.slice(mark).map(e => e.type)).toEqual(['game_started', 'question_started'])
    session.dispose()
  })
})
