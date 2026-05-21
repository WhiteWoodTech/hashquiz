import { describe, it, expect } from 'bun:test'
import { SupabaseTransport } from '../src/index'
import { GameEvents } from '@quizv/core'
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
