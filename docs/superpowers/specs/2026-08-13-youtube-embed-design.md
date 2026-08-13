# Vidéos YouTube : vignette, description, et lecture depuis l'article

Une entrée de flux YouTube arrive aujourd'hui presque vide dans Feedr : pas de
vignette dans le fil, et une vue détail qui n'a que le titre à afficher.

## La cause, mesurée

Le flux d'une chaîne (`youtube.com/feeds/videos.xml?channel_id=…`) est de l'Atom
où tout ce qui est intéressant vit dans un `<media:group>`. Or `src/lib/rss.ts`
déclare ses `customFields` au niveau de l'item, donc `media:thumbnail` et
`media:description` — qui sont enfants de `media:group`, pas de `entry` — ne sont
jamais lus. rss-parser jette le sous-arbre entier.

Mesuré le 2026-08-13 sur la chaîne de Marques Brownlee, avec le parseur du dépôt :

```
clés brutes de l'item : title, link, pubDate, author, id, isoDate
extractImage()        : null
detectVideo()         : false
description / content : null / null
```

En déclarant `['media:group', 'mediaGroup']`, tout apparaît :

```
clés de mediaGroup : media:title, media:content, media:thumbnail,
                     media:description, media:community
media:thumbnail[0].$.url  → https://i4.ytimg.com/vi/o4SSoURPODY/hqdefault.jpg
media:description[0]      → le texte de description de la vidéo
media:content[0].$.url    → https://www.youtube.com/v/o4SSoURPODY?version=3
```

Trois conséquences dimensionnent le reste.

**`media:content` est inutilisable.** Il déclare `application/x-shockwave-flash`
et une URL `/v/…?version=3` héritée de Flash. Ce n'est donc ni une source de
lecteur, ni un signal exploitable par `detectVideo`, qui teste `video/`. La
détection passera par l'id de vidéo lu dans le lien.

**`hasVideo` valait `false` pour toutes les vidéos YouTube.** Double effet : pas
d'icône de lecture dans le fil, et surtout le court-circuit vidéo de
`fetchFullContent` ne s'appliquait pas — l'app scrapait la page YouTube à chaque
première ouverture pour en tirer zéro caractère. Réparer la détection répare
aussi ça.

**La description est du texte brut**, avec des retours à la ligne, pas du HTML.

## Le module YouTube

Nouveau `src/lib/youtube.ts`, pur et testable seul :

```
youtubeVideoId(url: string): string | null
youtubeThumbnailUrl(id: string): string
youtubeEmbedUrl(id: string): string
```

`youtubeVideoId` reconnaît `watch?v=`, `youtu.be/`, `/embed/` et `/shorts/`, et
**valide la forme de l'id** (`[A-Za-z0-9_-]{11}`). Cette validation est la
frontière de sécurité de la fonctionnalité : l'id finit interpolé dans l'URL d'une
iframe, et un id non validé y ouvrirait une injection. Tout le reste rend `null`.

## La lecture

Nouveau `src/components/VideoEmbed.tsx`, une seule responsabilité.

Tant qu'on n'a pas cliqué : un `<button>` portant la vignette en 16/9 et un
chevron de lecture, avec un `aria-label` explicite. Au clic : une iframe
`youtube-nocookie.com/embed/<id>?autoplay=1`, `allowFullScreen`.

Le lecteur n'est monté qu'au clic, délibérément : rien de YouTube — ni cookie, ni
le mégaoctet de JavaScript du lecteur — ne charge tant qu'on ne lance pas la
vidéo. Sur une PWA dont le fil ramène des dizaines d'articles par relevé, monter
l'iframe à l'ouverture ferait payer ce coût même aux vidéos qu'on ne regarde pas.

`ArticleDetail` monte le composant au-dessus du corps quand
`youtubeVideoId(article.link)` répond.

**La vignette est recadrée, pas remplacée.** `hqdefault.jpg` fait 480×360, donc du
4/3 : affichée telle quelle dans une boîte 16/9 elle aurait des bandes noires. On
la recadre avec `object-cover`. L'alternative `maxresdefault.jpg` est bien en 16/9
mais renvoie un 404 sur une partie des vidéos, ce qui échangerait une bande noire
contre une image cassée.

**La description est rendue en texte**, dans un `<p className="whitespace-pre-line">`
et non via `dangerouslySetInnerHTML` : c'est du texte brut, le passer pour du HTML
écraserait ses retours à la ligne en un seul paragraphe. On ne fabrique pas de
HTML pour le stocker en base. Contrepartie assumée : les URLs que YouTube met dans
ses descriptions restent du texte non cliquable.

## Le fil

Aucun changement de code. `ArticleCard` affiche déjà `imageUrl`, et l'icône de
lecture est déjà conditionnée à `hasVideo`. La vignette apparaît dès que les
données sont correctes — c'était un défaut de données, pas d'affichage.

## La reprise des lignes existantes

Le poller n'insère que les `guid` inconnus, donc corriger le parsing ne touche que
les futurs articles. Les vidéos déjà en base resteraient sans vignette jusqu'à leur
purge à 30 jours — et les bookmarkées, jamais purgées, indéfiniment.

L'URL de vignette étant déterministe à partir de l'id, et l'id étant déjà dans le
`link` stocké, la reprise se fait sans réseau : un script dans `scripts/` qui pose
`image_url` et `has_video` sur les lignes YouTube. Il **réutilise
`youtubeVideoId`** plutôt que de réimplémenter la regex en SQL : deux définitions
de « qu'est-ce qu'une URL de vidéo YouTube » finiraient par diverger.

La description n'est pas récupérable pour ces lignes : elle ne vit que dans le
flux, qui ne garde que les quinze dernières entrées d'une chaîne. Les anciennes
vidéos auront donc vignette et lecteur, sans texte.

## Tests

`tests/youtube.test.ts` — extraction d'id sur les quatre formes d'URL, et les
rejets qui comptent : domaine non-YouTube, id trop court ou trop long, caractères
hors alphabet, URL illisible. Plus la construction des URLs de vignette et
d'embed.

`tests/rss.test.ts` étendu — une fixture Atom de la forme YouTube (avec
`media:group`) : vignette extraite, `hasVideo` vrai, description prise dans
`media:description`.

Pas de test du composant : il n'y a pas de harnais React dans ce dépôt, et en
monter un pour cette fonctionnalité serait une décision plus large qu'elle.

## Hors périmètre

- **Les autres plateformes vidéo.** Vimeo, Dailymotion et consorts déclarent leurs
  flux autrement ; rien ici ne les couvre, et aucun flux suivi n'en est.
- **Récupérer les descriptions manquantes** des vidéos déjà en base.
- **Rendre cliquables les URLs des descriptions YouTube.**
