import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import sanitizeHtml from 'sanitize-html'
import { ARTICLE_SANITIZE_OPTIONS } from '@/lib/sanitize'
import { stripHtml } from '@/lib/text'

/**
 * En dessous, ce n'est pas un article. Le seuil existe parce qu'un site peut
 * répondre 200 avec une page de défi anti-bot : Le Monde en sert une de 209
 * caractères (mesuré le 2026-08-10). Compté sur le texte et non sur le HTML,
 * sinon quelques kilo-octets de balisage vide suffiraient à passer. Coïncide
 * avec le `DEFAULT_CHAR_THRESHOLD` interne de Readability (aussi 500), mais
 * les deux n'ont rien à voir : celui de Readability gouverne sa propre boucle
 * de nouvelle tentative en interne et ne l'empêche pas de rendre un contenu de
 * 209 caractères en sortie — ce n'est pas notre garde-fou, même nombre,
 * sémantique différente.
 */
const MIN_TEXT_CHARS = 500

/**
 * Profondeur d'imbrication au-delà de laquelle on abandonne avant Readability.
 * Mesuré sur cette pile, pour un article artificiellement imbriqué : depth
 * 100 → 29 ms, depth 500 → 883 ms, depth 1000 → 6 033 ms pour 12 Ko de HTML
 * (mesuré le 2026-08-10) — largement assez pour geler la fonction serverless
 * sur le chemin d'ouverture d'un article, alors que `fetchPage` admet jusqu'à
 * 2 Mo. Les articles réels plafonnent vers 15–30 niveaux d'imbrication.
 */
const MAX_DEPTH = 200

/**
 * Profondeur maximale du sous-arbre d'éléments de `root`, calculée par un
 * parcours itératif à pile explicite. Une version récursive ferait déborder
 * la pile d'appel sur un arbre pathologiquement profond — exactement le cas
 * que cette fonction existe pour détecter — d'où l'itération.
 */
function exceedsMaxDepth(root: Element, max: number): boolean {
  const stack: Array<{ el: Element; depth: number }> = [{ el: root, depth: 0 }]
  while (stack.length > 0) {
    // Non-null : on vient de vérifier stack.length > 0.
    const { el, depth } = stack.pop()!
    if (depth > max) return true
    for (const child of el.children) {
      stack.push({ el: child, depth: depth + 1 })
    }
  }
  return false
}

/**
 * Extrait le corps d'un article d'une page HTML complète.
 *
 * `url` doit être l'URL **finale** de la page (après redirections, telle que
 * `fetchPage` la rend). Un navigateur applique la première balise `<base>`
 * déclarée et résout lui-même son `href` — absolu ou relatif — contre l'URL
 * du document. linkedom n'a pas d'URL de document et ne sait pas faire cette
 * seconde résolution : il expose le `href` de la balise tel quel comme
 * `baseURI`. Un `<base href="/">` (courant dans les coquilles de SPA et les
 * thèmes CMS) resterait donc relatif, et Readability — qui s'appuie sur
 * `baseURI` pour absolutiser `src`/`href` — laisserait toutes les images
 * d'articles cassées plutôt que de lever (vérifié le 2026-08-10). On calcule
 * donc nous-mêmes l'équivalent de cette résolution — `new URL(declared, url)`
 * — et on réécrit la balise avec le résultat, qu'il y ait déjà une balise ou
 * pas ; une balise déjà absolue n'en est pas changée. Un `href` invalide, ou
 * résolu sur autre chose que `http:`/`https:`, retombe sur `url` plutôt que de
 * faire lever `extractArticle` ou de laisser les URLs relatives (détail du
 * choix des sélecteurs de lecture et d'écriture dans le corps).
 *
 * Rend `null` quand il n'y a rien d'exploitable : à l'appelant de retomber sur
 * le contenu du flux.
 */
export function extractArticle(html: string, url: string): string | null {
  let parsed: ReturnType<Readability['parse']> = null
  try {
    const { document } = parseHTML(html)
    // `document.head` n'est pas un simple accès : sur une entrée sans élément
    // racine (corps vide, texte nu, doctype seul), le getter de linkedom lève,
    // et un `?.` n'y peut rien. D'où la préparation du document à l'intérieur
    // du try — un 200 au corps vide servi en text/html suffit à y arriver.
    // On lit sur `base[href]` et on écrit sur `base` : ce n'est pas une
    // inattention. La spec HTML fait foi pour la base *déclarée* — c'est la
    // première balise pourvue d'un href qui compte — mais linkedom implémente
    // `baseURI` en `querySelector('base')`, la première balise `base` tout
    // court (node_modules/linkedom/esm/interface/node.js:68). Sur
    // `<base target="_blank"><base href="/blog/">`, écrire sur celle que la
    // spec désigne revenait à réécrire une balise que linkedom ne lit jamais :
    // il retombait sur la première, sans href, y lisait `null`, et toutes les
    // URLs restaient relatives.
    const declared = document.querySelector('base[href]')?.getAttribute('href') ?? url
    let resolved: string
    try {
      const candidate = new URL(declared, url)
      // Un schéma opaque (`data:`, `javascript:`) traverse `new URL` sans
      // lever ; c'est plus tard, dans Readability, que chaque
      // `new URL(relatif, base)` lève et laisse l'URL relative en place. Vu que
      // le HTML stocké est réinjecté tel quel dans la page article, une `src`
      // relative taperait sur Feedr et un `<a href="/settings">` d'un tiers
      // promènerait le lecteur dans ses propres réglages. On ignore donc une
      // base qui n'est pas du web, comme un href invalide.
      const web = candidate.protocol === 'http:' || candidate.protocol === 'https:'
      resolved = web ? candidate.toString() : url
    } catch {
      resolved = url
    }
    const target = document.querySelector('base')
    if (target) {
      target.setAttribute('href', resolved)
    } else {
      const base = document.createElement('base')
      base.setAttribute('href', resolved)
      document.head.prepend(base)
    }

    // Avant Readability, pas après : c'est le coût de Readability sur un
    // arbre pathologique qu'on veut éviter, pas seulement son résultat.
    //
    // Le parcours part des enfants élément du document, pas de
    // `documentElement` : chez linkedom celui-ci est le *premier* enfant
    // élément du document et non « la balise <html> ». Sur une page servie
    // sans racine (`<!doctype html><meta charset="utf-8"><div>…`) il vaut
    // `<meta>`, et le garde annonçait alors une profondeur de 0 en laissant
    // passer tout le reste : 4 062 ms mesurés à 1 200 niveaux, 49 466 ms à
    // 2 000, avec un contenu rendu au bout (2026-08-10). Aggravant, le temps
    // brûlé n'est même pas payé une fois pour toutes — `recordAttempt` n'est
    // atteint qu'après le retour d'`extractArticle`, donc une fonction tuée en
    // cours de route ne note aucune tentative et l'ouverture suivante repaie.
    if (Array.from(document.children).some((el) => exceedsMaxDepth(el, MAX_DEPTH))) {
      console.warn(`extractArticle: document trop profondément imbriqué pour ${url}`)
      return null
    }

    // Readability mute le document qu'on lui passe ; il est jetable ici.
    parsed = new Readability(document).parse()
  } catch (err) {
    console.warn(`extractArticle: extraction échouée pour ${url}`, err)
    return null
  }
  if (!parsed?.content) return null
  const safe = sanitizeHtml(parsed.content, ARTICLE_SANITIZE_OPTIONS)
  return stripHtml(safe).length < MIN_TEXT_CHARS ? null : safe
}
