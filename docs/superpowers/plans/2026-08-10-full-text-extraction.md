# Texte complet à l'ouverture d'un article — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quand on ouvre un article, aller chercher la page d'origine et en extraire le corps, pour lire dans Feedr plutôt que dans Safari.

**Architecture:** Un module métier pur `src/lib/extract.ts` (Readability sur un DOM linkedom, assainissement, seuil de longueur) ; une server fn `fetchFullContent` qui l'appelle à la demande et met le résultat en cache sur la ligne `articles` ; `ArticleDetail` déclenche l'appel à l'ouverture et affiche `fullContent ?? content ?? description`. Le téléchargement réutilise `src/lib/fetch-page.ts` sans le modifier.

**Tech Stack:** TanStack Start, Drizzle + Neon Postgres, `@mozilla/readability` 0.6.0, `linkedom` 0.18.13, `sanitize-html` (déjà présent), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-10-full-text-extraction-design.md`

---

## File Structure

| Fichier | Responsabilité |
|---|---|
| `src/lib/extract.ts` *(créé)* | HTML brut → corps d'article assaini, ou `null`. Aucun réseau, aucune dépendance au framework. |
| `src/lib/sanitize.ts` *(créé)* | Les règles d'assainissement, seules. Séparées d'`extract.ts` parce qu'`ArticleDetail` les importe côté client : les tirer du module d'extraction embarquerait linkedom et Readability dans le bundle du navigateur (~108 Ko gzip mesurés pour un objet de config de vingt lignes). |
| `tests/extract.test.ts` *(créé)* | Fixtures HTML en dur, aucun réseau. |
| `src/db/schema.ts` *(modifié)* | Deux colonnes sur `articles`. |
| `src/server/queries.ts` *(modifié)* | `getArticle` renvoie les deux nouveaux champs. |
| `src/server/mutations.ts` *(modifié)* | `fetchFullContent` : propriété, cache, fetch, écriture conditionnelle. |
| `src/mutations.ts` *(modifié)* | `useFullContent` : déclenche à l'ouverture, écrit dans le cache du détail. |
| `src/components/ArticleDetail.tsx` *(modifié)* | Affiche le contenu complet, squelette pendant l'attente. |
| `src/components/Skeletons.tsx` *(modifié)* | `ArticleBodySkeleton`, réutilisé par le détail. |

`extract.ts` reste dans `src/lib/` — c'est la règle du dépôt : métier sans dépendance au framework, donc testable seul. La server fn ne contient que l'accès base et le contrôle de propriété.

---

### Task 1 : le module d'extraction

**Files:**
- Create: `src/lib/extract.ts`
- Create: `tests/extract.test.ts`
- Modify: `package.json` (deux dépendances)

- [ ] **Step 1 : installer les dépendances**

```bash
npm i @mozilla/readability@^0.6.0 linkedom@^0.18.13
```

- [ ] **Step 2 : écrire le test qui échoue**

Créer `tests/extract.test.ts`. Les fixtures sont volontairement longues : le seuil de 500 caractères est le cœur du module, un corps trop court le ferait passer pour un échec.

```ts
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
```

- [ ] **Step 3 : lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run tests/extract.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/extract"`.

- [ ] **Step 4 : écrire l'implémentation**

Créer `src/lib/extract.ts` :

```ts
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
  let parsed: { content?: string | null } | null = null
  try {
    const { document } = parseHTML(html)
    // `document.head` n'est pas un simple accès : sur une entrée sans élément
    // racine (corps vide, texte nu, doctype seul), le getter de linkedom lève,
    // et un `?.` n'y peut rien. D'où la préparation du document à l'intérieur
    // du try — un 200 au corps vide servi en text/html suffit à y arriver.
    if (!document.querySelector('base[href]')) {
      const base = document.createElement('base')
      base.setAttribute('href', url)
      document.head.prepend(base)
    }
    // Readability mute le document qu'on lui passe ; il est jetable ici.
    parsed = new Readability(document).parse()
  } catch {
    return null
  }
  if (!parsed?.content) return null
  const safe = sanitizeHtml(parsed.content, ARTICLE_SANITIZE_OPTIONS)
  return stripHtml(safe).length < MIN_TEXT_CHARS ? null : safe
}
```

- [ ] **Step 5 : lancer les tests**

