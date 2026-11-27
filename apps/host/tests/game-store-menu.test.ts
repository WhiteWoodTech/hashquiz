import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test'
import { createPinia, setActivePinia } from 'pinia'
import type { GameEvent, IRealtimeTransport, PlayerState } from '@hashquiz/core'
import type { Quiz } from '@hashquiz/parser'
import type { BundledDeck } from '../src/decks'

/** In-memory transport: broadcasts loop back to subscribers, presence is set by the test. */
let unsubscribed = 0
let setPresence: (players: PlayerState[]) => void = () => {}
class MemoryTransport implements IRealtimeTransport {
  private subs = new Set<(e: GameEvent) => void>()
  private presenceSubs = new Set<(p: PlayerState[]) => void>()
  constructor() { setPresence = players => { for (const s of this.presenceSubs) s(players) } }
  broadcast = async (_c: string, e: GameEvent) => { for (const s of this.subs) s(e) }
  subscribe = (_c: string, cb: (e: GameEvent) => void) => {
    this.subs.add(cb)
    return () => { unsubscribed++; this.subs.delete(cb) }
  }
  presence = {
    track: async () => {},
    untrack: async () => {},
    list: () => [],
    onChange: (_c: string, cb: (p: PlayerState[]) => void) => {
      this.presenceSubs.add(cb)
      return () => { this.presenceSubs.delete(cb) }
    },
  }
}

const quiz: Quiz = {
  meta: { title: 'T', theme: 'default', tags: [], oneShoot: true },
  questions: [{
    type: 'single', timer: 20, difficulty: 'easy', tags: [], text: 'Q1?',
    choices: [{ id: 'a', text: 'Right', isCorrect: true }, { id: 'b', text: 'Wrong', isCorrect: false }],
  }],
}
const deck = { id: 'd', quiz } as unknown as BundledDeck
const flush = () => new Promise(r => setTimeout(r, 0))

type Store = ReturnType<typeof import('../src/stores/game').useGameStore>
let useGameStore: () => Store
const g = globalThis as { __HASHQUIZ_CONFIG__?: object; location?: object }

describe('host game store — Menu (back to the deck list)', () => {
  beforeAll(async () => {
    // The store reads the deployment config on import: Supabase mode, which has a deck list.
    g.__HASHQUIZ_CONFIG__ = {
      transport: 'supabase', supabaseUrl: 'http://supabase.test', supabaseAnonKey: 'anon', graceMs: 0,
    }
    g.location = { origin: 'http://host.test' }
    const store = await import('../src/stores/game')
    store.setHostTransport(() => new MemoryTransport())
    useGameStore = store.useGameStore
  })
  afterAll(() => {
    delete g.__HASHQUIZ_CONFIG__
    delete g.location
  })
  beforeEach(() => {
    setActivePinia(createPinia())
    unsubscribed = 0
  })

  async function finishedGame(): Promise<Store> {
    const game = useGameStore()
    game.connect()
    expect(game.phase).toBe('deck-select')
    game.startWithDeck(deck)
    setPresence([{ id: 'p1', pseudo: 'Alice', email: '', score: 0, joinedAt: 1 }])
    game.send('host_start'); await flush()
    game.send('host_reveal'); await flush()
    game.send('host_next'); await flush()
    expect(game.phase).toBe('finished')
    return game
  }

  test('is offered in Supabase mode', () => {
    expect(useGameStore().canGoToMenu).toBe(true)
  })

  test('from the podium, leaves the room and shows the deck list with a clean state', async () => {
    const game = await finishedGame()
    expect(game.podium.length).toBe(1)
    game.backToMenu()
    expect(game.phase).toBe('deck-select')
    expect(unsubscribed).toBeGreaterThan(0)
    expect(game.podium).toEqual([])
    expect(game.players).toEqual([])
    expect(game.joinCode).toBe('')
    expect(game.quizMeta).toBeNull()
  })

  test('a new deck can be started after going back to the menu', async () => {
    const game = await finishedGame()
    game.backToMenu()
    game.startWithDeck(deck)
    expect(game.phase).toBe('lobby')
    await flush()
    expect(game.joinCode).not.toBe('')
  })

  test('does nothing while a game is running', async () => {
    const game = useGameStore()
    game.connect()
    game.startWithDeck(deck)
    game.backToMenu()
    expect(game.phase).toBe('lobby')
  })
})
