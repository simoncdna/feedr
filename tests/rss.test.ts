import { describe, it, expect } from 'vitest'
import { normalizeItem, extractImage, detectVideo, parseFeedString, type RawItem } from '@/lib/rss'

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

// Forme réelle d'une entrée de chaîne YouTube : tout le contenu utile est niché
// dans <media:group>, jamais en enfant direct de <entry>.
const YOUTUBE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
  <title>Marques Brownlee</title>
  <entry>
    <id>yt:video:o4SSoURPODY</id>
    <title>Pixel 11 Impressions</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=o4SSoURPODY"/>
    <published>2026-08-12T14:00:35+00:00</published>
    <media:group>
      <media:title>Pixel 11 Impressions</media:title>
      <media:content url="https://www.youtube.com/v/o4SSoURPODY?version=3" type="application/x-shockwave-flash" width="640" height="390"/>
      <media:thumbnail url="https://i4.ytimg.com/vi/o4SSoURPODY/hqdefault.jpg" width="480" height="360"/>
      <media:description>Every year, a new Pixel, and new hopes and dreams...

Protect your Pixel at https://dbrand.com</media:description>
    </media:group>
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
      creator: '  Jane Doe  ',
      isoDate: '2026-07-29T10:00:00Z',
    }
    expect(normalizeItem(item, NOW)).toEqual({
      guid: 'abc-123',
      title: 'Un titre',
      link: 'https://ex.com/a',
      description: '<p>desc html</p>',
      content: '<p>contenu complet</p>',
      imageUrl: null,
      author: 'Jane Doe',
      hasVideo: false,
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
    expect(r?.title).toBe('Untitled')
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

  it('prend media:content sans medium/type si l’URL est une image (Le Monde)', () => {
    expect(extractImage({
      mediaContent: [{ $: { url: 'https://img.lemonde.fr/2026/photo.jpg' } }],
    })).toBe('https://img.lemonde.fr/2026/photo.jpg')
  })

  it('ignore media:content sans medium/type si l’URL n’est pas une image', () => {
    expect(extractImage({
      mediaContent: [{ $: { url: 'https://ex.com/clip.mp4' } }],
    })).toBeNull()
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

// Mesuré le 2026-08-13 sur une vraie chaîne : tout ce qui compte vit dans
// <media:group>, et media:content y déclare encore du Flash — d'où la détection
// par l'id du lien plutôt que par le type de media:content.
describe('flux YouTube (media:group)', () => {
  it('en tire la vignette, la description et hasVideo', async () => {
    const { items } = await parseFeedString(YOUTUBE_XML)
    expect(items).toHaveLength(1)
    const normalized = normalizeItem(items[0], NOW)
    expect(normalized).toMatchObject({
      guid: 'yt:video:o4SSoURPODY',
      title: 'Pixel 11 Impressions',
      link: 'https://www.youtube.com/watch?v=o4SSoURPODY',
      imageUrl: 'https://i4.ytimg.com/vi/o4SSoURPODY/hqdefault.jpg',
      hasVideo: true,
    })
    // La description de YouTube est du texte brut : ses retours à la ligne sont
    // porteurs de sens et doivent survivre au parsing.
    expect(normalized?.description).toContain('Every year, a new Pixel')
    expect(normalized?.description).toContain('\n')
  })
})

describe('detectVideo', () => {
  it('lien de vidéo YouTube, sans aucun média déclaré', () => {
    expect(detectVideo({ link: 'https://www.youtube.com/watch?v=o4SSoURPODY' })).toBe(true)
  })
  it('false sur un lien YouTube qui n’est pas une vidéo', () => {
    expect(detectVideo({ link: 'https://www.youtube.com/@MKBHD' })).toBe(false)
  })
  it('enclosure video/*', () => {
    expect(detectVideo({ enclosure: { url: 'https://ex.com/v.mp4', type: 'video/mp4' } })).toBe(true)
  })
  it('media:content medium=video', () => {
    expect(detectVideo({ mediaContent: [{ $: { url: 'https://ex.com/v', medium: 'video' } }] })).toBe(true)
  })
  it('iframe YouTube dans le contenu', () => {
    expect(detectVideo({ contentEncoded: '<p>x</p><iframe src="https://www.youtube.com/embed/abc"></iframe>' })).toBe(true)
  })
  it('balise video dans le contenu', () => {
    expect(detectVideo({ content: '<video controls src="/v.mp4"></video>' })).toBe(true)
  })
  it('false sans vidéo', () => {
    expect(detectVideo({ content: '<p>texte</p><img src="https://ex.com/i.jpg">' })).toBe(false)
  })
})
