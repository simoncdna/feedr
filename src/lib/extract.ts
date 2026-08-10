import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import sanitizeHtml from 'sanitize-html'
import { stripHtml } from '@/lib/text'

/**
 * En dessous, ce n'est pas un article. Le seuil existe parce qu'un site peut
 * répondre 200 avec une page de défi anti-bot : Le Monde en sert une de 209
 * caractères (mesuré le 2026-08-10). Compté sur le texte et non sur le HTML,
 * sinon quelques kilo-octets de balisage vide suffiraient à passer.
 */
const MIN_TEXT_CHARS = 500

/**
 * Règles d'assainissement, partagées avec le rendu (`ArticleDetail`). Elles
 * vivent ici parce que c'est ici qu'on assainit avant d'écrire en base : on ne
 * stocke jamais du HTML tiers brut.
 */
export const ARTICLE_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img'],
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ['src', 'alt'],
  },
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
  },
}

/**
 * Extrait le corps d'un article d'une page HTML complète.
 *
 * `url` doit être l'URL **finale** de la page (après redirections, telle que
 * `fetchPage` la rend) : elle sert de `<base href>`, et c'est ce qui rend les
 * `src`/`href` relatifs absolus. Sans cette balise, Readability les laisse
 * relatifs et toutes les images d'articles seraient cassées côté app (vérifié
 * le 2026-08-10). Une balise `<base>` déjà présente dans la page fait foi et
 * n'est pas écrasée — c'est la règle HTML, la première gagne.
 *
 * Rend `null` quand il n'y a rien d'exploitable : à l'appelant de retomber sur
 * le contenu du flux.
 */
export function extractArticle(html: string, url: string): string | null {
  let document: Document
  try {
    ;({ document } = parseHTML(html))
  } catch {
    return null
  }
  if (!document.querySelector('base[href]')) {
    const base = document.createElement('base')
    base.setAttribute('href', url)
    document.head?.prepend(base)
  }
  let parsed: { content?: string | null } | null = null
  try {
    // Readability mute le document qu'on lui passe ; il est jetable ici.
    parsed = new Readability(document).parse()
  } catch {
    return null
  }
  if (!parsed?.content) return null
  const safe = sanitizeHtml(parsed.content, ARTICLE_SANITIZE_OPTIONS)
  return stripHtml(safe).length < MIN_TEXT_CHARS ? null : safe
}
