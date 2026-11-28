import { describe, test, expect } from 'bun:test'
import { ordinal } from '../src/solo/format'
import { shareQuiz, shareText, shareUrl, type SharePayload } from '../src/solo/share'

const data: SharePayload = { title: 'Docker', text: 'J\'ai fait 10 pts', url: 'https://x.test/#/solo/d' }

describe('solo share', () => {
  test('link to the deck solo intro on the current page', () => {
    expect(shareUrl('folder/my deck', { origin: 'https://quiz.test', pathname: '/play/' }))
      .toBe('https://quiz.test/play/#/solo/folder%2Fmy%20deck')
  })

  test('text with score, title and rank; without rank when the run is not stored', () => {
    expect(shareText({ title: 'Docker', score: 1250, rank: 1 }))
      .toBe('J\'ai fait 1 250 pts sur le quiz « Docker » (1er au classement). À toi de jouer !')
    expect(shareText({ title: 'Docker', score: 0, rank: null })).toBe('J\'ai fait 0 pts sur le quiz « Docker ». À toi de jouer !')
  })

  test('uses the native share sheet when available', async () => {
    const shared: SharePayload[] = []
    expect(await shareQuiz(data, { share: async d => { shared.push(d) } })).toBe('shared')
    expect(shared).toEqual([data])
  })

  test('closing the share sheet is not an error and copies nothing', async () => {
    let copied = false
    const nav = {
      share: async () => { throw Object.assign(new Error('closed'), { name: 'AbortError' }) },
      clipboard: { writeText: async () => { copied = true } },
    }
    expect(await shareQuiz(data, nav)).toBe('cancelled')
    expect(copied).toBe(false)
  })

  test('falls back to copying text + link (no share API, or share refused)', async () => {
    const copies: string[] = []
    const clipboard = { writeText: async (t: string) => { copies.push(t) } }
    expect(await shareQuiz(data, { clipboard })).toBe('copied')
    const refused = async () => { throw Object.assign(new Error('no'), { name: 'NotAllowedError' }) }
    expect(await shareQuiz(data, { share: refused, clipboard })).toBe('copied')
    expect(copies).toEqual([`${data.text} ${data.url}`, `${data.text} ${data.url}`])
  })

  test('fails without share or clipboard', async () => {
    expect(await shareQuiz(data, {})).toBe('failed')
    expect(await shareQuiz(data, { clipboard: { writeText: async () => { throw new Error('denied') } } })).toBe('failed')
  })

  test('french ordinals', () => {
    expect([1, 2, 3, 11].map(ordinal)).toEqual(['1er', '2e', '3e', '11e'])
  })
})
