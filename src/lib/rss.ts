import Parser from 'rss-parser'

export type RawItem = {
  guid?: string
  title?: string
  link?: string
  content?: string          // HTML de <description>
  contentSnippet?: string
  contentEncoded?: string   // HTML de <content:encoded>
  isoDate?: string
  enclosure?: { url?: string; type?: string }
  mediaContent?: Array<{ $?: { url?: string; medium?: string; type?: string } }>
}

export type NormalizedItem = {
  guid: string
  title: string
  link: string
  description: string | null
  content: string | null
  imageUrl: string | null
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
    (m) => m.$?.url && (m.$.medium === 'image' || m.$.type?.startsWith('image/')),
  )
  if (media?.$?.url) return media.$.url
  const html = item.contentEncoded ?? item.content ?? ''
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i)
  return match?.[1] ?? null
}

export function normalizeItem(item: RawItem, now: Date): NormalizedItem | null {
  const link = item.link?.trim() ?? ''
  const guid = item.guid?.trim() || link
  if (!guid) return null
  const parsed = item.isoDate ? new Date(item.isoDate) : now
  return {
    guid,
    title: item.title?.trim() || 'Sans titre',
    link,
    description: item.content ?? null,
    content: item.contentEncoded ?? null,
    imageUrl: extractImage(item),
    publishedAt: Number.isNaN(parsed.getTime()) ? now : parsed,
  }
}

const parser = new Parser({
  timeout: 10_000,
  customFields: {
    item: [
      ['content:encoded', 'contentEncoded'],
      ['media:content', 'mediaContent', { keepArray: true }],
    ],
  },
})

export async function fetchFeed(url: string): Promise<{ title: string; items: RawItem[] }> {
  const feed = await parser.parseURL(url)
  return { title: feed.title?.trim() || url, items: (feed.items ?? []) as RawItem[] }
}
