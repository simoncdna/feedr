import { describe, it, expect } from 'vitest'
import { extractArticle } from '@/lib/extract'
import { stripHtml } from '@/lib/text'

const URL_PAGE = 'https://exemple.fr/blog/mon-article'

/** Huit paragraphes : assez pour passer le seuil de 500 caractères. */
const corps = Array.from(
  { length: 8 },
  (_, i) =>
    `<p>Phrase ${i} d'un article de test qui doit dépasser le seuil de cinq cents ` +
    `caractères pour être considéré comme du contenu réel et pas une page de défi.</p>`,
).join('')

function page(interieur: string): string {
  return `<!doctype html><html><head><title>T</title></head><body>${interieur}</body></html>`
}

describe('extractArticle', () => {
  it('extrait le corps et laisse dehors la navigation et le pied de page', () => {
    const html = page(
      `<nav><a href="/a">Accueil</a></nav>` +
        `<article><h1>Mon article</h1>${corps}</article>` +
        `<footer>Mentions légales</footer>`,
    )
    const out = extractArticle(html, URL_PAGE)
    expect(out).not.toBeNull()
    expect(out).toContain('Phrase 0')
    expect(out).not.toContain('Accueil')
    expect(out).not.toContain('Mentions légales')
  })

  // Le Monde répond 200 avec une page de défi de 209 caractères (mesuré le
  // 2026-08-10) : sans ce seuil on stockerait le défi comme corps d'article.
  it('rend null sur une page trop courte pour être un article', () => {
    const html = page('<p>A required part of this site could not load.</p>')
    expect(extractArticle(html, URL_PAGE)).toBeNull()
  })

  it('rend null sur une coquille JavaScript sans contenu', () => {
    const html = page('<div id="root"></div><script>window.x = 1</script>')
    expect(extractArticle(html, URL_PAGE)).toBeNull()
  })

  // Sans <base>, Readability laisse les URLs relatives telles quelles et toutes
  // les images d'articles seraient cassées dans l'app (mesuré le 2026-08-10).
  it('absolutise les URLs relatives contre l’URL de la page', () => {
    const html = page(`<article>${corps}<p><img src="/img/photo.jpg" alt="p"></p></article>`)
    expect(extractArticle(html, URL_PAGE)).toContain('https://exemple.fr/img/photo.jpg')
  })

  it('assainit le HTML extrait', () => {
    const html = page(
      `<article>${corps}<script>alert(1)</script>` +
        `<img src="/x.png" onerror="alert(2)"></article>`,
    )
    const out = extractArticle(html, URL_PAGE)
    expect(out).not.toBeNull()
    expect(out).not.toMatch(/<script/i)
    expect(out).not.toMatch(/onerror/i)
  })

  it('compte le seuil sur le texte, pas sur le balisage', () => {
    // Beaucoup de balises, presque pas de texte : doit être rejeté.
    const bavard = Array.from({ length: 60 }, () => '<p><span><b>a</b></span></p>').join('')
    expect(extractArticle(page(`<article>${bavard}</article>`), URL_PAGE)).toBeNull()
  })

  // Un 200 au corps vide servi en text/html arrive jusqu'ici, et le getter
  // `head` de linkedom lève sur une entrée sans élément racine : sans le
  // try/catch autour de la préparation du document, la fonction sortirait en
  // exception au lieu de rendre null.
  it('rend null sans lever sur une entrée sans élément racine', () => {
    for (const entree of ['', '   ', 'pas du html', '<!doctype html>']) {
      expect(extractArticle(entree, URL_PAGE)).toBeNull()
    }
  })
})

describe('stripHtml', () => {
  it('reste la mesure de longueur utilisée par le seuil', () => {
    expect(stripHtml('<p>Bonjour <b>toi</b></p>')).toBe('Bonjour toi')
  })
})
