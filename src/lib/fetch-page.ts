import { isSafeFeedUrl } from '@/lib/url'

// La numérotation « couche 1/2/3 » citée dans les commentaires ci-dessous et
// dans src/server/mutations.ts est définie dans
// docs/superpowers/specs/2026-08-02-feed-discovery-design.md.

// Aligné sur le timeout du parseur RSS (src/lib/rss.ts, 10 s lui aussi) : si on
// retouche l'un, il faut retoucher l'autre.
const PAGE_TIMEOUT_MS = 10_000
const MAX_PAGE_CHARS = 512 * 1024
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

/** Lit le corps en s'arrêtant au plafond : l'autodiscovery est dans le <head>. */
async function readCapped(res: Response, contentType: string, url: string): Promise<string | null> {
  const reader = res.body?.getReader()
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
 * Télécharge une page HTML pour y chercher l'autodiscovery.
 *
 * `redirect: 'manual'` et revalidation à chaque saut : laisser fetch suivre les
 * redirections puis contrôler l'URL finale ne protégerait de rien, la requête
 * vers l'adresse interne serait déjà partie.
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
      try {
        url = new URL(location, url).toString()
      } catch {
        return null
      }
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
    const html = await readCapped(res, contentType, url)
    return html === null ? null : { html, url }
  }
  return null
}
