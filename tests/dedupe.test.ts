import { describe, it, expect } from 'vitest'
import { selectNewItems, type NormalizedItem } from '@/lib/rss'

const make = (guid: string): NormalizedItem => ({
  guid, title: guid, link: `https://ex.com/${guid}`,
  description: null, content: null, imageUrl: null, author: null, hasVideo: false,
  publishedAt: new Date('2026-07-29T10:00:00Z'),
})

describe('selectNewItems', () => {
  it('filtre les guids déjà connus', () => {
    const items = [make('a'), make('b'), make('c')]
    expect(selectNewItems(items, new Set(['b']))).toEqual([make('a'), make('c')])
  })

  it('dédoublonne au sein du même batch', () => {
    expect(selectNewItems([make('a'), make('a')], new Set())).toEqual([make('a')])
  })

  it('préserve l’ordre du flux', () => {
    const r = selectNewItems([make('z'), make('a')], new Set())
    expect(r.map((i) => i.guid)).toEqual(['z', 'a'])
  })
})
