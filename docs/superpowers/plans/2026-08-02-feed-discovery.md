# Découverte de flux à l'ajout — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre de coller l'adresse d'une page (chaîne YouTube, blog, dépôt GitHub) dans « Add a feed » et retrouver son flux automatiquement.

**Architecture:** Trois couches essayées dans l'ordre par `addFeed`, on s'arrête à la première qui donne un résultat — (1) l'URL est déjà un flux, (2) règles d'URL pures pour les trois sites à coquille JS, (3) autodiscovery en lisant les `<link rel="alternate">` de la page. La logique décidable sans réseau vit dans `src/lib/feed-discovery.ts` et est testée unitairement ; le téléchargement de page reste une fonction locale de `src/server/mutations.ts`.

**Tech Stack:** TypeScript, TanStack Start server functions, Vitest, React, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-08-02-feed-discovery-design.md`

---

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `src/lib/feed-discovery.ts` | **Créé.** `FeedCandidate`, `platformFeeds` (couche 2), `extractFeedLinks` (couche 3). Pur, aucun réseau, aucune dépendance au framework. |
| `tests/feed-discovery.test.ts` | **Créé.** Couvre les deux fonctions pures. |
| `src/server/mutations.ts` | **Modifié.** `fetchPage` (réseau, local), `resolveFeedCandidates`, et le handler `addFeed` réécrit. `AddFeedResult` gagne `candidates`. |
| `src/components/AddFeedForm.tsx` | **Modifié.** Affiche la liste des candidats quand il y en a plusieurs. |

Pourquoi cette coupe : `feed-discovery.ts` ne contient que ce qui est décidable sans réseau, donc entièrement testable sans mock. Le téléchargement de page n'a qu'un seul appelant et reste chez lui — une `createServerFn` appelée uniquement par une autre server fn n'est pas inscrite au manifeste du bundle serveur et renverrait 500 en production (voir AGENTS.md).

---

## Task 1 : `platformFeeds` — les règles d'URL

**Files:**
- Create: `src/lib/feed-discovery.ts`
- Test: `tests/feed-discovery.test.ts`

- [ ] **Step 1 : écrire le test qui échoue**

Créer `tests/feed-discovery.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { platformFeeds } from '@/lib/feed-discovery'

