# Texte complet à l'ouverture d'un article

Aujourd'hui `ArticleDetail` affiche `article.content ?? article.description`,
c'est-à-dire ce que le flux a bien voulu donner. La plupart des flux suivis ne
donnent qu'un teaser : ouvrir un article dans Feedr sert alors surtout à cliquer
sur « Read on site », et la lecture se termine dans Safari.

L'objectif : quand on ouvre un article, aller chercher la page et en extraire le
corps, pour lire dans Feedr. Le contenu complet devient la norme, le teaser
devient le repli.

## Ce qui existe déjà et qu'on ne réécrit pas

`src/lib/fetch-page.ts` télécharge une page HTML avec tout ce qu'il faut :
timeout de 10 s partagé sur toute la chaîne, `redirect: 'manual'` avec
revalidation SSRF à chaque saut, plafond de 2 Mo, refus de tout ce qui n'est pas
`text/html`, et **refus de toute réponse non-2xx** (`res.ok`). Il a été écrit
pour l'autodiscovery mais ne suppose rien d'elle. On l'utilise tel quel, sans le
modifier.

`sanitize-html` est déjà installé et utilisé dans `ArticleDetail`.

Ce qui manque est l'extraction du corps dans le HTML : virer nav, pubs, blocs
« à lire aussi », commentaires.

## Le moteur : Readability + linkedom

`@mozilla/readability` (0.6.0) est l'algorithme de la vue Lecture de Firefox.
Il lui faut un DOM ; `linkedom` (0.18.13) en fournit un léger, sans le poids de
jsdom. Écrire l'extraction à la main revenait à réimplémenter mal quinze ans de
règles ; passer par un service tiers (`r.jina.ai` et consorts) revenait à lui
confier la liste de tout ce qu'on lit.

Mesures faites le 2026-08-10 avec cette pile exacte, avant d'écrire cette spec :

| page | HTML | texte extrait | verdict |
|---|---|---|---|
| `overreacted.io/static-as-a-server/` | 41 Ko | 3 987 car. | ✅ corps propre |
| `numerama.com/…/revolut-…` | 357 Ko | 4 896 car. | ✅ corps propre |
| `theverge.com/…/no-dogs-in-space-…` | 391 Ko | 2 147 car. | ✅ corps propre |
| `lemonde.fr/planete/article/…` | 3 Ko | 209 car. | ⛔ anti-bot Cloudflare |
| `youtube.com/watch?v=…` | 1 265 Ko | 0 car. | ⛔ Readability rend `null` |

Deux conséquences qui dimensionnent le reste.

**Un seuil de longueur est nécessaire.** Le Monde répond `200` avec une page de
défi anti-bot : sans seuil, on stockerait « A required part of this site couldn't
load » comme corps d'article. On rejette en dessous de **500 caractères** de
texte (mesuré après `stripHtml`, pas sur le HTML).

**On n'envoie pas de User-Agent de navigateur.** Testé : avec un UA Chrome, Le
Monde passe de la page de défi à un `402 Accès restreint` de 701 caractères —
soit *au-dessus* du seuil. Ce n'est que le `res.ok` de `fetchPage` qui l'arrête.
Se faire passer pour un navigateur ne débloque donc pas le paywall, transforme un
échec franc en quasi-faux-positif, et ment sur qui on est. On garde les en-têtes
actuels de `fetchPage`.

## Le module d'extraction

Nouveau `src/lib/extract.ts`, métier pur, sans dépendance au framework ni au
réseau — donc testable seul, comme le reste de `src/lib/`.

```
extractArticle(html: string, url: string): string | null
```

Parse via linkedom, passe à Readability, assainit le HTML retourné avec
`sanitize-html` (mêmes règles que `ArticleDetail`), et rend `null` si Readability
échoue ou si le texte tombe sous le seuil. **L'assainissement a lieu ici**, côté
serveur : on ne stocke jamais en base du HTML tiers non nettoyé. `ArticleDetail`
garde malgré tout son `sanitizeHtml` sur le rendu — le contenu RSS y passe aussi,
et une défense qui ne coûte rien reste en place.

