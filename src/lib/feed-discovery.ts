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