describe('platformFeeds', () => {
  it('dérive le flux d’une playlist YouTube', () => {
    expect(platformFeeds('https://www.youtube.com/playlist?list=PLabc123')).toEqual([
      { url: 'https://www.youtube.com/feeds/videos.xml?playlist_id=PLabc123', label: 'Videos' },
    ])
  })

  it('ignore une playlist sans identifiant', () => {
    expect(platformFeeds('https://www.youtube.com/playlist')).toEqual([])
  })

  // Les chaînes YouTube déclarent leur flux dans le <head> : les traiter ici
  // ferait doublon avec la couche 3 (mesuré le 2026-08-02, cf. la spec).
  it('ne touche pas aux chaînes YouTube, couvertes par l’autodiscovery', () => {
    expect(platformFeeds('https://www.youtube.com/@MKBHD')).toEqual([])
    expect(platformFeeds('https://www.youtube.com/channel/UCBJycsmduvYEL83R_U4JriQ')).toEqual([])
  })

  it('dérive le flux d’un subreddit, avec ou sans slash final', () => {
    const expected = [{ url: 'https://www.reddit.com/r/rss/.rss', label: 'Posts' }]
    expect(platformFeeds('https://www.reddit.com/r/rss')).toEqual(expected)
    expect(platformFeeds('https://www.reddit.com/r/rss/')).toEqual(expected)
  })

  it('ne dérive rien d’un fil de commentaires Reddit', () => {
    expect(platformFeeds('https://www.reddit.com/r/rss/comments/abc/titre/')).toEqual([])
  })

  it('propose releases et commits pour un dépôt GitHub', () => {
    expect(platformFeeds('https://github.com/facebook/react')).toEqual([
      { url: 'https://github.com/facebook/react/releases.atom', label: 'Releases' },
      { url: 'https://github.com/facebook/react/commits.atom', label: 'Commits' },
    ])
  })

  it('ne dérive rien d’une sous-page GitHub ni d’un profil', () => {
    expect(platformFeeds('https://github.com/facebook/react/issues')).toEqual([])
    expect(platformFeeds('https://github.com/facebook')).toEqual([])
  })

  it('ne dérive rien d’un site quelconque ni d’une chaîne invalide', () => {
    expect(platformFeeds('https://overreacted.io/')).toEqual([])
    expect(platformFeeds('pas-une-url')).toEqual([])
  })
})
```

- [ ] **Step 2 : lancer le test pour vérifier qu'il échoue**

```bash
npx vitest run tests/feed-discovery.test.ts
```

Attendu : ÉCHEC, `Failed to resolve import "@/lib/feed-discovery"`.

- [ ] **Step 3 : écrire l'implémentation minimale**

Créer `src/lib/feed-discovery.ts` :

```ts
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
```

- [ ] **Step 4 : lancer le test pour vérifier qu'il passe**

```bash
npx vitest run tests/feed-discovery.test.ts
```

Attendu : PASS, 8 tests.

- [ ] **Step 5 : commit**

```bash
git add src/lib/feed-discovery.ts tests/feed-discovery.test.ts
git commit -m "feat(feeds): dérive le flux des trois sites qui ne déclarent rien"
```

---

## Task 2 : `extractFeedLinks` — l'autodiscovery

**Files:**
- Modify: `src/lib/feed-discovery.ts`
- Test: `tests/feed-discovery.test.ts`

- [ ] **Step 1 : écrire le test qui échoue**

Ajouter à la fin de `tests/feed-discovery.test.ts`, et compléter l'import de la première ligne en `import { extractFeedLinks, platformFeeds } from '@/lib/feed-discovery'` :

```ts
describe('extractFeedLinks', () => {
  const base = 'https://exemple.fr/blog/'

  it('absolutise un href relatif et garde un href absolu', () => {
    const html = `
      <link rel="alternate" type="application/rss+xml" href="/rss.xml">
      <link rel="alternate" type="application/atom+xml" href="https://ailleurs.fr/atom.xml">
    `
    expect(extractFeedLinks(html, base)).toEqual([
      { url: 'https://exemple.fr/rss.xml', label: '/rss.xml' },
      { url: 'https://ailleurs.fr/atom.xml', label: '/atom.xml' },
    ])
  })

  it('absolutise un href protocol-relative', () => {
    const html = `<link rel="alternate" type="application/rss+xml" href="//cdn.fr/f.xml">`
    expect(extractFeedLinks(html, base)).toEqual([{ url: 'https://cdn.fr/f.xml', label: '/f.xml' }])
  })

  // Mastodon écrit href avant rel, YouTube écrit rel avant href : une regex qui
  // suppose un ordre rate un cas sur deux (mesuré le 2026-08-02, cf. la spec).
  it('accepte les attributs dans n’importe quel ordre et en quotes simples', () => {
    const html = `<link href='/a.xml' rel='alternate' type='application/rss+xml' title='Blog'>`
    expect(extractFeedLinks(html, base)).toEqual([
      { url: 'https://exemple.fr/a.xml', label: 'Blog' },
    ])
  })

  it('prend le title comme libellé, sinon le chemin', () => {
    const html = `
      <link rel="alternate" type="application/rss+xml" href="/a.xml" title="Articles">
      <link rel="alternate" type="application/rss+xml" href="/b.xml">
    `
    expect(extractFeedLinks(html, base).map((c) => c.label)).toEqual(['Articles', '/b.xml'])
  })

  it('décode les esperluettes encodées dans le href', () => {
    const html = `<link rel="alternate" type="application/rss+xml" href="/f?a=1&amp;b=2">`
    expect(extractFeedLinks(html, base)[0].url).toBe('https://exemple.fr/f?a=1&b=2')
  })

  it('relègue les flux de commentaires en fin de liste', () => {
    const html = `
      <link rel="alternate" type="application/rss+xml" href="/comments/feed" title="Comments Feed">
      <link rel="alternate" type="application/rss+xml" href="/feed" title="Articles">
    `
    expect(extractFeedLinks(html, base).map((c) => c.label)).toEqual(['Articles', 'Comments Feed'])
  })

  it('déduplique par URL', () => {
    const html = `
      <link rel="alternate" type="application/rss+xml" href="/f.xml">
      <link rel="alternate" type="application/rss+xml" href="https://exemple.fr/f.xml">
    `
    expect(extractFeedLinks(html, base)).toHaveLength(1)
  })

  it('ignore les balises qui ne sont pas des flux', () => {
    const html = `
      <link rel="alternate icon" type="image/png" href="/favicon.png">
      <link rel="alternate" media="handheld" href="https://m.exemple.fr/">
      <link rel="stylesheet" type="text/css" href="/style.css">
      <link rel="alternate" type="application/activity+json" href="/users/x">
    `
    expect(extractFeedLinks(html, base)).toEqual([])
  })

  it('rejette les candidats qui ne passent pas le garde-fou SSRF', () => {
    const html = `<link rel="alternate" type="application/rss+xml" href="http://localhost/feed">`
    expect(extractFeedLinks(html, base)).toEqual([])
  })

  it('ne trouve rien dans une page sans balise', () => {
    expect(extractFeedLinks('<html><body>rien</body></html>', base)).toEqual([])
  })
})
```

- [ ] **Step 2 : lancer le test pour vérifier qu'il échoue**

```bash
npx vitest run tests/feed-discovery.test.ts
```

Attendu : ÉCHEC, `extractFeedLinks is not a function` (ou une erreur d'import TypeScript).

- [ ] **Step 3 : écrire l'implémentation minimale**

Ajouter en haut de `src/lib/feed-discovery.ts`, sous les imports existants (il n'y en a pas encore — cette ligne devient la première du fichier) :

```ts
import { isSafeFeedUrl } from '@/lib/url'
```

Puis ajouter à la fin du fichier :

```ts
/** Lit la valeur d'un attribut, quel que soit l'ordre des attributs et le style de quotes. */
function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(tag)
  if (!m) return null
  return m[2] ?? m[3] ?? m[4] ?? null
}

