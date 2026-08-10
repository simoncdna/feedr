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

  // linkedom n'a pas d'URL de document et ne peut donc pas résoudre une balise
  // <base> relative comme le ferait un navigateur : sans la résolution
  // manuelle, ces trois cas laissent l'URL de l'image relative telle quelle
  // (mesuré le 2026-08-10). <base href="/"> et <base href="/blog/"> sont
  // courants dans les coquilles de SPA et les thèmes CMS.
  it.each([
    ['<base href="/">', 'https://exemple.fr/photo.jpg'],
    ['<base href="/blog/">', 'https://exemple.fr/blog/photo.jpg'],
    ['<base href="">', 'https://exemple.fr/blog/photo.jpg'],
  ])('résout %s contre l’URL de la page avant d’absolutiser', (base, attendu) => {
    const html = page(`<head>${base}</head><article>${corps}<img src="photo.jpg" alt="p"></article>`)
    expect(extractArticle(html, URL_PAGE)).toContain(attendu)
  })

  // Une balise <base> déjà absolue fait foi telle quelle — c'est le seul cas
  // où la résolution ne change rien à ce qui était déjà écrit dans la page.
  it('laisse intacte une balise <base> déjà absolue', () => {
    const html = page(
      `<head><base href="https://autre.example/sous/"></head>` +
        `<article>${corps}<img src="photo.jpg" alt="p"></article>`,
    )
    expect(extractArticle(html, URL_PAGE)).toContain('https://autre.example/sous/photo.jpg')
  })

  // Une balise <base> au href invalide ne doit pas faire lever extractArticle :
  // on retombe sur l'URL de la page, comme s'il n'y avait pas de <base>.
  it('retombe sur l’URL de la page quand la balise <base> est invalide', () => {
    const html = page(
      `<head><base href="http://"></head><article>${corps}<img src="photo.jpg" alt="p"></article>`,
    )
    expect(extractArticle(html, URL_PAGE)).toContain('https://exemple.fr/blog/photo.jpg')
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

  // Une imbrication pathologique (mesurée à 6 s pour 1000 niveaux sur cette
  // pile le 2026-08-10) doit être écartée avant Readability, pas après — sinon
  // le chemin d'ouverture d'un article resterait bloqué le temps du calcul. Un
  // article normalement structuré, bien en dessous du plafond, doit lui
  // toujours passer.
  it('rend null au-delà du plafond de profondeur, sans rejeter un article normal', () => {
    const imbrique = (profondeur: number) =>
      page(`<article>${'<div>'.repeat(profondeur)}${corps}${'</div>'.repeat(profondeur)}</article>`)
    expect(extractArticle(imbrique(205), URL_PAGE)).toBeNull()
    expect(extractArticle(imbrique(20), URL_PAGE)).not.toBeNull()
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