## Schéma

Deux colonnes sur `articles` :

- `full_content text` — le HTML extrait et assaini, ou `null`
- `full_content_at timestamptz` — quand on a **tenté**, succès ou échec

Le couple encode trois états sans colonne de statut :

| `full_content_at` | `full_content` | état |
|---|---|---|
| `NULL` | `NULL` | jamais tenté |
| posé | non-`NULL` | réussi |
| posé | `NULL` | tenté, échoué |

Un échec n'est donc pas réessayé à chaque ouverture : le paywall du Monde est
frappé une fois, pas à chaque fois qu'on rouvre l'article.

Rien à changer dans la purge : `src/lib/poll.ts` supprime des lignes entières
(non bookmarkées, `createdAt` de plus de 30 jours), les nouvelles colonnes
partent avec. Les articles bookmarkés ne sont jamais purgés — leur texte complet
reste donc disponible indéfiniment, ce qui est le comportement voulu pour ce
qu'on a délibérément mis de côté.

## La server fn

`fetchFullContent(articleId)` dans `src/server/mutations.ts`, méthode `POST`.
Dans l'ordre :

1. `requireUser()`, puis la jointure `articles → feeds → categories` avec
   `eq(categories.userId, user.id)` — le même contrôle de propriété que toutes
   les autres mutations du fichier. Sans lui, l'id d'un article suffirait à faire
   scraper une page pour le compte d'un autre utilisateur.
2. Si `full_content_at` est déjà posé, retour immédiat de ce qu'on a. Deux
   onglets ouverts sur le même article ne déclenchent pas deux fetch.
3. Si `has_video` est vrai, on pose `full_content_at` sans même tenter :
   YouTube rend 0 caractère (mesuré ci-dessus), la requête serait pure perte.
4. `fetchPage(article.link)` → `extractArticle(html, url)` → `UPDATE` des deux
   colonnes → retour du contenu (ou `null`).

`fetchPage` étant déjà borné à 10 s, la fonction ne peut pas s'éterniser.

## L'UI

`getArticle` renvoie deux champs de plus : `fullContent` et `fullContentAt`.

`ArticleDetail` affiche `fullContent ?? content ?? description`. Si
`fullContentAt` est `null`, il déclenche la mutation à l'ouverture et remplace
**le corps seulement** par un skeleton pendant l'appel : le titre, la source, la
date et le bouton bookmark restent en place, donc rien ne saute sous le doigt.

En cas d'échec, repli silencieux sur le teaser, sans message d'erreur : le lien
« Read on site » en bas de page est déjà la porte de sortie, et il n'a pas besoin
d'être commenté.

## Tests

`tests/extract.test.ts`, sur des fixtures HTML en dur — aucun réseau, comme
`tests/feed-discovery.test.ts` :

- page d'article classique → corps extrait, nav et pied de page absents
- page de défi anti-bot (< 500 car.) → `null`
- document sans contenu identifiable (coquille JS) → `null`
- HTML porteur de `<script>` et d'un `onerror=` → assaini dans la sortie

`fetchPage` est déjà couvert par `tests/fetch-page.test.ts` et n'est pas retesté
ici.

## Hors périmètre

- **Pré-chargement pendant le cron.** Un relevé quotidien ramène des dizaines
  d'articles ; les scraper tous ferait des dizaines de fetch dans une function
  Vercel pour 90 % d'articles jamais lus. Le coût suit la lecture réelle.
- **Bouton « réessayer ».** Un échec est définitif pour cet article. Si le besoin
  apparaît, la colonne `full_content_at` suffit à le construire plus tard : la
  remettre à `NULL` relance une tentative.
- **Contournement de paywall.** Le Monde et consorts resteront en teaser.
