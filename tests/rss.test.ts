import { describe, it, expect } from 'vitest'
import { normalizeItem, extractImage, type RawItem } from '@/lib/rss'

const NOW = new Date('2026-07-29T12:00:00Z')

describe('normalizeItem', () => {
  it('normalise un item complet', () => {
    const item: RawItem = {
      guid: 'abc-123',
      title: '  Un titre  ',
      link: 'https://ex.com/a',
      content: '<p>desc html</p>',
      contentEncoded: '<p>contenu complet</p>',
      isoDate: '2026-07-29T10:00:00Z',
    }
    expect(normalizeItem(item, NOW)).toEqual({
      guid: 'abc-123',
      title: 'Un titre',
      link: 'https://ex.com/a',
      description: '<p>desc html</p>',
      content: '<p>contenu complet</p>',
      imageUrl: null,
      publishedAt: new Date('2026-07-29T10:00:00Z'),
    })
  })

  it('utilise le lien comme guid de secours', () => {
    const r = normalizeItem({ title: 't', link: 'https://ex.com/b' }, NOW)
    expect(r?.guid).toBe('https://ex.com/b')
  })

  it('rejette un item sans guid ni lien', () => {
    expect(normalizeItem({ title: 't' }, NOW)).toBeNull()
  })

  it('date manquante ou invalide → now', () => {
    expect(normalizeItem({ guid: 'g1' }, NOW)?.publishedAt).toEqual(NOW)
    expect(normalizeItem({ guid: 'g2', isoDate: 'n/a' }, NOW)?.publishedAt).toEqual(NOW)
  })

  it('content null si pas de content:encoded, titre par défaut', () => {
    const r = normalizeItem({ guid: 'g', content: '<p>d</p>' }, NOW)
    expect(r?.content).toBeNull()
    expect(r?.title).toBe('Sans titre')
    expect(r?.description).toBe('<p>d</p>')
  })
})

describe('extractImage', () => {
  it('prend l’enclosure image en priorité', () => {
    expect(extractImage({
      enclosure: { url: 'https://ex.com/i.jpg', type: 'image/jpeg' },
      contentEncoded: '<img src="https://ex.com/autre.png">',
    })).toBe('https://ex.com/i.jpg')
  })

  it('ignore une enclosure non-image', () => {
    expect(extractImage({ enclosure: { url: 'https://ex.com/a.mp3', type: 'audio/mpeg' } })).toBeNull()
  })

  it('prend media:content image', () => {
    expect(extractImage({
      mediaContent: [{ $: { url: 'https://ex.com/m.jpg', medium: 'image' } }],
    })).toBe('https://ex.com/m.jpg')
  })

  it('sinon, première balise <img> du HTML', () => {
    expect(extractImage({ content: `<p>x</p><img class="c" src='https://ex.com/h.png'>` }))
      .toBe('https://ex.com/h.png')
  })

  it('null si rien', () => {
    expect(extractImage({ content: '<p>rien</p>' })).toBeNull()
  })
})
