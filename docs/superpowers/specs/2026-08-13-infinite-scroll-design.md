# Défilement infini du fil et des bookmarks

Le fil s'arrête au 40ᵉ article et rien ne charge la suite : `listFeedArticles`
porte un `.limit(40)` et `ArticleList` se contente d'un `map` sur ce qu'on lui
donne. Ni curseur, ni `useInfiniteQuery`, ni virtualisation.

Le plafond mord surtout sur « All ». Vue par catégorie, 40 articles couvrent
plusieurs jours ; toutes catégories confondues, la fenêtre est mangée par le flux
le plus bavard — 327 des 367 articles de production viennent de Hacker News — et
peut ne représenter que quelques heures. Le plafond est le même partout, c'est sa
portée temporelle qui s'effondre.

`listBookmarks`, à l'inverse, n'a **aucune** limite : elle renvoie tout. Et comme
les articles bookmarkés échappent à la purge, c'est la seule vue dont la charge
grossit sans borne. Les deux vues sont donc traitées ici.

## Ce que « infini » veut dire ici

La purge supprime tout ce qui dépasse 30 jours, donc le corpus est borné : 367
articles en production aujourd'hui. « Défilement infini » signifie atteindre le
bout en une dizaine de pages, pas défiler sans fin. La liste se termine, et le dit.

## Pagination par curseur composite

`listFeedArticles` et `listBookmarks` prennent un curseur et rendent
`{ rows, nextCursor }`. `nextCursor` vaut `null` dès qu'une page rend moins de 40
lignes.

Le curseur est le couple **`(publishedAt, id)`**, et l'ordre passe de
`published_at DESC` à `published_at DESC, id DESC`.

Ce n'est pas une précaution gratuite. Les égalités de `published_at` sont
courantes dans ce corpus : `normalizeItem` (`src/lib/rss.ts`) replie sur `now`
tout item de flux sans date, donc un lot entier partage un timestamp à la seconde
près. Sans ordre **total**, deux lignes de même date peuvent sortir dans un ordre
différent d'une requête à l'autre, et la pagination saute alors des articles ou
les répète. Le filtre est une comparaison de tuples Postgres :

```sql
(published_at, id) < (curseur_published_at, curseur_id)
```

**Curseur et non `OFFSET`** : le poller insère pendant qu'on lit. Avec un
`OFFSET`, un relevé arrivé entre deux pages décale toute la fenêtre et fait
relire des lignes déjà vues. Un curseur ancré sur une ligne précise y est immune.

Pas de nouvel index. La requête joint `feeds` et `categories` pour filtrer sur
`categories.userId`, qu'un index sur `(published_at, id)` ne couvrirait pas, et à
367 lignes le tri est gratuit. À revoir si le corpus prend un ordre de grandeur.

## Les fonctions pures, à part

Nouveau `src/lib/feed-pages.ts`, **génériques sur le type de ligne** :

```
FeedCursor          = { publishedAt: Date; id: number }
FeedPage<Row>       = { rows: Row[]; nextCursor: FeedCursor | null }
InfiniteFeed<Row>   = { pages: FeedPage<Row>[]; pageParams: unknown[] }

flattenPages(data)             → Row[]
patchRow(data, id, patch)      → InfiniteFeed<Row>
pickHero(rows)                 → Row | undefined
orderWithHero(rows, hero)      → Row[]
```

Génériques, donc sans aucune dépendance à `ArticleCardData` : le module ne tire ni
`@/db`, ni React, ni le framework. C'est ce qui le rend testable dans
l'environnement `node` de Vitest — importer `@/mutations` dans un test tirerait
`@/server/mutations`, donc `@/db`, qui instancie le client Drizzle à l'import.

## Le piège de la forme du cache

`useToggleBookmark` écrit aujourd'hui :

```ts
queryClient.setQueryData<ArticleCardData[]>(feedKey, (rows) => patchList(rows, id, bookmarked))
```

