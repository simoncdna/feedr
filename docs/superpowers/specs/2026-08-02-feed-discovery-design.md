# Découverte de flux à l'ajout

Aujourd'hui, « Add a feed » n'accepte que l'URL d'un flux. Coller l'adresse d'une
chaîne YouTube ou d'un blog échoue sur « Could not read this RSS feed », alors que
le flux existe et est déclaré par le site.

## Le mécanisme, et ce qu'il couvre vraiment

Un site qui a un flux le déclare dans son `<head>`, par une convention de 2002 :

```html
<link rel="alternate" type="application/rss+xml" href="https://overreacted.io/rss.xml"/>
```

C'est l'*autodiscovery*, et c'est ce que lisent Feedly, Inoreader, NetNewsWire ou
Miniflux. Il n'y a pas de convertisseur par plateforme derrière ces produits : il y
a cette balise, plus quelques rustines là où elle manque.

Mesures faites le 2026-08-02 avant d'écrire cette spec :

| URL collée | `<link rel="alternate">` | flux réel |
|---|---|---|
| `youtube.com/@MKBHD` | ✅ `…/videos.xml?channel_id=UC…` | autodiscovery |
| `youtube.com/channel/UC…` | ✅ | autodiscovery |
| `mastodon.social/@Gargron` | ✅ `…/@Gargron.rss` | autodiscovery |
| `overreacted.io` | ✅ RSS + Atom | autodiscovery, 2 candidats |
| `youtube.com/playlist?list=…` | ❌ | `…/videos.xml?playlist_id=…` |
| `reddit.com/r/rss/` | ❌ (coquille JS) | `/r/rss/.rss` |
| `github.com/facebook/react` | ❌ (coquille JS) | `/releases.atom`, `/commits.atom` |

Deux conséquences qui dimensionnent tout le reste :

**YouTube et Mastodon n'ont pas besoin de règle.** Le cas d'usage à l'origine de
cette feature — coller une chaîne YouTube — est résolu par la couche générique
seule, y compris sur `/@handle`, et y compris sans User-Agent de navigateur (vérifié :
la balise est servie à un `curl` nu comme à Chrome).

**Il reste trois cas irréductibles**, tous des sites qui ne servent qu'une coquille
JavaScript. L'URL du flux y reste dérivable de celle de la page, mais seulement si
on connaît le site. C'est une table de trois lignes, pas une architecture.

## Les couches

Dans l'ordre, on s'arrête à la première qui donne un résultat.

**1. L'URL est-elle déjà un flux ?** `fetchFeed(url)` — le chemin actuel, inchangé.
Aucune requête supplémentaire et aucune régression pour qui colle une vraie URL de flux.

**2. Règles d'URL** (pures, sans réseau) :

| motif | flux | libellé |
|---|---|---|
| `youtube.com/playlist?list=X` | `youtube.com/feeds/videos.xml?playlist_id=X` | Videos |
| `reddit.com/r/X` (avec ou sans `/` final) | `reddit.com/r/X/.rss` | Posts |
| `github.com/O/R` (exactement deux segments) | `github.com/O/R/releases.atom` | Releases |
| | `github.com/O/R/commits.atom` | Commits |

Elles passent **avant** l'autodiscovery parce qu'elles ne coûtent rien : sur ces trois
sites la page ne déclare rien, donc les faire passer après reviendrait à télécharger
une coquille JS pour rien. GitHub produit deux candidats — c'est à l'utilisateur de
dire s'il suit les releases ou les commits, pas à nous de deviner.

**3. Autodiscovery.** On télécharge la page et on lit ses `<link rel="alternate">`.
C'est la couche qui fait le travail.

Rien trouvé aux trois couches → `'No RSS feed found at this address'`.

On ne teste **pas** de chemins conventionnels (`/feed`, `/rss`, `/atom.xml`…) : on ne
tape que des URLs que le site a déclarées ou que l'on sait construire. Compromis assumé
pour ne pas ouvrir une surface réseau spéculative ; un site sans autodiscovery et hors
des trois règles demandera de coller l'URL du flux à la main.

Cette spec citait Hacker News comme victime de ce compromis. C'était faux : mesuré le
2026-08-02, HN **déclare** son flux (`<link rel="alternate">` → `/rss`) et la couche 3
le trouve. L'exemple ne tenait pas, et la longue traîne de sites sans autodiscovery est
sans doute plus mince que je ne l'avais supposé.

## Modules

`src/lib/feed-discovery.ts`, sans dépendance au framework ni au réseau :

```ts
export type FeedCandidate = { url: string; label: string }

/** Couche 2 : dérive des URLs de flux à partir de la seule URL de la page. */
export function platformFeeds(pageUrl: string): FeedCandidate[]

/** Couche 3 : lit les <link rel="alternate"> d'un document HTML. */
export function extractFeedLinks(html: string, baseUrl: string): FeedCandidate[]
```

`extractFeedLinks` doit :