Run: `npx vitest run tests/extract.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6 : vérifier que rien d'autre n'a cassé**

Run: `npm test`
Expected: PASS — 126 tests d'avant + les 8 nouveaux = 134.

- [ ] **Step 7 : commit**

```bash
git add package.json package-lock.json src/lib/extract.ts tests/extract.test.ts
git commit -m "feat(extract): tirer le corps d'un article d'une page HTML"
```

---

### Task 2 : les colonnes de cache

**Files:**
- Modify: `src/db/schema.ts:25-40`

- [ ] **Step 1 : ajouter les deux colonnes**

Dans `src/db/schema.ts`, table `articles`, juste après `content` :

```ts
  content: text('content'),
  // Le corps extrait de la page d'origine, ou null si l'extraction a échoué.
  fullContent: text('full_content'),
  // Quand on a *tenté* — succès ou échec. Le couple avec full_content encode
  // trois états sans colonne de statut : jamais tenté (null), réussi (date +
  // contenu), échoué (date sans contenu). C'est ce qui empêche de refrapper un
  // paywall à chaque réouverture de l'article.
  fullContentAt: timestamp('full_content_at', { withTimezone: true }),
```

- [ ] **Step 2 : vérifier la cible de la base avant de pousser**

`drizzle.config.ts` refuse de démarrer sur l'endpoint de prod, mais il faut voir le garde passer plutôt que le supposer.

Run: `npx drizzle-kit push`
Expected: le récapitulatif annonce l'ajout de `full_content` et `full_content_at` sur `articles`, et **rien d'autre**. Si une suppression de colonne ou de table apparaît, répondre non et s'arrêter : la base visée n'est pas la bonne.

Si la commande s'arrête sur « DATABASE_URL pointe sur la base de production », ne pas contourner le garde : c'est `.env.local` qu'il faut faire pointer sur la branche de dev.

- [ ] **Step 3 : commit**

```bash
git add src/db/schema.ts
git commit -m "feat(db): colonnes de cache du texte complet sur articles"
```

---

### Task 3 : la server fn

**Files:**
- Modify: `src/server/queries.ts:74-107` (type `ArticleDetailData` + `getArticle`)
- Modify: `src/server/mutations.ts` (nouvelle fn en fin de fichier)

- [ ] **Step 1 : exposer les deux champs à la lecture**

Dans `src/server/queries.ts`, ajouter au type :

```ts
export type ArticleDetailData = {
  id: number
  title: string
  link: string
  description: string | null
  content: string | null
  fullContent: string | null
  fullContentAt: Date | null
  publishedAt: Date
  bookmarked: boolean
  feedTitle: string
}
```

et au `select` de `getArticle`, après `content: articles.content,` :

```ts
        fullContent: articles.fullContent,
        fullContentAt: articles.fullContentAt,
```

- [ ] **Step 2 : écrire la server fn**

À la fin de `src/server/mutations.ts`. Les imports `and`, `eq`, `isNull` et `fetchPage` sont déjà en tête du fichier ; ajouter seulement :

```ts
import { extractArticle } from '@/lib/extract'
```

puis :

```ts
/**
 * Écrit le résultat d'une tentative, sans jamais écraser celui d'une autre.
 *
 * Le `isNull` n'est pas décoratif : le garde de `fetchFullContent` lit
 * `fullContentAt` bien avant qu'on écrive, donc deux ouvertures simultanées du
 * même article (deux appareils, ou le double effet de StrictMode en dev)
 * passent toutes les deux. Sans cette clause, la seconde écraserait la
 * première — et un échec tardif effacerait un succès. Quand la course est
 * perdue, on relit ce que le gagnant a posé plutôt que de rendre son propre
 * résultat.
 */
async function recordAttempt(id: number, content: string | null): Promise<string | null> {
  const [gagne] = await db
    .update(articles)
    .set({ fullContent: content, fullContentAt: new Date() })
    .where(and(eq(articles.id, id), isNull(articles.fullContentAt)))
    .returning({ fullContent: articles.fullContent })
  if (gagne) return gagne.fullContent
  const [existant] = await db
    .select({ fullContent: articles.fullContent })
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1)
  return existant?.fullContent ?? null
}

