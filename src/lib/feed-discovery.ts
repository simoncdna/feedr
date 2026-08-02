import { isSafeFeedUrl } from '@/lib/url'

export type FeedCandidate = { url: string; label: string }

/**
 * Couche 2 : dérive une URL de flux de la seule URL de la page.
 *
 * Ne couvre que les sites qui ne servent qu'une coquille JavaScript, où
 * l'autodiscovery n'a rien à lire. YouTube (chaînes) et Mastodon déclarent bel
 * et bien leur flux via un <link rel="alternate"> — la couche 3 le lit quel
 * que soit l'endroit du document où il se trouve (pour YouTube, dans le
 * <body>, ~48 Ko après </head> : mesuré le 2026-08-02, cf. fetch-page.ts) —
 * donc rien à faire ici pour ces deux-là.
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
    // `searchParams.get()` décode sa valeur (contrairement à `u.pathname`, que le
    // parseur WHATWG laisse percent-encodé) : ré-encoder ici est correct et
    // nécessaire — à l'inverse des segments de chemin ci-dessous.
    const id = encodeURIComponent(list)
    return [{ url: `https://www.youtube.com/feeds/videos.xml?playlist_id=${id}`, label: 'Videos' }]
  }

  if (host === 'reddit.com' && segments.length === 2 && segments[0] === 'r') {
    // segments[1] vient de u.pathname, déjà percent-encodé : un second
    // encodeURIComponent doublerait l'encodage (%20 → %2520).
    return [{ url: `https://www.reddit.com/r/${segments[1]}/.rss`, label: 'Posts' }]
  }

  if (host === 'github.com' && segments.length === 2) {
    // Même chose : ré-encoder des segments déjà percent-encodés les encoderait
    // deux fois (facebook/re%20act → facebook/re%2520act).
    const [owner, repo] = segments
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

// Table volontairement bornée : les cinq entités XML, plus les quelques-unes
// que WordPress (et consorts) émettent réellement dans un <title> — pas la
// table HTML complète, pas de dépendance.
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  raquo: '»',
  laquo: '«',
  nbsp: ' ',
}

/**
 * Décode les entités numériques (décimal et hex) et le petit jeu d'entités
 * nommées ci-dessus. Sert à la fois pour `href` (où seule l'esperluette compte
 * vraiment, pour ne pas casser les paramètres de requête — ce que faisait
 * l'ancien `decodeAmp`) et pour le `label` affiché à l'utilisateur, où
 * WordPress émet par exemple `"Site &raquo; Comments Feed"`.
 */
function decodeEntities(text: string): string {
  return text.replace(/&(#\d+|#[xX][0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body[0] === '#') {
      const codePoint = /^#[xX]/.test(body) ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint)
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match
  })
}

// « chemin contenant /comments/ » : ancré sur un segment complet, pas une
// sous-chaîne — sinon /no-comments-here.xml se ferait démoter derrière un flux
// sans rapport. Le label, lui, reste une recherche libre : c'est justement ce
// qui attrape le "Comments Feed" de WordPress.
function isCommentFeed({ url, label }: FeedCandidate): boolean {
  return /(?:^|\/)comments(?:\/|$)/i.test(new URL(url).pathname) || /comments/i.test(label)
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
      resolved = new URL(decodeEntities(href), baseUrl)
    } catch {
      continue
    }
    const url = resolved.toString()
    if (!isSafeFeedUrl(url) || seen.has(url)) continue
    seen.add(url)
    const rawTitle = attr(tag, 'title')
    const label =
      (rawTitle ? decodeEntities(rawTitle).trim() : '') ||
      (resolved.pathname === '/' ? resolved.hostname : resolved.pathname)
    found.push({ url, label })
  }

  // Tri stable : à pertinence égale l'ordre du document est conservé. On ne
  // supprime pas les flux de commentaires, on les présente en dernier — le
  // choix reste à l'utilisateur.
  return found.sort((a, b) => Number(isCommentFeed(a)) - Number(isCommentFeed(b)))
}
