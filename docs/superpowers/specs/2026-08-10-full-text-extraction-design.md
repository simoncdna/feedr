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

Parse via linkedom, **injecte une balise `<base href>` portant l'URL finale**,
passe à Readability, assainit le HTML retourné avec
`sanitize-html` (mêmes règles que `ArticleDetail`), et rend `null` si Readability
échoue ou si le texte tombe sous le seuil. **L'assainissement a lieu ici**, côté
serveur : on ne stocke jamais en base du HTML tiers non nettoyé. `ArticleDetail`
garde malgré tout son `sanitizeHtml` sur le rendu — le contenu RSS y passe aussi,
et une défense qui ne coûte rien reste en place.

Les règles d'assainissement elles-mêmes vivent à part, dans `src/lib/sanitize.ts`,
parce que `ArticleDetail` les importe côté client : les lire depuis le module
d'extraction embarquerait linkedom et Readability dans le bundle du navigateur —
mesuré, ~740 Ko contre ~313 Ko pour une entrée qui n'importe que l'objet de
configuration, soit environ 108 Ko gzip ajoutés à la route article pour vingt
lignes de config. Ni l'un ni l'autre paquet ne déclare `sideEffects: false`, donc
rien ne s'élague.

### La base déclarée par la page est résolue, pas respectée telle quelle

Une page peut déclarer sa propre `<base>`. La règle HTML veut que la première
gagne, et une première version s'y conformait en sautant l'injection — mais
linkedom n'a pas d'URL de document, donc il ne sait pas résoudre une base
*relative* comme le ferait un navigateur. Mesuré le 2026-08-10 :

| `<base>` dans la page | en sautant l'injection | en résolvant contre l'URL finale |
|---|---|---|
| aucune | `https://exemple.fr/blog/photo.jpg` | idem |
| `href="https://autre.example/sous/"` | `https://autre.example/sous/photo.jpg` | idem |
| `href="/"` | `photo.jpg` ⛔ | `https://exemple.fr/photo.jpg` |
| `href="/blog/"` | `photo.jpg` ⛔ | `https://exemple.fr/blog/photo.jpg` |
| `href=""` | `photo.jpg` ⛔ | `https://exemple.fr/blog/photo.jpg` |

`<base href="/">` est courant (coquilles Angular/Vue, thèmes de CMS), et comme on
ne réessaie jamais, le HTML aux images cassées resterait en cache indéfiniment. On
résout donc la base déclarée contre l'URL finale (`new URL(déclarée, url)`), ce qui
laisse une base absolue intacte et donne le même résultat qu'un navigateur dans
tous les cas ci-dessus.

### Un plafond de profondeur, parce que le timeout ne couvre pas l'extraction

Readability coûte superlinéairement en profondeur d'imbrication. Mesuré le
2026-08-10 :

| profondeur | taille HTML | temps d'extraction |
|---|---|---|
| 10 | 1 Ko | 10 ms |
| 100 | 2 Ko | 29 ms |
| 500 | 6 Ko | 883 ms |
| 1000 | 12 Ko | 6 033 ms |

Douze kilo-octets suffisent à brûler six secondes, et `fetchPage` en accepte deux
mégaoctets. Son timeout de 10 s ne borne que le téléchargement : sans plafond, une
page pathologique bloquerait la function pendant l'ouverture d'un article. On rend
donc `null` au-delà de **200 niveaux** — sept fois la profondeur d'un article réel,
qui plafonne vers 30. Le calcul se fait par un parcours itératif : une récursion
sur un arbre profond ferait exploser la pile, ce qui annulerait l'intérêt du garde.

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

Le garde de l'étape 2 est un *check-then-act* : entre sa lecture et l'`UPDATE`
de l'étape 4, rien ne verrouille la ligne. Ouvrir le même article sur deux
appareils à quelques centaines de millisecondes d'intervalle les fait donc
passer tous les deux, avec deux requêtes vers le site pour rien. L'`UPDATE`
porte pour cette raison un `WHERE full_content_at IS NULL` : le second écrivain
ne touche aucune ligne et se contente de relire ce que le premier a posé. Ça ne
supprime pas le double fetch — il faudrait revendiquer la ligne *avant* de
partir chercher la page — mais ça garantit qu'une seule version est stockée, et
que ce n'est pas la plus tardive qui gagne par accident.

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