/**
 * Va chercher le corps de l'article sur le site d'origine, une fois, et le met
 * en cache sur la ligne.
 *
 * `fetchPage` borne la chose à 10 s et porte la protection SSRF de la chaîne de
 * redirections — c'est pour ça qu'on passe par lui et pas par un `fetch` nu.
 */
export const fetchFullContent = createServerFn({ method: 'POST' })
  .validator((id: number) => id)
  .handler(async ({ data: id }): Promise<string | null> => {
    const sessionUser = await requireUser()
    const [article] = await db
      .select({
        link: articles.link,
        hasVideo: articles.hasVideo,
        fullContent: articles.fullContent,
        fullContentAt: articles.fullContentAt,
      })
      .from(articles)
      .innerJoin(feeds, eq(articles.feedId, feeds.id))
      .innerJoin(categories, eq(feeds.categoryId, categories.id))
      .where(and(eq(articles.id, id), eq(categories.userId, sessionUser.id)))
      .limit(1)
    // Le join sur categories.userId est le cloisonnement multi-utilisateurs :
    // sans lui, un id suffirait à faire scraper une page pour autrui.
    if (!article) return null
    if (article.fullContentAt) return article.fullContent
    // YouTube rend 0 caractère au travers de Readability (mesuré le
    // 2026-08-10) : la requête serait pure perte. On note la tentative pour ne
    // pas repasser ici à chaque ouverture.
    if (article.hasVideo) return recordAttempt(id, null)
    const page = await fetchPage(article.link)
    return recordAttempt(id, page ? extractArticle(page.html, page.url) : null)
  })
```

- [ ] **Step 3 : vérifier que le projet compile et que les tests passent**

Run: `npx tsc --noEmit && npm test`
Expected: aucune erreur de type, 134 tests PASS.

- [ ] **Step 4 : commit**

```bash
git add src/server/queries.ts src/server/mutations.ts
git commit -m "feat(server): fetchFullContent, une tentative par article"
```

---

### Task 4 : le déclenchement et l'affichage

**Files:**
- Modify: `src/mutations.ts` (nouveau hook)
- Modify: `src/components/Skeletons.tsx` (nouveau squelette de corps)
- Modify: `src/components/ArticleDetail.tsx:17-29` et `:61-66`

- [ ] **Step 1 : le squelette de corps**

Dans `src/components/Skeletons.tsx`, extraire les lignes de texte pour les partager entre le squelette de page et celui du corps — elles étaient déjà écrites une fois dans `ArticleSkeleton` :

```tsx
export function ArticleBodySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading article text" className="mt-8 space-y-3">
      {[95, 88, 92, 70, 84, 45].map((largeur, i) => (
        <div key={i} className="skeleton h-4" style={{ width: `${largeur}%` }} />
      ))}
    </div>
  )
}
```

et remplacer le bloc correspondant dans `ArticleSkeleton` (lignes 44-48) par :

```tsx
      <ArticleBodySkeleton />
```

- [ ] **Step 2 : le hook**

Dans `src/mutations.ts`, ajouter `useEffect` à l'import React (le fichier n'en importe pas encore) et `fetchFullContent` à l'import de `@/server/mutations` :

```ts
import { useEffect } from 'react'
```

puis en fin de fichier :

```ts
/**
 * Va chercher le texte complet à l'ouverture, une fois par article.
 *
 * Écrit la réponse dans le cache du détail au lieu d'invalider la clé : la
 * server fn rend déjà le contenu, un refetch serait un aller-retour pour rien.
 * Poser `fullContentAt` dans le cache est aussi ce qui désarme l'effet — sans
 * ça il se redéclencherait à chaque rendu.
 *
 * En cas d'échec réseau on ne réessaie pas : la server fn a de toute façon noté
 * la tentative côté base, et l'article retombe sur le contenu du flux.
 */
