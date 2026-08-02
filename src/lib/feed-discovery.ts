import { isSafeFeedUrl } from '@/lib/url'

export type FeedCandidate = { url: string; label: string }

/**
 * Couche 2 : dérive une URL de flux de la seule URL de la page.
 *
 * Ne couvre que les sites qui ne servent qu'une coquille JavaScript, où
 * l'autodiscovery n'a rien à lire. YouTube (chaînes) et Mastodon déclarent leur
 * flux dans le <head> et n'ont donc rien à faire ici (mesuré le 2026-08-02).
 *
 * Les URLs produites viennent d'hôtes https codés en dur : contrairement aux
 * candidats d'`extractFeedLinks`, elles ne passent pas par `isSafeFeedUrl` —
 * leur sûreté tient à leur construction, pas à une vérification.
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
  const m = new RegExp(`(?<![-\\w])${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(tag)
  if (!m) return null
  return m[2] ?? m[3] ?? m[4] ?? null
}

/** Entités qui comptent dans un href : toutes les graphies de &, qui sépare les paramètres. */
function decodeAmp(href: string): string {
  return href.replace(/&(?:amp|#0*38|#[xX]0*26);/gi, '&')
}

function isCommentFeed({ url, label }: FeedCandidate): boolean {
  return /comments/i.test(new URL(url).pathname) || /comments/i.test(label)
}

/**
 * Couche 3 : l'autodiscovery RSS, convention de 2002 que respectent la plupart
 * des sites — y compris les chaînes YouTube et les profils Mastodon.
 */
export function extractFeedLinks(html: string, baseUrl: string): FeedCandidate[] {
  const found: FeedCandidate[] = []
  const seen = new Set<string>()

  // On retire les commentaires HTML avant de scanner : un <link> commenté ne
  // doit pas être traité comme un flux réel. Compromis assumés : une balise
  // est perdue si un attribut contient un '>' littéral, et le test sur `type`
  // est volontairement un préfixe pour accepter "application/rss+xml; charset=utf-8".
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '')
  for (const tag of withoutComments.match(/<link\b[^>]*>/gi) ?? []) {
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
    const label = attr(tag, 'title')?.trim() || (resolved.pathname === '/' ? resolved.hostname : resolved.pathname)
    found.push({ url, label })
  }

  // Tri stable : à pertinence égale l'ordre du document est conservé. On ne
  // supprime pas les flux de commentaires, on les présente en dernier — le
  // choix reste à l'utilisateur.
  return found.sort((a, b) => Number(isCommentFeed(a)) - Number(isCommentFeed(b)))
}
