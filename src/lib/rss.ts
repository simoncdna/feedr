import Parser from 'rss-parser'

export type RawItem = {
  guid?: string
  id?: string               // Atom: identifiant de l'entrée (pas de <guid> en Atom)
  title?: string
  link?: string
  content?: string          // RSS: HTML de <description> ; Atom: corps complet de l'entrée
  contentSnippet?: string
  contentEncoded?: string   // HTML de <content:encoded>
  creator?: string          // auteur (author / dc:creator) (RSS uniquement)
  summary?: string          // Atom: résumé/teaser de l'entrée
  isoDate?: string
  enclosure?: { url?: string; type?: string }
  mediaContent?: Array<{ $?: { url?: string; medium?: string; type?: string } }>
  mediaThumbnail?: Array<{ $?: { url?: string } }>
}

export type NormalizedItem = {
  guid: string
  title: string
  link: string
  description: string | null
  content: string | null
  imageUrl: string | null
  author: string | null
  hasVideo: boolean
  publishedAt: Date
}

export function extractImage(item: RawItem): string | null {
  if (item.enclosure?.url) {
    if (item.enclosure.type?.startsWith('image/')) return item.enclosure.url
    if (!item.enclosure.type && /\.(jpe?g|png|gif|webp|avif)($|\?)/i.test(item.enclosure.url)) {
      return item.enclosure.url
    }
  }
  const media = item.mediaContent?.find(
    (m) =>
      m.$?.url &&
      (m.$.medium === 'image' ||
        m.$.type?.startsWith('image/') ||
        (!m.$.medium && !m.$.type && /\.(jpe?g|png|gif|webp|avif)($|\?)/i.test(m.$.url))),
  )
  if (media?.$?.url) return media.$.url
  const thumbnail = item.mediaThumbnail?.find((m) => m.$?.url)
  if (thumbnail?.$?.url) return thumbnail.$.url
  const html = item.contentEncoded ?? item.content ?? ''
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i)
  return match?.[1] ?? null
}

export function detectVideo(item: RawItem): boolean {
  if (item.enclosure?.type?.startsWith('video/')) return true
  if (
    item.mediaContent?.some(
      (m) =>
        m.$?.medium === 'video' ||
        m.$?.type?.startsWith('video/') ||
        (!m.$?.medium && !m.$?.type && /\.(mp4|webm|mov)($|\?)/i.test(m.$?.url ?? '')),
    )
  ) {
    return true
  }
  const html = item.contentEncoded ?? item.content ?? ''
  return /<video[\s>]|<iframe[^>]+(youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com)/i.test(html)
}

export function normalizeItem(item: RawItem, now: Date): NormalizedItem | null {
  const candidate = item.link?.trim() ?? ''
  const link = /^https?:\/\//i.test(candidate) ? candidate : ''
  const guid = (item.guid ?? item.id)?.trim() || link
  if (!guid) return null
  const parsed = item.isoDate ? new Date(item.isoDate) : now
  // RSS 2.0: <description> → content, <content:encoded> → contentEncoded.
  // Atom: <summary> → summary (teaser), <content> → content (corps complet), pas de contentEncoded.
  const description = item.summary ?? item.content ?? null
  const content = item.contentEncoded
    ?? (item.summary && item.content && item.content !== item.summary ? item.content : null)
  return {
    guid,
    title: item.title?.trim() || 'Untitled',
    link: link || (/^https?:\/\//i.test(guid) ? guid : ''),
    description,
    content,
    imageUrl: extractImage(item),
    author: item.creator?.trim() || null,
    hasVideo: detectVideo(item),
    publishedAt: Number.isNaN(parsed.getTime()) ? now : parsed,
  }
}

// Aligné sur PAGE_TIMEOUT_MS dans src/lib/fetch-page.ts, 10 s lui aussi : si on
// retouche l'un, il faut retoucher l'autre.
const parser = new Parser({
  timeout: 10_000,
  customFields: {
    item: [
      ['content:encoded', 'contentEncoded'],
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: true }],
    ],
  },
})

function formatFeed(
  feed: { title?: string; items?: unknown[] },
  fallbackTitle: string,
): { title: string; items: RawItem[] } {
  return { title: feed.title?.trim() || fallbackTitle, items: (feed.items ?? []) as RawItem[] }
}

/** Parse une chaîne XML brute (RSS ou Atom) — utile pour les tests d'intégration. */
export async function parseFeedString(xml: string): Promise<{ title: string; items: RawItem[] }> {
  const feed = await parser.parseString(xml)
  return formatFeed(feed, '')
}

export async function fetchFeed(url: string): Promise<{ title: string; items: RawItem[] }> {
  const feed = await parser.parseURL(url)
  return formatFeed(feed, url)
}

export function selectNewItems(
  items: NormalizedItem[],
  knownGuids: Set<string>,
): NormalizedItem[] {
  const seen = new Set(knownGuids)
  const fresh: NormalizedItem[] = []
  for (const item of items) {
    if (seen.has(item.guid)) continue
    seen.add(item.guid)
    fresh.push(item)
  }
  return fresh
}
