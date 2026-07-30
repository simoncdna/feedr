import { describe, it, expect } from 'vitest'
import { normalizeItem, extractImage, parseFeedString, type RawItem } from '@/lib/rss'

const NOW = new Date('2026-07-29T12:00:00Z')

const ATOM_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <entry>
    <id>urn:uuid:atom-entry-1</id>
    <title>Atom Entry</title>
    <link href="https://ex.com/atom-entry"/>
    <summary>Teaser summary</summary>
    <content type="html">Full atom content</content>
    <updated>2026-07-29T10:00:00Z</updated>
  </entry>
</feed>`

const RSS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>RSS Feed</title>
    <item>
      <guid>rss-item-1</guid>
      <title>RSS Item</title>
      <link>https://ex.com/rss-item</link>
      <description>RSS description</description>
      <content:encoded><![CDATA[<p>Full RSS content</p>]]></content:encoded>
      <media:thumbnail url="https://ex.com/thumb.jpg"/>
      <pubDate>Wed, 29 Jul 2026 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`

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

  it('utilise id (Atom) comme guid de secours si pas de guid', () => {
    const r = normalizeItem({ id: 'atom-id-1', title: 't', link: 'https://ex.com/atom' }, NOW)
    expect(r?.guid).toBe('atom-id-1')
  })

  it('guid est prioritaire sur id si les deux sont présents', () => {
    const r = normalizeItem({ guid: 'g', id: 'atom-id-1', link: 'https://ex.com/x' }, NOW)
    expect(r?.guid).toBe('g')
  })

  it('Atom: description = summary, content = corps complet si différent du résumé', () => {
    const r = normalizeItem(
      { id: 'a1', title: 'Atom entry', link: 'https://ex.com/atom', summary: 'Teaser text', content: 'Full body text' },
      NOW,
    )
    expect(r?.description).toBe('Teaser text')
    expect(r?.content).toBe('Full body text')
  })

  it('Atom: content = null si summary et content sont identiques', () => {
    const r = normalizeItem({ id: 'a2', link: 'https://ex.com/atom2', summary: 'Same text', content: 'Same text' }, NOW)
    expect(r?.description).toBe('Same text')
    expect(r?.content).toBeNull()
  })

  it('utilise le guid comme lien si le lien est absent et le guid est une URL permalien', () => {
    const r = normalizeItem({ guid: 'https://ex.com/permalink', title: 't' }, NOW)
    expect(r?.link).toBe('https://ex.com/permalink')
  })

  it('ne fabrique pas de lien si le guid n’est pas une URL', () => {
    const r = normalizeItem({ guid: 'not-a-url', title: 't' }, NOW)
    expect(r?.link).toBe('')
  })

  it('rejette un lien non http(s) (ex. javascript:) et garde le guid', () => {
    const r = normalizeItem({ link: 'javascript:alert(1)', guid: 'g' }, NOW)
    expect(r?.link).toBe('')
    expect(r?.guid).toBe('g')
  })

  it('rejette un item dont le seul identifiant est un lien javascript:', () => {
    expect(normalizeItem({ link: 'javascript:alert(1)', title: 't' }, NOW)).toBeNull()
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

  it('prend media:thumbnail si pas de media:content', () => {
    expect(extractImage({
      mediaThumbnail: [{ $: { url: 'https://ex.com/thumb.jpg' } }],
    })).toBe('https://ex.com/thumb.jpg')
  })

  it('media:content est prioritaire sur media:thumbnail', () => {
    expect(extractImage({
      mediaContent: [{ $: { url: 'https://ex.com/m.jpg', medium: 'image' } }],
      mediaThumbnail: [{ $: { url: 'https://ex.com/thumb.jpg' } }],
    })).toBe('https://ex.com/m.jpg')
  })

  it('media:thumbnail est prioritaire sur le fallback <img>', () => {
    expect(extractImage({
      mediaThumbnail: [{ $: { url: 'https://ex.com/thumb.jpg' } }],
      content: '<img src="https://ex.com/h.png">',
    })).toBe('https://ex.com/thumb.jpg')
  })
})

describe('parseFeedString + normalizeItem (intégration, flux réels)', () => {
  it('Atom: id/summary/content sont correctement mappés', async () => {
    const { items } = await parseFeedString(ATOM_XML)
    expect(items).toHaveLength(1)
    const normalized = normalizeItem(items[0], NOW)
    expect(normalized).toMatchObject({
      guid: 'urn:uuid:atom-entry-1',
      title: 'Atom Entry',
      link: 'https://ex.com/atom-entry',
      description: 'Teaser summary',
      content: 'Full atom content',
      imageUrl: null,
    })
  })

  it('RSS 2.0: guid/description/content:encoded/media:thumbnail sont correctement mappés', async () => {
    const { items } = await parseFeedString(RSS_XML)
    expect(items).toHaveLength(1)
    const normalized = normalizeItem(items[0], NOW)
    expect(normalized).toMatchObject({
      guid: 'rss-item-1',
      title: 'RSS Item',
      link: 'https://ex.com/rss-item',
      description: 'RSS description',
      content: '<p>Full RSS content</p>',
      imageUrl: 'https://ex.com/thumb.jpg',
    })
  })
})
