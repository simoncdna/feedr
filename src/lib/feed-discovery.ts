import { isSafeFeedUrl } from '@/lib/url'

export type FeedCandidate = { url: string; label: string }

/**
 * Couche 2 : dérive une URL de flux de la seule URL de la page.
 *
 * Ne couvre que les sites qui ne servent qu'une coquille JavaScript, où
 * l'autodiscovery n'a rien à lire. YouTube (chaînes) et Mastodon déclarent leur
 * flux dans le <head> et n'ont donc rien à faire ici.
 */
export function platformFeeds(pageUrl: string): FeedCandidate[] {
  let u: URL
  try {
    u = new URL(pageUrl)
  } catch {
    return []
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, '')
  // Le parseur WHATWG a déjà normalisé les '..' du chemin : les segments sont sûrs.
  const segments = u.pathname.split('/').filter(Boolean)

  if (host === 'youtube.com' && segments.length === 1 && segments[0] === 'playlist') {
    const list = u.searchParams.get('list')
    if (!list) return []
    const id = encodeURIComponent(list)
    return [{ url: `https://www.youtube.com/feeds/videos.xml?playlist_id=${id}`, label: 'Videos' }]
  }

  if (host === 'reddit.com' && segments.length === 2 && segments[0] === 'r') {
    const sub = encodeURIComponent(segments[1])
    return [{ url: `https://www.reddit.com/r/${sub}/.rss`, label: 'Posts' }]
  }

  if (host === 'github.com' && segments.length === 2) {
    const owner = encodeURIComponent(segments[0])
    const repo = encodeURIComponent(segments[1])
    return [
      { url: `https://github.com/${owner}/${repo}/releases.atom`, label: 'Releases' },
      { url: `https://github.com/${owner}/${repo}/commits.atom`, label: 'Commits' },
    ]
  }

  return []
}

/** Lit la valeur d'un attribut, quel que soit l'ordre des attributs et le style de quotes. */
function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(tag)
  if (!m) return null
  return m[2] ?? m[3] ?? m[4] ?? null
}

/** Seule entité qui compte dans un href : &amp; sépare les paramètres de requête. */
function decodeAmp(href: string): string {
  return href.replace(/&amp;/gi, '&').replace(/&#0*38;/g, '&')
}

function isCommentFeed({ url, label }: FeedCandidate): boolean {
  return /comments/i.test(url) || /comments/i.test(label)
}

/**
 * Couche 3 : l'autodiscovery RSS, convention de 2002 que respectent la plupart
 * des sites — y compris les chaînes YouTube et les profils Mastodon.
 */
export function extractFeedLinks(html: string, baseUrl: string): FeedCandidate[] {
  const found: FeedCandidate[] = []
  const seen = new Set<string>()

  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = attr(tag, 'rel')
    if (!rel || !/\balternate\b/i.test(rel)) continue
    const type = attr(tag, 'type')
    if (!type || !/^\s*application\/(rss|atom)\+xml/i.test(type)) continue
    const href = attr(tag, 'href')
    if (!href) continue

    let resolved: URL
    try {
      resolved = new URL(decodeAmp(href), baseUrl)
    } catch {
      continue
    }
    const url = resolved.toString()
    if (!isSafeFeedUrl(url) || seen.has(url)) continue
    seen.add(url)
    found.push({ url, label: attr(tag, 'title')?.trim() || resolved.pathname })
  }

  // Tri stable : à pertinence égale l'ordre du document est conservé, et un
  // WordPress typique (articles + commentaires) retombe sur un seul candidat utile.
  return found.sort((a, b) => Number(isCommentFeed(a)) - Number(isCommentFeed(b)))
}
