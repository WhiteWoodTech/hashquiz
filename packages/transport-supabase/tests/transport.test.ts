import { describe, it, expect } from 'bun:test'
import { SupabaseTransport } from '../src/index'
import { GameEvents, type GameEvent, type PlayerState } from '@quizv/core'
import { FakeSupabase } from './fake-supabase'

function makeTransport(): { transport: SupabaseTransport; fake: FakeSupabase } {
  const fake = new FakeSupabase()
  const transport = new SupabaseTransport({ client: fake as unknown as never })
  return { transport, fake }
}

describe('SupabaseTransport.broadcast', () => {
  it('sends a broadcast message with the game event payload', async () => {
    const { transport, fake } = makeTransport()
    const event = GameEvents.gameStarted()
    await transport.broadcast('game:ABCD', event)
    const ch = fake.channels['game:ABCD']!
    expect(ch.sent).toEqual([{ type: 'broadcast', event: 'gameEvent', payload: event }])
  })
})

describe('SupabaseTransport.subscribe', () => {
  it('delivers local broadcast to subscriber immediately (no Supabase roundtrip)', async () => {
    const { transport } = makeTransport()
    const received: GameEvent[] = []
    transport.subscribe('game:XYZ', e => received.push(e))
    await transport.broadcast('game:XYZ', GameEvents.gameStarted())
    expect(received).toEqual([{ type: 'game_started' }])
  })

  it('delivers incoming remote event (from another client) to subscriber', () => {
    const { transport, fake } = makeTransport()
    const received: GameEvent[] = []
    transport.subscribe('game:XYZ', e => received.push(e))
    fake.channels['game:XYZ']!.simulateIncoming(GameEvents.gameStarted())
    expect(received).toEqual([{ type: 'game_started' }])
  })

  it('local broadcast does not reach Supabase channel as self-echo', async () => {
    const { transport, fake } = makeTransport()
    const received: GameEvent[] = []
    transport.subscribe('game:XYZ', e => received.push(e))
    await transport.broadcast('game:XYZ', GameEvents.gameStarted())
    // Only one delivery: local. A second event from simulateIncoming adds a second entry.
    fake.channels['game:XYZ']!.simulateIncoming(GameEvents.gameStarted())
    expect(received).toHaveLength(2)
  })

  it('returns an unsubscribe that stops invocations', async () => {
    const { transport } = makeTransport()
    const received: GameEvent[] = []
    const off = transport.subscribe('game:XYZ', e => received.push(e))
    off()
    await transport.broadcast('game:XYZ', GameEvents.gameStarted())
    expect(received).toEqual([])
  })
})

describe('SupabaseTransport.presence', () => {
  const player = (id: string): PlayerState => ({
    id, pseudo: 'p-' + id, email: '', score: 0, joinedAt: 0,
  })

  it('tracks and lists presence', async () => {
    const { transport } = makeTransport()
    await transport.presence.track('game:Q1', player('a'))
    await transport.presence.track('game:Q1', player('b'))
    const list = transport.presence.list('game:Q1').map(p => p.id).sort()
    expect(list).toEqual(['a', 'b'])
  })

  it('fires onChange after track', async () => {
    const { transport } = makeTransport()
    const calls: number[] = []
    transport.presence.onChange('game:Q2', players => calls.push(players.length))
    await transport.presence.track('game:Q2', player('x'))
    expect(calls.at(-1)).toBe(1)
  })
})
