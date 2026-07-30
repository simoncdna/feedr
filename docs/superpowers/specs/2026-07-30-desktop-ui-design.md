# Feedr — Vue desktop + refonte UI — Design

Date : 2026-07-30
Statut : validé

## Objectif

Deux évolutions liées, livrées ensemble :
1. Une vraie vue desktop (≥ `lg`, ~1024px) en 3 volets type Reeder : sidebar de navigation, liste d'articles, volet de lecture.
2. Une refonte du langage visuel (mobile + desktop), reprise du système commun aux projets `next-plugin-qrcode` et `marie-portfolio` : Swiss minimal, filets 1px, mono-labels, accent rationné.

Aucune logique métier ne change : mêmes routes, mêmes server actions, même schéma. Les 44 tests existants restent verts.

## Langage visuel

### Tokens (CSS vars + `@theme inline`, Tailwind v4)

| token | light | dark |
|---|---|---|
| `--background` | `#ffffff` | `#0c0c0e` |
| `--foreground` | `#171717` | `#faf6f1` |
| `--muted` | `rgba(23,23,23,0.62)` | `#7c7d86` |
| `--rule` | `#dedede` | `#26272c` |
| `--surface` | `#fafafa` | `#101013` |
| `--accent` | `#c2410c` | `#fb923c` |

- Le thème suit le système via `@media (prefers-color-scheme: dark)` (pas de toggle, décision produit conservée). `color-scheme` déclaré par thème. Les `themeColor` du viewport et le manifest sont mis à jour en conséquence.
- **Rationnement de l'accent** : l'orange ne sert qu'aux états actifs (item de nav courant, catégorie sélectionnée, bookmark actif, filet de sélection). Jamais en fond de bouton.
- Les classes Tailwind `neutral-*`/`orange-*` existantes sont remplacées par les tokens (`bg-background`, `text-foreground`, `text-muted`, `border-rule`, `bg-surface`, `text-accent`).

### Typographie

- `Geist` (sans) + `Geist Mono` via `next/font/google`, `antialiased`, body `line-height 1.6`.
- Titres : `font-medium`/`font-semibold` + `tracking-tight`. Jamais de `font-bold`.
- Classe signature `.mono-label` (dans `@layer components`) :
  `font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.18em; font-size: 0.6875rem; color: var(--muted);`
  Utilisée pour : nom du flux + date dans les rangées, labels de nav (sidebar et tab bar), titres de sections (CATÉGORIES, FLUX, NOTIFICATIONS), états vides.

### Formes

- **Zéro ombre, zéro carte.** Séparation par filets 1px `border-rule` : `divide-y` sur les listes, `border-r` sidebar/liste, `border-b` en-têtes, `border-t` tab bar.
- Radius plafonné à 4px (`rounded` Tailwind) pour vignettes, inputs, boutons. `rounded-full` interdit sauf éléments décoratifs.
- Focus : `:focus-visible { outline: 1px solid var(--foreground); outline-offset: 3px; }` (pas de ring).
- Icônes SVG hairline : `fill:none, stroke:currentColor, strokeWidth:1.5`, caps ronds.

### Composants récurrents

- Item nav : `mono-label` + `p-2 -m-2 transition-colors`, actif = `text-accent`, sinon `text-muted hover:text-foreground`.
- Input : `rounded border border-rule bg-surface px-3 py-1.5 text-sm outline-none focus:border-foreground`.
- Bouton secondaire : `mono-label rounded border border-rule bg-surface px-3 py-1.5 hover:text-foreground transition-colors motion-reduce:transition-none`.
- Rangée d'article : méta `mono-label` (flux · date), titre `text-base font-medium tracking-tight`, extrait `text-sm text-muted line-clamp-2/3`, vignette 4px à droite, bookmark hairline (accent si actif).

### Motion

- `transition-colors` sur tout élément interactif + `motion-reduce:transition-none`.
- Un geste signature : « Lire sur le site → » devient un lien texte souligné 1px dont la flèche glisse au hover (`transform 520ms cubic-bezier(0.16,1,0.3,1)`, texte immobile), repris de next-plugin-qrcode.

## Vue desktop (≥ lg)

### Shell