export function useFullContent(id: number, dejaTente: boolean) {
  const queryClient = useQueryClient()
  const { mutate, isPending } = useMutation({
    mutationFn: () => fetchFullContent({ data: id }),
    onSuccess: (fullContent) => {
      queryClient.setQueryData<ArticleDetailData | null>(articleQuery(id).queryKey, (a) =>
        a ? { ...a, fullContent, fullContentAt: new Date() } : a,
      )
    },
  })
  useEffect(() => {
    if (!dejaTente) mutate()
  }, [dejaTente, mutate])
  return isPending
}
```

- [ ] **Step 3 : brancher l'affichage**

Dans `src/components/ArticleDetail.tsx`, ajouter les imports :

```tsx
import { ArticleBodySkeleton } from '@/components/Skeletons'
import { ARTICLE_SANITIZE_OPTIONS } from '@/lib/sanitize'
import { useFullContent, useToggleBookmark } from '@/mutations'
```

remplacer le calcul de `safe` (lignes 17-29) par :

```tsx
  const enAttente = useFullContent(article.id, article.fullContentAt !== null)
  // Le texte complet d'abord, le flux en repli. Il est déjà assaini côté
  // serveur avant d'entrer en base ; on repasse ici parce que `content` et
  // `description` viennent du flux et n'ont, eux, jamais été filtrés.
  const raw = article.fullContent ?? article.content ?? article.description
  const safe = raw ? sanitizeHtml(raw, ARTICLE_SANITIZE_OPTIONS) : null
```

et le rendu du corps (lignes 61-66) par :

```tsx
      {enAttente ? (
        <ArticleBodySkeleton />
      ) : (
        safe && (
          <div
            className="prose prose-neutral mt-6 max-w-none dark:prose-invert prose-img:rounded"
            dangerouslySetInnerHTML={{ __html: safe }}
          />
        )
      )}
```

Le titre, la source, la date et le bouton bookmark restent hors du remplacement : c'est ce qui évite que la page saute sous le doigt quand le texte arrive.

- [ ] **Step 4 : vérifier types et tests**

Run: `npx tsc --noEmit && npm test`
Expected: aucune erreur, 134 tests PASS.

- [ ] **Step 5 : commit**

```bash
git add src/mutations.ts src/components/ArticleDetail.tsx src/components/Skeletons.tsx
git commit -m "feat(article): afficher le texte complet, squelette pendant la récupération"
```

---

### Task 5 : vérification sur un vrai build

Le mode dev ne prouve rien sur ce projet (chunks qui échouent sous Safari, ids de server fn absents du manifeste) — cette tâche n'est pas optionnelle.

- [ ] **Step 1 : construire et servir**

```bash
npm run build && npm start
```

Expected: build sans erreur, serveur sur le port 3001.

- [ ] **Step 2 : vérifier le chemin nominal**

Ouvrir un article d'un flux qui ne donne qu'un teaser (Numerama et The Verge ont été vérifiés le 2026-08-10).

Expected: squelette bref à la place du corps, puis le texte complet. Les images de l'article s'affichent — c'est le test de la balise `<base>`.

- [ ] **Step 3 : vérifier le cache**

Revenir au fil, rouvrir le même article.

Expected: le texte complet est là immédiatement, sans squelette. Dans l'onglet réseau, aucun appel à `fetchFullContent`.

- [ ] **Step 4 : vérifier le repli**

Ouvrir un article du Monde (paywall + anti-bot), puis un article vidéo (YouTube).

Expected: dans les deux cas, le teaser du flux s'affiche, sans message d'erreur, avec « Read on site » en bas. Rouvrir : pas de nouvelle tentative.

- [ ] **Step 5 : commit final**

```bash
git add -A
git commit -m "docs(agents): 134 tests avec l'extraction du texte complet"
```

Mettre à jour la ligne `npm test # 126 tests Vitest` d'`AGENTS.md` avant ce commit.

---

## Self-review

**Couverture du spec** — moteur Readability + linkedom (Task 1), seuil de 500 caractères sur le texte (Task 1, testé), pas de User-Agent navigateur (aucune tâche ne touche `fetch-page.ts`, donc les en-têtes actuels restent), balise `<base>` (Task 1, testée), deux colonnes et les trois états (Task 2), contrôle de propriété (Task 3), court-circuit vidéo (Task 3), `UPDATE` conditionnel (Task 3), repli silencieux (Task 4), squelette de corps seul (Task 4), tests sans réseau (Task 1). Le hors-périmètre du spec (pré-chargement au cron, bouton réessayer, contournement de paywall) n'a volontairement aucune tâche.

**Points laissés ouverts, à trancher à l'exécution** — aucun. Les deux qui existaient dans le spec (purge, réessai) y sont tranchés.