/** Seule entité qui compte dans un href : &amp; sépare les paramètres de requête. */
function decodeAmp(href: string): string {
  return href.replace(/&amp;/gi, '&').replace(/&#0*38;/g, '&')
}

function isCommentFeed({ url, label }: FeedCandidate): boolean {
  return /comments/i.test(url) || /comments/i.test(label)
}

/**
 * Couche 3 : l'autodiscovery RSS, convention de 2002 que respectent la plupart
 * des sites — y compris les chaînes YouTube et les profils Mastodon.
 */
export function extractFeedLinks(html: string, baseUrl: string): FeedCandidate[] {
  const found: FeedCandidate[] = []
  const seen = new Set<string>()

  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
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
    found.push({ url, label: attr(tag, 'title')?.trim() || resolved.pathname })
  }

  // Tri stable : à pertinence égale l'ordre du document est conservé, et un
  // WordPress typique (articles + commentaires) retombe sur un seul candidat utile.
  return found.sort((a, b) => Number(isCommentFeed(a)) - Number(isCommentFeed(b)))
}
```

- [ ] **Step 4 : lancer le test pour vérifier qu'il passe**

```bash
npx vitest run tests/feed-discovery.test.ts
```

Attendu : PASS, 18 tests.

- [ ] **Step 5 : commit**

```bash
git add src/lib/feed-discovery.ts tests/feed-discovery.test.ts
git commit -m "feat(feeds): lit l'autodiscovery déclarée dans le head d'une page"
```

---

## Task 3 : la résolution côté serveur

**Files:**
- Modify: `src/server/mutations.ts` (imports en tête, `AddFeedResult` et handler `addFeed` autour des lignes 45-72)

Pas de test unitaire ici : cette tâche n'est que du câblage réseau, dont la logique décidable a déjà été couverte aux tâches 1 et 2. La vérification se fait au build (tâche 5).

- [ ] **Step 1 : ajouter l'import**

Dans `src/server/mutations.ts`, juste après la ligne `import { fetchFeed } from '@/lib/rss'` :

```ts
import { extractFeedLinks, platformFeeds, type FeedCandidate } from '@/lib/feed-discovery'
```

- [ ] **Step 2 : ajouter le téléchargement de page et la résolution**

Insérer juste avant la ligne `export type AddFeedResult = ...` :

```ts
const PAGE_TIMEOUT_MS = 10_000
const MAX_PAGE_CHARS = 512 * 1024
const MAX_REDIRECTS = 5

