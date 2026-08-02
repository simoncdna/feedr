import { isSafeFeedUrl } from '@/lib/url'

// La numérotation « couche 1/2/3 » citée dans les commentaires ci-dessous et
// dans src/server/mutations.ts est définie dans
// docs/superpowers/specs/2026-08-02-feed-discovery-design.md.

// Aligné sur le timeout du parseur RSS (src/lib/rss.ts, 10 s lui aussi) : si on
// retouche l'un, il faut retoucher l'autre.
const PAGE_TIMEOUT_MS = 10_000
// Un garde-fou contre une réponse sans fin, pas une estimation de la taille du
// <head> : YouTube (ex. /@MKBHD) déclare son flux vers 730 Ko dans la page,
// derrière une masse de JSON/JS inline. 512 Ko coupait avant d'y arriver.
export const MAX_PAGE_CHARS = 2 * 1024 * 1024
const MAX_REDIRECTS = 5

function discard(res: Response): void {
  void res.body?.cancel().catch(() => {})
}

/** Décode selon le charset déclaré : `TextDecoder()` seul suppose UTF-8 et corromprait
 * les pages servies dans un autre jeu de caractères (ex. iso-8859-1). */
function decoderFor(contentType: string): TextDecoder {
  const charset = /charset=([^;\s]+)/i.exec(contentType)?.[1]
  try {
    return new TextDecoder(charset ?? 'utf-8')
  } catch {
    // Label de charset inconnu ou invalide : repli sur UTF-8 plutôt que planter.
    return new TextDecoder()
  }
}

/**
 * Lit le corps jusqu'à la fin du flux ou jusqu'au plafond `MAX_PAGE_CHARS`.
 *
 * Ne s'arrête délibérément pas à `</head>`. Une version antérieure le faisait,
 * sur l'hypothèse que l'autodiscovery vit dans le `<head>` — hypothèse fausse
 * pour le site le plus important que cible cette fonctionnalité : YouTube
 * (ex. /@MKBHD) déclare son flux via un `<link rel="alternate">` posé environ
 * 48 Ko *après* `</head>`, dans le `<body>` (mesuré le 2026-08-02 :
 * `</head>` à l'octet 685 259, le lien à 733 674, page de 2,5 Mo). S'arrêter au
 * `<head>` manquait donc précisément le cas qu'il fallait couvrir. Le plafond
 * ci-dessus est un garde-fou contre une réponse sans fin, pas une estimation de
 * la taille d'un head — ne pas réintroduire cette optimisation sans revérifier
 * ce cas.
 */
export async function readCapped(
  stream: ReadableStream<Uint8Array> | null | undefined,
  contentType: string,
  url: string,
): Promise<string | null> {
  const reader = stream?.getReader()
  if (!reader) return null
  const decoder = decoderFor(contentType)
  let html = ''
  try {
    while (html.length < MAX_PAGE_CHARS) {
      const { done, value } = await reader.read()
      if (done) break
      html += decoder.decode(value, { stream: true })
    }
  } catch (err) {
    console.warn(`fetchPage: read failed for ${url}`, err)
    return null
  } finally {
    // Sur un flux en erreur, cancel() rejette : un `void` nu laisserait une
    // rejection non gérée remonter jusqu'à faire sortir le process.
    reader.cancel().catch(() => {})
  }
  return html
}

/**
 * Décision prise à chaque saut de redirection : résout `Location` (absolu ou
 * relatif) contre l'URL courante, puis revalide avec `isSafeFeedUrl`. C'est ici
 * — et seulement ici — que vit la protection SSRF de la chaîne de
 * redirections : suivre `location.href` sans repasser par ce filtre laisserait
 * un serveur malveillant rediriger vers une adresse interne.
 */
export function resolveRedirect(location: string, currentUrl: string): string | null {
  let next: string
  try {
    next = new URL(location, currentUrl).toString()
  } catch {
    return null
  }
  return isSafeFeedUrl(next) ? next : null
}

/**
 * Télécharge une page HTML pour y chercher l'autodiscovery.
 *
 * `redirect: 'manual'` et revalidation à chaque saut (`resolveRedirect`) :
 * laisser fetch suivre les redirections puis contrôler l'URL finale ne
 * protégerait de rien, la requête vers l'adresse interne serait déjà partie.
 */
export async function fetchPage(startUrl: string): Promise<{ html: string; url: string } | null> {
  let url = startUrl
  // Un seul budget pour toute la chaîne de redirections, pas un par saut :
  // sinon MAX_REDIRECTS sauts pourraient coûter jusqu'à 6× PAGE_TIMEOUT_MS.
  const deadline = AbortSignal.timeout(PAGE_TIMEOUT_MS)
  // hop <= MAX_REDIRECTS : jusqu'à MAX_REDIRECTS redirections suivies, donc 6 requêtes au plus.
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isSafeFeedUrl(url)) return null
    let res: Response
    try {
      res = await fetch(url, {
        redirect: 'manual',
        headers: { accept: 'text/html,application/xhtml+xml' },
        signal: deadline,
      })
    } catch (err) {
      console.warn(`fetchPage: fetch failed for ${url}`, err)
      return null
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      discard(res)
      if (!location) return null
      const next = resolveRedirect(location, url)
      if (!next) return null
      url = next
      continue
    }
    if (!res.ok) {
      discard(res)
      return null
    }
    const contentType = res.headers.get('content-type') ?? ''
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      discard(res)
      return null
    }
    const html = await readCapped(res.body, contentType, url)
    return html === null ? null : { html, url }
  }
  return null
}