- `Sidebar` (nouveau composant, `hidden lg:flex`, largeur ~15rem, `border-r border-rule`, sticky pleine hauteur) : « FEEDR » en mono-label, nav Fil/Bookmarks/Réglages (état actif = `text-accent`, même logique de préfixe que la TabBar), puis section « CATÉGORIES » : liens de filtre (`/?category=id`, actif = accent) + cloche notify en indicateur passif.
- `TabBar` passe en `lg:hidden`. Le layout racine passe de `max-w-lg` centré à un conteneur qui laisse la grille s'étendre (`lg:max-w-none`), padding bas mobile conservé.
- La sidebar charge les catégories via la DB (server component) ; elle est rendue par le layout racine.

### Fil (`/`)

- Desktop : grille `lg:grid lg:grid-cols-[24rem_1fr]` (liste | détail), liste `border-r border-rule` scrollable indépendamment (`lg:h-[calc(100dvh)]`, `overflow-y-auto`), chips catégories masquées `lg:hidden` (la sidebar filtre).
- Sélection pilotée par l'URL : cliquer une rangée → `/?article=123` (paramètre `category` préservé). Rangée sélectionnée : `bg-surface` + filet accent à gauche.
- Volet droit : composant `ArticleDetail` (extrait de `/article/[id]`) si `?article` valide ; sinon état vide `mono-label` « Sélectionne un article ». `?article` invalide → « Article introuvable ».
- Mobile : si `?article` présent, le détail s'affiche plein écran (la liste est masquée) — retour navigateur = retour liste. Sinon comportement actuel inchangé.
- Les rangées pointent vers `?article=` partout ; la route `/article/[id]` est conservée uniquement comme cible des notifications push (page plein écran, réutilise `ArticleDetail`).

### Bookmarks (`/bookmarks`)

Même pattern que le fil : `?article=123`, grille 2 volets sur desktop, plein écran mobile.

### Réglages (`/settings`)

Pas de volet détail : contenu actuel restylé (mono-labels de sections, inputs/boutons hairline), centré `max-w-2xl` dans le shell avec sidebar.

## Découpage composants

| Fichier | Rôle |
|---|---|
| `src/components/Sidebar.tsx` | Nav desktop + catégories (server component) |
| `src/components/ArticleDetail.tsx` | Vue lecture partagée (fil, bookmarks, /article/[id]) |
| `src/components/ArticleList.tsx` | Liste de rangées avec état sélectionné (utilisé par fil + bookmarks) |
| `src/components/ArticleCard.tsx` | Restylé en rangée hairline (renommage non requis) |
| `src/app/layout.tsx` | Fonts Geist, grille shell, Sidebar + TabBar |
| `src/app/globals.css` | Tokens, `.mono-label`, focus, motion |

## Erreurs

- `?article` non entier ou inexistant → volet « Article introuvable » (desktop) / plein écran avec le même message (mobile). Pas de 404 dur sur le fil.
- `/article/[id]` garde son comportement 404 actuel (cible des push).

## Tests

- Aucune logique métier modifiée : les 44 tests Vitest restent verts tels quels.
- Vérification visuelle en local (données seedées) : light + dark, mobile (≤ md) + desktop (≥ lg), les 4 pages, sélection d'article, états vides.

## Hors périmètre (YAGNI)

- Toggle de thème manuel, navigation clavier (j/k), lu/non-lu, compteurs par catégorie, virtualisation de liste, animation d'entrée des nouveaux items.

## Addendum (décisions prises pendant l'implémentation, sur retours utilisateur)

- **Bascule manuelle light/dark** ajoutée (annule le « pas de toggle » du YAGNI initial) : `data-theme` + localStorage + script pre-hydration, icônes lucide Sun/Moon dans la sidebar (desktop) et une section Appearance dans Settings (mobile). Un meta `theme-color` dédié (`data-theme-override`) suit la bascule.
- **Interface en anglais** (l'ensemble des strings UI, `lang="en"`, dates relatives en anglais).
- **Menu catégories** : onglets soulignés sur filet continu (remplace les pills).
- **Titres** Feed/Bookmarks/Settings : `text-3xl font-bold tracking-tight` (au lieu de 2xl semibold) ; titres d'articles du fil en `text-lg font-semibold`.
- **Mode sombre** : foreground `#fafafa` (blanc neutre) au lieu du crème `#faf6f1`.
- **Settings** : contenu aligné en haut à gauche (pas de centrage), icônes de suppression lucide `X`.
- **Icônes de l'app** : motif « Ondes » graphite `#2b2b2b` / perle `#d6d3cd` (P3) — en cours d'itération, jugé trop proche de Zen Browser ; alternatives Z1-Z5 proposées.
- **Retour depuis la page push** (`/article/[id]`) : vers `/` directement (un seul tap sur mobile).