- accepter `application/rss+xml` et `application/atom+xml` ;
- **ne pas présumer de l'ordre des attributs.** Mastodon écrit `<link href="…" rel="alternate" type="…">`, YouTube écrit `<link rel="alternate" type="…" href="…">`. Une regex qui attend `rel` avant `href` rate un cas sur deux ;
- absolutiser les `href` relatifs et protocol-relative contre `baseUrl` ;
- rejeter tout candidat qui ne passe pas `isSafeFeedUrl` ;
- dédupliquer par URL ;
- prendre le `title` de la balise comme libellé, sinon le `pathname` ;
- **reléguer les flux de commentaires en fin de liste** (chemin contenant `/comments/`, ou `title` contenant « comments »), pour que le flux utile soit présenté en premier. On ne les supprime pas : un WordPress qui déclare articles + commentaires produit bien deux candidats et passe donc par l'écran de choix — trier ne fait qu'ordonner.

La partie réseau — télécharger la page — vit dans `src/lib/fetch-page.ts`, à côté de
`src/lib/rss.ts` qui fait déjà du réseau : `src/lib/` est bien l'endroit du métier sans
dépendance au framework, réseau compris. `mutations.ts` ne garde que la composition
(`resolveFeedCandidates`, `readFeedTitle`), une dizaine de lignes attachées au flux
d'ajout.

Dans les deux cas, pas de `createServerFn` intermédiaire : une server fn appelée
uniquement par une autre server fn n'est pas inscrite au manifeste du bundle et renvoie
500 en production (voir AGENTS.md). Le piège vise `createServerFn` précisément — une
fonction exportée ordinaire dans son module se bundle normalement.

## Contrat serveur et formulaire

```ts
export type AddFeedResult = { error: string | null; candidates?: FeedCandidate[] }
```

- **0 candidat** → `{ error: 'No RSS feed found at this address' }`
- **1 candidat** → on le valide par `fetchFeed`, on insère, `{ error: null }`
- **≥2 candidats** → `{ error: null, candidates }`, sans les valider

Les libellés viennent de l'attribut `title` ou de la règle. On ne télécharge pas
chaque candidat pour afficher son vrai titre : un site à quatre flux déclencherait
quatre requêtes juste pour peupler une liste.

Quand `candidates` arrive, `AddFeedForm` remplace son bouton par la liste (libellé +
URL). Cliquer sur une entrée **re-soumet la mutation avec cette URL**, qui repasse
alors par la couche 1 et s'insère normalement. Pas de seconde server fn, pas d'état
serveur intermédiaire, pas de token de session de découverte.

Messages utilisateur, tous côté serveur comme aujourd'hui :

| message | quand |
|---|---|
| `Invalid URL or category` | existant |
| `Could not read this RSS feed` | existant — flux trouvé mais illisible |
| `This feed already exists` | existant |
| `No RSS feed found at this address` | **nouveau** — aucune des trois couches n'aboutit |

## Sécurité

Télécharger une page HTML est un accès réseau piloté par une URL utilisateur, plus
permissif que le `fetchFeed` actuel. Garde-fous :

- `redirect: 'manual'`, boucle de 5 sauts maximum, **`isSafeFeedUrl` revalidé à chaque
  `Location`**. Suivre les redirections automatiquement puis vérifier l'URL finale ne
  suffit pas : la requête vers `169.254.169.254` aurait déjà eu lieu.
- Timeout 10 s, aligné sur le parseur RSS, et **budget pour toute la chaîne** : un
  `AbortSignal` par saut donnerait 60 s en pire cas.
- Ce garde-fou ne couvre que le téléchargement de page. `fetchFeed` s'appuie sur
  `rss-parser`, qui suit ses propres redirections sans revalider — comportement
  antérieur à cette feature, non traité ici, et signalé en commentaire pour qu'on ne
  croie pas le chemin entier protégé.
- Corps lu jusqu'à un plafond de 2 Mo. Ce plafond est un garde-fou contre une réponse
  sans fin, **pas une estimation de la taille d'un `<head>`** : mesuré le 2026-08-02,
  YouTube déclare son flux à 733 674 octets, soit ~48 Ko *après* son `</head>` (à
  685 259) — donc dans le `<body>`. Un plafond de 512 Ko coupait la balise, et
  s'arrêter à `</head>` la manquerait tout autant. La découverte renvoyait zéro
  candidat sur le cas d'usage qui a motivé la feature.
- `content-type` non-HTML → aucun candidat.
- Chaque URL candidate est revalidée par `isSafeFeedUrl` avant d'être renvoyée au client
  ou fetchée.

## Tests

`tests/feed-discovery.test.ts`, sur les deux fonctions pures — aucun réseau.

`platformFeeds` : playlist YouTube ; `/r/sub` avec et sans slash final ; `/r/sub/comments/xyz`
qui ne doit **pas** matcher la règle subreddit ; `github.com/o/r` → deux candidats ;
`github.com/o/r/issues` qui ne doit pas matcher ; URL quelconque → `[]`.

`extractFeedLinks` : `href` relatif, absolu, protocol-relative ; `rel` avant `href` et
`href` avant `rel` ; `rss+xml` et `atom+xml` ; plusieurs flux ; flux de commentaires
relégué ; doublons ; `http://localhost/feed` filtré ; page sans `<link>` → `[]`.

Un cas de bout en bout dans `tests/rss.test.ts` n'est pas prévu : les deux fonctions
pures couvrent la logique, et le reste est du câblage réseau que les tests unitaires
ne valideraient qu'en le mockant.