/** Lit le corps en s'arrêtant au plafond : l'autodiscovery est dans le <head>. */
async function readCapped(res: Response): Promise<string | null> {
  const reader = res.body?.getReader()
  if (!reader) return null
  const decoder = new TextDecoder()
  let html = ''
  try {
    while (html.length < MAX_PAGE_CHARS) {
      const { done, value } = await reader.read()
      if (done) break
      html += decoder.decode(value, { stream: true })
    }
  } catch {
    return null
  } finally {
    void reader.cancel()
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
async function fetchPage(startUrl: string): Promise<{ html: string; url: string } | null> {
  let url = startUrl
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isSafeFeedUrl(url)) return null
    let res: Response
    try {
      res = await fetch(url, {
        redirect: 'manual',
        headers: { accept: 'text/html,application/xhtml+xml' },
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      })
    } catch {
      return null
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) return null
      try {
        url = new URL(location, url).toString()
      } catch {
        return null
      }
      continue
    }
    if (!res.ok) return null
    if (!/text\/html|application\/xhtml\+xml/i.test(res.headers.get('content-type') ?? '')) {
      return null
    }
    const html = await readCapped(res)
    return html === null ? null : { html, url }
  }
  return null
}

/**
 * Couches 2 puis 3. Les règles d'URL passent en premier parce qu'elles ne
 * coûtent aucune requête, et que les sites qu'elles couvrent ne déclarent rien.
 */
async function resolveFeedCandidates(url: string): Promise<FeedCandidate[]> {
  const rules = platformFeeds(url)
  if (rules.length > 0) return rules
  const page = await fetchPage(url)
  return page ? extractFeedLinks(page.html, page.url) : []
}

/** Couche 1 : l'URL est-elle déjà un flux ? Renvoie son titre, ou null. */
async function readFeedTitle(url: string): Promise<string | null> {
  try {
    return (await fetchFeed(url)).title
  } catch {
    return null
  }
}
```

- [ ] **Step 3 : élargir le type de retour**

Remplacer la ligne :

```ts
export type AddFeedResult = { error: string | null }
```

par :

```ts
export type AddFeedResult = { error: string | null; candidates?: FeedCandidate[] }
```

- [ ] **Step 4 : réécrire le handler**

Remplacer le corps du handler `addFeed`, depuis `let title: string` jusqu'au `return { error: null }` final (lignes 60-71 de l'original), par :

```ts
    let feedUrl = url
    let title = await readFeedTitle(url)
    if (title === null) {
      const candidates = await resolveFeedCandidates(url)
      if (candidates.length === 0) return { error: 'No RSS feed found at this address' }
      // Plusieurs flux : c'est à l'utilisateur de trancher. On ne les valide pas,
      // ce serait une requête par candidat juste pour peupler une liste.
      if (candidates.length > 1) return { error: null, candidates }
      feedUrl = candidates[0].url
      title = await readFeedTitle(feedUrl)
      if (title === null) return { error: 'Could not read this RSS feed' }
    }
    try {
      await db.insert(feeds).values({ url: feedUrl, title, categoryId })
    } catch {
      return { error: 'This feed already exists' }
    }
    return { error: null }