En paginé, la donnée sous cette clé devient `{ pages, pageParams }`. Ce patch ne
trouverait plus rien, sans erreur ni avertissement : **la bascule optimiste du
swipe cesserait de répondre immédiatement** et attendrait l'aller-retour serveur.
C'est exactement le gain que `src/mutations.ts` documente comme explicitement
voulu. `patchRow` remplace `patchList` sur les clés paginées, et c'est le premier
comportement couvert par un test.

Les **clés de cache ne changent pas** (`['feed', categoryId]`, `['bookmarks']`) :
`useToggleBookmark` invalide par préfixe `['feed']`, et renommer les clés casserait
cette invalidation en silence.

## Le piège du héros mobile

`src/routes/index.tsx` calcule `hero = rows.find((r) => r.imageUrl) ?? rows[0]` et
place cet article en tête. Sur une liste paginée, `rows` grandit : si la page 1
n'a aucune image et que la page 2 en apporte une, le héros changerait et **le fil
se réordonnerait sous le doigt du lecteur en pleine lecture**.

Le héros est donc choisi sur la **première page seulement**. Il est alors figé pour
toute la session de défilement, quoi qu'apportent les pages suivantes.

## La sentinelle

Nouveau hook `useInfiniteScroll(ref, { hasNextPage, isFetchingNextPage, fetchNextPage })`
et un `<div>` vide en fin de liste.

`IntersectionObserver` avec `rootMargin: '600px'`, pour charger avant que le bas
soit atteint. `root: null` couvre les deux configurations de défilement de l'app :
l'observateur tient compte du rognage par les conteneurs intermédiaires, donc la
colonne `lg:overflow-y-auto` de `ResizablePanes` en desktop se comporte comme le
défilement de fenêtre en mobile. Si l'usage démentait ça, le repli est de passer
l'élément du volet en `root`.

L'observateur est débranché quand `hasNextPage` est faux, et le hook ne redemande
pas une page pendant qu'une est en vol.

## Les deux bouts de liste

Pendant le chargement d'une page : deux rangées de squelette, reprises de la forme
déjà écrite dans `src/components/Skeletons.tsx` — un squelette qui ne correspond
pas au contenu produit un saut au remplacement, ce que le fichier documente déjà.

Quand `hasNextPage` tombe à faux : une ligne discrète « End of feed ». L'interface
de l'app est en anglais ; seuls les commentaires sont en français.

## Tests

`tests/feed-pages.test.ts`, sur ce qui est pur et cassable :

- `patchRow` traverse toutes les pages, modifie la bonne ligne et une seule, et
  laisse l'objet d'origine intact (le cache de React Query ne doit pas être muté).
- `patchRow` sur un id absent rend une donnée équivalente, sans lever.
- `pickHero` prend la première ligne avec image, replie sur la première ligne, et
  rend `undefined` sur une liste vide.
- `orderWithHero` met le héros en tête sans le dupliquer et préserve l'ordre du
  reste.
- `flattenPages` concatène dans l'ordre des pages.

La pagination serveur n'est pas testable sans base — même contrainte que pour les
fonctionnalités précédentes, et le dépôt interdit d'utiliser une vraie base comme
cible de test.

## Hors périmètre

- **Virtualisation de la liste.** À 367 lignes, un `map` suffit ; virtualiser
  casserait le défilement natif et les gestes de `SwipeRow`.
- ~~Restauration de la position de défilement au retour d'un article.~~ Traité
  depuis, et ce n'était pas un manque de restauration : `scrollRestoration` est
  activé dans `src/router.tsx` depuis toujours et fonctionne, mais il ne
  s'applique qu'aux **retours** d'historique. Le lien « ← Back » était un
  `<Link to="/">`, donc une navigation *avant*, qui empile une nouvelle entrée —
  et une nouvelle entrée démarre au sommet. Mesuré le 2026-08-13 : 4750 px
  restaurés par le bouton du navigateur, 0 par le lien. Voir
  `src/components/BackButton.tsx`.
- **La cascade d'animation reste inchangée.** Sa classe est retirée après 800 ms,
  donc les rangées ajoutées ensuite n'héritent de rien. Une page qui arriverait
  dans ces 800 ms animerait ses rangées : cas rare, et le corriger demanderait de
  complexifier une mécanique déjà délicate.