```

Le handler complet doit alors se lire ainsi (les deux contrôles du haut sont inchangés) :

```ts
export const addFeed = createServerFn({ method: 'POST' })
  .validator((d: { url: string; categoryId: number }) => d)
  .handler(async ({ data: { url, categoryId } }): Promise<AddFeedResult> => {
    const sessionUser = await requireUser()
    if (!isSafeFeedUrl(url) || !Number.isInteger(categoryId) || categoryId <= 0) {
      return { error: 'Invalid URL or category' }
    }
    const ownedCategory = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.userId, sessionUser.id)))
      .limit(1)
    if (ownedCategory.length === 0) return { error: 'Invalid URL or category' }

    let feedUrl = url
    let title = await readFeedTitle(url)
    if (title === null) {
      const candidates = await resolveFeedCandidates(url)
      if (candidates.length === 0) return { error: 'No RSS feed found at this address' }
      if (candidates.length > 1) return { error: null, candidates }
      feedUrl = candidates[0].url
      title = await readFeedTitle(feedUrl)
      if (title === null) return { error: 'Could not read this RSS feed' }
    }
    try {
      await db.insert(feeds).values({ url: feedUrl, title, categoryId })
    } catch {
      return { error: 'This feed already exists' }
    }
    return { error: null }
  })
```

- [ ] **Step 5 : vérifier que rien n'est cassé**

```bash
npm test
```

Attendu : PASS, 90 tests (72 existants + 18 de la tâche 2).

- [ ] **Step 6 : commit**

```bash
git add src/server/mutations.ts
git commit -m "feat(feeds): l'ajout accepte l'adresse d'une page, pas seulement d'un flux"
```

---

## Task 4 : le choix dans le formulaire

**Files:**
- Modify: `src/components/AddFeedForm.tsx`

- [ ] **Step 1 : réécrire le composant**

Remplacer intégralement le contenu de `src/components/AddFeedForm.tsx` par :

```tsx
import { useState } from 'react'
import { CategorySelect } from '@/components/CategorySelect'
import type { FeedCandidate } from '@/lib/feed-discovery'
import { useAddFeed } from '@/mutations'

export function AddFeedForm({ categories }: { categories: { id: number; name: string }[] }) {
  const [url, setUrl] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(categories[0]?.id ?? null)
  // Les messages d'erreur viennent du serveur et sont vus par l'utilisateur :
  // 'Invalid URL or category', 'Could not read this RSS feed',
  // 'This feed already exists', 'No RSS feed found at this address'.
  // Ils ne sont pas reformulés ici.
  const [error, setError] = useState<string | null>(null)
  // Plusieurs flux trouvés : le serveur nous les renvoie et attend un choix.
  const [candidates, setCandidates] = useState<FeedCandidate[] | null>(null)
  const addFeed = useAddFeed()

  // Choisir un candidat re-soumet simplement la mutation avec son URL : elle
  // repasse alors par la couche 1 côté serveur et s'insère normalement.
  async function send(feedUrl: string) {
    if (categoryId === null) return
    setError(null)
    try {
      const result = await addFeed.mutateAsync({ url: feedUrl, categoryId })
      if (result.candidates) {
        setCandidates(result.candidates)
        return
      }
      if (result.error) {
        setError(result.error)
        return
      }
      setUrl('')
      setCandidates(null)
    } catch {
      setError('Could not read this RSS feed')
    }
  }

  // SubmitEvent et non FormEvent : `FormEvent` est déprécié dans les types React
  // installés (« FormEvent doesn't actually exist »).
  function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setCandidates(null)
    void send(url.trim())
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <input
        name="url"
        type="url"
        required
        value={url}
        onChange={(e) => {
          setUrl(e.target.value)
          setCandidates(null)
        }}
        placeholder="https://exemple.com"
        className="w-full rounded border border-rule bg-surface px-3 py-1.5 text-sm outline-none focus:border-foreground"
      />
      <CategorySelect categories={categories} value={categoryId} onChange={setCategoryId} />
      {candidates ? (
        <div className="space-y-2">
          <p className="mono-label text-muted">Several feeds found — pick one</p>
          <ul className="space-y-1">
            {candidates.map((candidate) => (
              <li key={candidate.url}>
                <button
                  type="button"
                  disabled={addFeed.isPending}
                  onClick={() => void send(candidate.url)}
                  className="w-full rounded border border-rule bg-surface px-3 py-2 text-left transition-colors hover:text-foreground disabled:opacity-50 motion-reduce:transition-none"
                >
                  <span className="block text-sm">{candidate.label}</span>
                  <span className="block truncate text-xs text-muted">{candidate.url}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <button
          disabled={addFeed.isPending}
          className="mono-label rounded border border-rule bg-surface px-3 py-1.5 transition-colors hover:text-foreground disabled:opacity-50 motion-reduce:transition-none"
        >
          {addFeed.isPending ? 'Adding…' : 'Add feed'}
        </button>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  )
}
```

- [ ] **Step 2 : vérifier que la suite de tests passe toujours**

```bash
npm test
```

Attendu : PASS, 90 tests.

- [ ] **Step 3 : commit**

```bash
git add src/components/AddFeedForm.tsx
git commit -m "feat(settings): quand plusieurs flux répondent, le formulaire laisse choisir"
```

---

## Task 5 : vérification de bout en bout

**Files:** aucun (vérification).

- [ ] **Step 1 : build de production**

Vérifier le comportement en dev ne prouve rien — les chunks échouent sous Safari en mode dev (AGENTS.md).

```bash
npm run build
```

Attendu : build réussi, sortie dans `.output/`.

- [ ] **Step 2 : servir le build**

```bash
npm start
```

- [ ] **Step 3 : essayer les quatre chemins dans Settings → Add a feed**

| URL collée | attendu |
|---|---|
| `https://www.youtube.com/@MKBHD` | ajouté directement (couche 3, un seul flux déclaré) |
| `https://overreacted.io/` | deux candidats proposés (RSS et Atom), le choix ajoute le bon |
| `https://github.com/facebook/react` | deux candidats, Releases et Commits |
| `https://exemple.invalid/rien` | `No RSS feed found at this address` |
| une URL de flux directe déjà en base | `This feed already exists` (non-régression) |

- [ ] **Step 4 : mettre à jour le compte de tests dans AGENTS.md**

Dans `AGENTS.md`, section « Commandes », remplacer :

```
npm test         # 72 tests Vitest
```

par :

```
npm test         # 90 tests Vitest
```

- [ ] **Step 5 : commit**

```bash
git add AGENTS.md
git commit -m "docs(agents): le compte de tests suit la découverte de flux"
```

- [ ] **Step 6 : commit s'il y a eu des retouches**

```bash
git add -A
git commit -m "fix(feeds): retouches après essai sur le build de production"
```

Ne rien committer si l'essai n'a rien révélé.

---

## Ce que ce plan ne fait pas

- **Pas de test de chemins conventionnels** (`/feed`, `/rss`…). Hacker News, qui n'a pas d'autodiscovery mais un flux sur `/rss`, continuera d'échouer : il faut coller l'URL du flux. Décision prise en brainstorming pour ne pas ouvrir de surface réseau spéculative.
- **Pas de test d'intégration réseau.** Les deux fonctions pures couvrent la logique ; le reste ne se testerait qu'en mockant `fetch`, ce qui validerait le mock plus que le code.
- **Pas de règle Mastodon ni YouTube-chaîne.** Mesuré : ces sites déclarent leur flux, la couche 3 les couvre.
