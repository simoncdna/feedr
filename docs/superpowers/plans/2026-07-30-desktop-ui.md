# Feedr Desktop + UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vue desktop 3 volets (sidebar / liste / lecture) pilotée par `?article=`, et refonte du langage visuel (Swiss minimal : tokens, Geist + Geist Mono, mono-labels, filets 1px, accent orange rationné) sur mobile et desktop.

**Architecture:** Aucune logique métier ne change. Nouveaux tokens CSS (`@theme inline`), nouveaux composants `Sidebar`/`ArticleDetail`/`ArticlePane`/`ArticleList`, restyle des composants existants. La sélection d'article passe par l'URL (`/?article=123`, `/bookmarks?article=123`) ; `/article/[id]` reste la cible plein écran des notifications push.

**Tech Stack:** Next.js 16 App Router, Tailwind v4 (tokens CSS vars), `next/font` (Geist), Drizzle/Neon, sanitize-html. 44 tests Vitest existants — aucun nouveau test (zéro logique), la suite doit rester verte à chaque tâche.

**Spec:** `docs/superpowers/specs/2026-07-30-desktop-ui-design.md`

---

## Structure de fichiers

| Fichier | Action | Rôle |
|---|---|---|
| `src/app/globals.css` | Remplacer | Tokens light/dark, `@theme inline`, `.mono-label`, `.cta-link`, focus |
| `src/app/layout.tsx` | Remplacer | Fonts Geist, shell `lg:flex` avec Sidebar, main adaptatif |
| `src/app/manifest.ts` | Modifier | Couleurs `#ffffff` |
| `src/components/TabBar.tsx` | Remplacer | Restyle mono-label + `lg:hidden` |
| `src/components/Sidebar.tsx` | Créer | Server component : fetch catégories |
| `src/components/SidebarClient.tsx` | Créer | Nav + catégories avec états actifs |
| `src/components/ArticleDetail.tsx` | Créer | Vue lecture partagée (sanitize + rendu) |
| `src/components/ArticlePane.tsx` | Créer | Fetch par `?article` + états vides |
| `src/components/ArticleCard.tsx` | Remplacer | Rangée hairline avec `href` + `selected` |
| `src/components/ArticleList.tsx` | Créer | Liste `divide-y` + état vide |
| `src/components/CategoryChips.tsx` | Remplacer | Restyle hairline (mobile) |
| `src/app/page.tsx` | Remplacer | Grille 2 volets desktop, `?article` mobile plein écran |
| `src/app/article/[id]/page.tsx` | Remplacer | Slim : fetch + `ArticleDetail` + retour |
| `src/app/bookmarks/page.tsx` | Remplacer | Même pattern que le fil |
| `src/app/settings/page.tsx` | Remplacer | Restyle mono-labels + inputs hairline |
| `src/components/AddFeedForm.tsx` | Remplacer | Inputs/boutons hairline |
| `src/components/EnableNotifications.tsx` | Modifier | Bouton hairline |

Toutes les tâches : après modification, `npx vitest run` (44/44) + `npm run build` doivent passer. Commits avec trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Fondations — tokens, fonts, layout, TabBar, manifest

**Files:**
- Modify: `src/app/globals.css`, `src/app/layout.tsx`, `src/app/manifest.ts`, `src/components/TabBar.tsx`

- [ ] **Step 1: Tokens + classes signature** — remplacer `src/app/globals.css` :

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";

:root {
  --background: #ffffff;
  --foreground: #171717;
  --muted: rgba(23, 23, 23, 0.62);
  --rule: #dedede;
  --surface: #fafafa;
  --accent: #c2410c;
  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0c0c0e;
    --foreground: #faf6f1;
    --muted: #7c7d86;
    --rule: #26272c;
    --surface: #101013;
    --accent: #fb923c;
    color-scheme: dark;
  }
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-muted: var(--muted);
  --color-rule: var(--rule);
  --color-surface: var(--surface);
  --color-accent: var(--accent);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  line-height: 1.6;
}

:focus-visible {
  outline: 1px solid var(--foreground);
  outline-offset: 3px;
}

@layer components {
  .mono-label {
    font-family: var(--font-geist-mono), monospace;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: 0.6875rem;
    color: var(--muted);
  }

  .cta-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    border-bottom: 1px solid var(--foreground);
    padding-bottom: 0.25rem;
  }

  .cta-arrow {
    transition: transform 520ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .cta-link:hover .cta-arrow {
    transform: translateX(0.25rem);
  }

  @media (prefers-reduced-motion: reduce) {
    .cta-arrow {
      transition-duration: 1ms;
    }
  }
}
```

- [ ] **Step 2: Layout + fonts** — remplacer `src/app/layout.tsx` (le composant `Sidebar` arrive en Task 2 ; pour cette tâche, garder le layout SANS Sidebar — voir code ci-dessous, la ligne Sidebar est ajoutée en Task 2) :

```tsx
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { TabBar } from '@/components/TabBar'
import { RegisterSW } from '@/components/RegisterSW'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Feedr',
  description: 'Agrégateur RSS personnel',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Feedr' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0c0e' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="bg-background text-foreground antialiased">
        <div className="lg:flex">
          <main className="mx-auto w-full max-w-lg px-4 pb-28 pt-4 lg:m-0 lg:min-w-0 lg:max-w-none lg:flex-1 lg:p-0">
            {children}
          </main>
        </div>
        <TabBar />
        <RegisterSW />
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Manifest** — dans `src/app/manifest.ts`, remplacer `background_color: '#fafafa'` et `theme_color: '#fafafa'` par `'#ffffff'` (le reste inchangé).

- [ ] **Step 4: TabBar** — remplacer `src/components/TabBar.tsx` (mêmes SVG qu'actuellement, mais `strokeWidth 1.5`, labels en `mono-label`, tokens, `lg:hidden`) :

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  {
    href: '/', label: 'Fil',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" strokeLinecap="round" />
        <circle cx="5" cy="19" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    href: '/bookmarks', label: 'Bookmarks',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M6 4h12v17l-6-4-6 4z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/settings', label: 'Réglages',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z" />
      </svg>
    ),
  },
]

export function TabBar() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 border-t border-rule bg-background/90 backdrop-blur lg:hidden"
    >
      <div className="mx-auto flex max-w-lg pb-[env(safe-area-inset-bottom)]">
        {tabs.map((tab) => {
          const active =
            tab.href === '/'
              ? pathname === '/' || pathname.startsWith('/article')
              : pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-2 transition-colors ${
                active ? 'text-accent' : 'text-muted hover:text-foreground'
              }`}
            >
              {tab.icon}
              <span className={`mono-label ${active ? 'text-accent' : ''}`}>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

Note : dans `TabBar` et partout ailleurs, quand un `mono-label` doit prendre la couleur active, on surcharge avec `text-accent` (la classe définit `color: var(--muted)` ; l'utilitaire Tailwind gagne car il vient après dans la cascade `@layer components` < utilities).

- [ ] **Step 5: Vérifier** : `npx vitest run` (44/44), `npm run build` (OK). Live rapide sur port libre : `GET /` rend avec `class="…antialiased"` sur body et la tab bar en mono-label. Kill.

- [ ] **Step 6: Commit** : `git add -A && git commit -m "feat: tokens Swiss minimal, fonts Geist, TabBar restylée"`

---

### Task 2: Sidebar desktop

**Files:**
- Create: `src/components/Sidebar.tsx`, `src/components/SidebarClient.tsx`
- Modify: `src/app/layout.tsx` (ajout de la Sidebar dans le shell)

- [ ] **Step 1: Server component** — `src/components/Sidebar.tsx` :

```tsx
import { asc } from 'drizzle-orm'
import { db } from '@/db'
import { categories } from '@/db/schema'
import { SidebarClient } from './SidebarClient'

export async function Sidebar() {
  const cats = await db
    .select({ id: categories.id, name: categories.name, notify: categories.notify })
    .from(categories)
    .orderBy(asc(categories.name))
  return <SidebarClient categories={cats} />
}
```

- [ ] **Step 2: Client component** — `src/components/SidebarClient.tsx` :

```tsx
'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

const nav = [
  { href: '/', label: 'Fil' },
  { href: '/bookmarks', label: 'Bookmarks' },
  { href: '/settings', label: 'Réglages' },
]

export function SidebarClient({
  categories,
}: {
  categories: { id: number; name: string; notify: boolean }[]
}) {
  const pathname = usePathname()
  const params = useSearchParams()
  const onFeed = pathname === '/'
  const activeCategory = onFeed ? Number(params.get('category')) || null : null

  const isActive = (href: string) =>
    href === '/'
      ? (pathname === '/' && !params.get('category')) || pathname.startsWith('/article')
      : pathname.startsWith(href)

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-10 overflow-y-auto border-r border-rule px-6 py-8 lg:flex">
      <Link href="/" className="mono-label text-foreground">
        Feedr
      </Link>

      <nav aria-label="Navigation principale" className="flex flex-col gap-3">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? 'page' : undefined}
            className={`mono-label -m-2 p-2 transition-colors ${
              isActive(item.href) ? 'text-accent' : 'hover:text-foreground'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {categories.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="mono-label mb-2">Catégories</p>
          {categories.map((c) => {
            const active = activeCategory === c.id
            return (
              <Link
                key={c.id}
                href={`/?category=${c.id}`}
                aria-current={active ? 'true' : undefined}
                className={`flex items-center justify-between gap-2 py-1.5 text-sm transition-colors ${
                  active ? 'font-medium text-accent' : 'text-muted hover:text-foreground'
                }`}
              >
                <span className="truncate">{c.name}</span>
                {c.notify && (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </aside>
  )
}
```

Note : `useSearchParams` dans un composant rendu par le layout impose un boundary — envelopper `<Sidebar />` dans `<Suspense>` (fallback `null`) dans le layout pour éviter l'erreur de prerender.

- [ ] **Step 3: Brancher dans le layout** — dans `src/app/layout.tsx`, ajouter les imports et remplacer le `<div className="lg:flex">` :

```tsx
import { Suspense } from 'react'
import { Sidebar } from '@/components/Sidebar'
```

```tsx
        <div className="lg:flex">
          <Suspense fallback={null}>
            <Sidebar />
          </Suspense>
          <main className="mx-auto w-full max-w-lg px-4 pb-28 pt-4 lg:m-0 lg:min-w-0 lg:max-w-none lg:flex-1 lg:p-0">
            {children}
          </main>
        </div>
```

- [ ] **Step 4: Vérifier** : `npx vitest run`, `npm run build`. Live : `GET /` contient `aside` (masqué < lg mais présent dans le HTML) avec « Catégories » et les 3 catégories seedées. Kill.

- [ ] **Step 5: Commit** : `git add -A && git commit -m "feat: sidebar desktop (nav + catégories)"`

---

### Task 3: ArticleDetail + ArticlePane, /article/[id] slim

**Files:**
- Create: `src/components/ArticleDetail.tsx`, `src/components/ArticlePane.tsx`
- Modify: `src/app/article/[id]/page.tsx`

- [ ] **Step 1: Vue lecture partagée** — `src/components/ArticleDetail.tsx` (extraction du rendu actuel de `/article/[id]`, restylé) :

```tsx
import sanitizeHtml from 'sanitize-html'
import { toggleBookmark } from '@/app/actions'
import { relativeDate } from '@/lib/text'

export type ArticleDetailData = {
  id: number
  title: string
  link: string
  description: string | null
  content: string | null
  publishedAt: Date
  bookmarked: boolean
  feedTitle: string
}

export function ArticleDetail({ article }: { article: ArticleDetailData }) {
  const raw = article.content ?? article.description
  const safe = raw
    ? sanitizeHtml(raw, {
        allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img'],
        allowedAttributes: {
          ...sanitizeHtml.defaults.allowedAttributes,
          img: ['src', 'alt'],
        },
        transformTags: {
          a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
        },
      })
    : null

  return (
    <article className="px-4 py-6 lg:mx-auto lg:max-w-2xl lg:px-10 lg:py-12">
      <p className="mono-label">
        {article.feedTitle} · {relativeDate(article.publishedAt)}
      </p>
      <div className="mt-2 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight">{article.title}</h1>
        <form action={toggleBookmark.bind(null, article.id, !article.bookmarked)}>
          <button
            aria-label={article.bookmarked ? 'Retirer le bookmark' : 'Bookmarker'}
            className={`-m-2 mt-1 p-2 transition-colors ${
              article.bookmarked ? 'text-accent' : 'text-muted hover:text-foreground'
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill={article.bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M6 4h12v17l-6-4-6 4z" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      </div>
      {safe && (
        <div
          className="prose prose-neutral mt-6 max-w-none dark:prose-invert prose-img:rounded"
          dangerouslySetInnerHTML={{ __html: safe }}
        />
      )}
      <p className="mt-10">
        <a
          href={article.link}
          target="_blank"
          rel="noopener noreferrer"
          className="cta-link text-sm font-medium"
        >
          Lire sur le site
          <span className="cta-arrow" aria-hidden="true">→</span>
        </a>
      </p>
    </article>
  )
}
```

- [ ] **Step 2: Volet avec fetch + états vides** — `src/components/ArticlePane.tsx` :

```tsx
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { articles, feeds } from '@/db/schema'
import { ArticleDetail } from './ArticleDetail'

function EmptyPane({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[50dvh] items-center justify-center">
      <p className="mono-label">{label}</p>
    </div>
  )
}

export async function ArticlePane({ articleParam }: { articleParam?: string }) {
  if (!articleParam) return <EmptyPane label="Sélectionne un article" />
  const id = Number(articleParam)
  if (!Number.isInteger(id)) return <EmptyPane label="Article introuvable" />

  const rows = await db
    .select({
      id: articles.id,
      title: articles.title,
      link: articles.link,
      description: articles.description,
      content: articles.content,
      publishedAt: articles.publishedAt,
      bookmarked: articles.bookmarked,
      feedTitle: feeds.title,
    })
    .from(articles)
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .where(eq(articles.id, id))
    .limit(1)

  const article = rows[0]
  if (!article) return <EmptyPane label="Article introuvable" />
  return <ArticleDetail article={article} />
}
```

- [ ] **Step 3: Slim de la page push** — remplacer `src/app/article/[id]/page.tsx` :

```tsx
import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { articles, feeds } from '@/db/schema'
import { ArticleDetail } from '@/components/ArticleDetail'

export const dynamic = 'force-dynamic'

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const numericId = Number(id)
  if (!Number.isInteger(numericId)) notFound()

  const rows = await db
    .select({
      id: articles.id,
      title: articles.title,
      link: articles.link,
      description: articles.description,
      content: articles.content,
      publishedAt: articles.publishedAt,
      bookmarked: articles.bookmarked,
      feedTitle: feeds.title,
    })
    .from(articles)
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .where(eq(articles.id, numericId))
    .limit(1)

  const article = rows[0]
  if (!article) notFound()

  return (
    <div>
      <div className="px-4 pt-2 lg:px-10 lg:pt-8">
        <Link href={`/?article=${article.id}`} className="mono-label -m-2 p-2 transition-colors hover:text-foreground">
          ← Fil
        </Link>
      </div>
      <ArticleDetail article={article} />
    </div>
  )
}
```

- [ ] **Step 4: Vérifier** : `npx vitest run`, `npm run build`. Live avec données seedées : ouvrir un id existant `/article/<id>` → rendu restylé, lien « ← Fil » ; `/article/abc` → 404. Kill.

- [ ] **Step 5: Commit** : `git add -A && git commit -m "feat: ArticleDetail/ArticlePane partagés, page push slim"`

---

### Task 4: Rangées d'articles + liste + chips

**Files:**
- Modify: `src/components/ArticleCard.tsx`, `src/components/CategoryChips.tsx`
- Create: `src/components/ArticleList.tsx`

- [ ] **Step 1: Rangée hairline** — remplacer `src/components/ArticleCard.tsx` :

```tsx
import Link from 'next/link'
import { toggleBookmark } from '@/app/actions'
import { relativeDate, stripHtml } from '@/lib/text'

export type ArticleCardData = {
  id: number
  title: string
  description: string | null
  imageUrl: string | null
  publishedAt: Date
  bookmarked: boolean
  feedTitle: string
}

export function ArticleCard({
  article,
  href,
  selected = false,
}: {
  article: ArticleCardData
  href: string
  selected?: boolean
}) {
  const excerpt = article.description ? stripHtml(article.description) : null
  return (
    <div className={`relative flex gap-4 px-4 py-4 lg:px-6 ${selected ? 'bg-surface' : ''}`}>
      {selected && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-accent" />}
      <div className="min-w-0 flex-1">
        <p className="mono-label">
          {article.feedTitle} · {relativeDate(article.publishedAt)}
        </p>
        <Link href={href} className="block">
          <h2 className="mt-1 text-base font-medium leading-snug tracking-tight">{article.title}</h2>
          {excerpt && <p className="mt-1 line-clamp-2 text-sm text-muted">{excerpt}</p>}
        </Link>
      </div>
      {article.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.imageUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="mt-1 h-16 w-16 shrink-0 rounded object-cover"
        />
      )}
      <form action={toggleBookmark.bind(null, article.id, !article.bookmarked)}>
        <button
          aria-label={article.bookmarked ? 'Retirer le bookmark' : 'Bookmarker'}
          className={`-m-2 p-2 transition-colors ${
            article.bookmarked ? 'text-accent' : 'text-muted hover:text-foreground'
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill={article.bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M6 4h12v17l-6-4-6 4z" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Liste** — `src/components/ArticleList.tsx` :

```tsx
import { ArticleCard, type ArticleCardData } from './ArticleCard'

export function ArticleList({
  articles,
  hrefFor,
  selectedId,
  emptyLabel,
}: {
  articles: ArticleCardData[]
  hrefFor: (id: number) => string
  selectedId: number | null
  emptyLabel: string
}) {
  if (articles.length === 0) {
    return <p className="mono-label mt-16 text-center">{emptyLabel}</p>
  }
  return (
    <div className="divide-y divide-rule border-b border-rule">
      {articles.map((a) => (
        <ArticleCard key={a.id} article={a} href={hrefFor(a.id)} selected={a.id === selectedId} />
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Chips** — remplacer `src/components/CategoryChips.tsx` :

```tsx
import Link from 'next/link'

export function CategoryChips({
  categories,
  activeId,
}: {
  categories: { id: number; name: string }[]
  activeId: number | null
}) {
  const chip = (active: boolean) =>
    `shrink-0 rounded border px-3 py-1 text-sm transition-colors ${
      active
        ? 'border-rule bg-surface text-foreground'
        : 'border-transparent text-muted hover:text-foreground'
    }`
  return (
    <div className="flex gap-1 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch]">
      <Link href="/" className={chip(activeId === null)} aria-current={activeId === null ? 'page' : undefined}>
        Tout
      </Link>
      {categories.map((c) => (
        <Link
          key={c.id}
          href={`/?category=${c.id}`}
          className={chip(activeId === c.id)}
          aria-current={activeId === c.id ? 'page' : undefined}
        >
          {c.name}
        </Link>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Adapter les appels existants** — `src/app/page.tsx` et `src/app/bookmarks/page.tsx` compilent encore avec l'ancienne signature `<ArticleCard article={a} />`. Pour garder le build vert AVANT les Tasks 5-6, faire le changement minimal dans les deux pages : remplacer `rows.map((a) => <ArticleCard key={a.id} article={a} />)` par `rows.map((a) => <ArticleCard key={a.id} article={a} href={`/article/${a.id}`} />)` (les vraies URLs `?article=` arrivent en Tasks 5-6).

- [ ] **Step 5: Vérifier** : `npx vitest run`, `npm run build`. Live : `/` affiche les rangées hairline. Kill.

- [ ] **Step 6: Commit** : `git add -A && git commit -m "feat: rangées d'articles hairline, ArticleList, chips restylées"`

---

### Task 5: Fil 2 volets

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Remplacer `src/app/page.tsx`** :

```tsx
import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { articles, categories, feeds } from '@/db/schema'
import { ArticleList } from '@/components/ArticleList'
import { ArticlePane } from '@/components/ArticlePane'
import { CategoryChips } from '@/components/CategoryChips'

export const dynamic = 'force-dynamic'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; article?: string }>
}) {
  const { category, article } = await searchParams
  const categoryId = category ? Number(category) : null
  const selectedId = article ? Number(article) : null

  const cats = await db.select().from(categories).orderBy(categories.name)
  const rows = await db
    .select({
      id: articles.id,
      title: articles.title,
      description: articles.description,
      imageUrl: articles.imageUrl,
      publishedAt: articles.publishedAt,
      bookmarked: articles.bookmarked,
      feedTitle: feeds.title,
    })
    .from(articles)
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .where(categoryId ? eq(feeds.categoryId, categoryId) : undefined)
    .orderBy(desc(articles.publishedAt))
    .limit(100)

  const base = categoryId ? `/?category=${categoryId}` : '/'
  const hrefFor = (id: number) => (categoryId ? `${base}&article=${id}` : `/?article=${id}`)
  const showDetail = Boolean(article)

  return (
    <div className="lg:grid lg:h-dvh lg:grid-cols-[24rem_1fr]">
      <section
        className={`${showDetail ? 'hidden lg:block' : ''} lg:overflow-y-auto lg:border-r lg:border-rule`}
      >
        <header className="pb-3 lg:px-6 lg:pt-8">
          <h1 className="text-2xl font-semibold tracking-tight lg:hidden">Feedr</h1>
          <p className="mono-label hidden lg:block">Fil</p>
          <div className="mt-3 lg:hidden">
            <CategoryChips categories={cats} activeId={categoryId} />
          </div>
        </header>
        <ArticleList
          articles={rows}
          hrefFor={hrefFor}
          selectedId={selectedId}
          emptyLabel="Aucun article — ajoute des flux dans les réglages"
        />
      </section>

      <section className={`${showDetail ? '' : 'hidden'} lg:block lg:overflow-y-auto`}>
        {showDetail && (
          <div className="pt-2 lg:hidden">
            <Link href={base} className="mono-label -m-2 p-2 transition-colors hover:text-foreground">
              ← Retour
            </Link>
          </div>
        )}
        <ArticlePane articleParam={article} />
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier** : `npx vitest run`, `npm run build`. Live (données seedées) : `/` → liste ; `/?article=<id existant>` → HTML contient l'article détaillé ET la liste (les deux sections, CSS décidant de la visibilité) ; `/?article=999999` → « Article introuvable » ; `/?category=<id>&article=<id>` garde le filtre. Kill.

- [ ] **Step 3: Commit** : `git add -A && git commit -m "feat: fil 2 volets desktop, détail plein écran mobile"`

---

### Task 6: Bookmarks 2 volets

**Files:**
- Modify: `src/app/bookmarks/page.tsx`

- [ ] **Step 1: Remplacer `src/app/bookmarks/page.tsx`** :

```tsx
import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { articles, feeds } from '@/db/schema'
import { ArticleList } from '@/components/ArticleList'
import { ArticlePane } from '@/components/ArticlePane'

export const dynamic = 'force-dynamic'

export default async function BookmarksPage({
  searchParams,
}: {
  searchParams: Promise<{ article?: string }>
}) {
  const { article } = await searchParams
  const selectedId = article ? Number(article) : null

  const rows = await db
    .select({
      id: articles.id,
      title: articles.title,
      description: articles.description,
      imageUrl: articles.imageUrl,
      publishedAt: articles.publishedAt,
      bookmarked: articles.bookmarked,
      feedTitle: feeds.title,
    })
    .from(articles)
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .where(eq(articles.bookmarked, true))
    .orderBy(desc(articles.publishedAt))

  const showDetail = Boolean(article)

  return (
    <div className="lg:grid lg:h-dvh lg:grid-cols-[24rem_1fr]">
      <section
        className={`${showDetail ? 'hidden lg:block' : ''} lg:overflow-y-auto lg:border-r lg:border-rule`}
      >
        <header className="pb-3 lg:px-6 lg:pt-8">
          <h1 className="text-2xl font-semibold tracking-tight lg:hidden">Bookmarks</h1>
          <p className="mono-label hidden lg:block">Bookmarks</p>
        </header>
        <ArticleList
          articles={rows}
          hrefFor={(id) => `/bookmarks?article=${id}`}
          selectedId={selectedId}
          emptyLabel="Aucun article bookmarké"
        />
      </section>

      <section className={`${showDetail ? '' : 'hidden'} lg:block lg:overflow-y-auto`}>
        {showDetail && (
          <div className="pt-2 lg:hidden">
            <Link href="/bookmarks" className="mono-label -m-2 p-2 transition-colors hover:text-foreground">
              ← Retour
            </Link>
          </div>
        )}
        <ArticlePane articleParam={article} />
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier** : `npx vitest run`, `npm run build`. Live : bookmarker un article via le fil (ou en DB), `/bookmarks` le liste, `/bookmarks?article=<id>` l'affiche. Kill.

- [ ] **Step 3: Commit** : `git add -A && git commit -m "feat: bookmarks 2 volets"`

---

### Task 7: Réglages restylés

**Files:**
- Modify: `src/app/settings/page.tsx`, `src/components/AddFeedForm.tsx`, `src/components/EnableNotifications.tsx`

- [ ] **Step 1: Page** — remplacer `src/app/settings/page.tsx` (structure identique, styles tokens ; `ConfirmSubmitButton` inchangé) :

```tsx
import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { categories, feeds } from '@/db/schema'
import {
  createCategory, deleteCategory, deleteFeed, toggleCategoryNotify,
} from '@/app/actions'
import { AddFeedForm } from '@/components/AddFeedForm'
import { ConfirmSubmitButton } from '@/components/ConfirmSubmitButton'
import { EnableNotifications } from '@/components/EnableNotifications'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const cats = await db.select().from(categories).orderBy(asc(categories.name))
  const feedRows = await db
    .select({
      id: feeds.id,
      url: feeds.url,
      title: feeds.title,
      lastError: feeds.lastError,
      categoryName: categories.name,
    })
    .from(feeds)
    .innerJoin(categories, eq(feeds.categoryId, categories.id))
    .orderBy(asc(categories.name), asc(feeds.title))

  return (
    <div className="space-y-12 lg:mx-auto lg:max-w-2xl lg:px-8 lg:py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Réglages</h1>

      <section className="space-y-4">
        <h2 className="mono-label border-b border-rule pb-2">Notifications</h2>
        <EnableNotifications vapidPublicKey={process.env.VAPID_PUBLIC_KEY!} />
      </section>

      <section className="space-y-4">
        <h2 className="mono-label border-b border-rule pb-2">Catégories</h2>
        <ul className="divide-y divide-rule">
          {cats.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 py-2.5">
              <span className="text-sm">{c.name}</span>
              <span className="flex items-center gap-4">
                <form action={toggleCategoryNotify.bind(null, c.id, !c.notify)}>
                  <button
                    aria-label="Basculer les notifications"
                    className={`-m-2 p-2 transition-colors ${c.notify ? 'text-accent' : 'text-muted hover:text-foreground'}`}
                    title={c.notify ? 'Notifications activées' : 'Notifications désactivées'}
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill={c.notify ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </form>
                <form action={deleteCategory.bind(null, c.id)}>
                  <ConfirmSubmitButton
                    confirmMessage="Supprimer cette catégorie ? Ses flux et articles (y compris bookmarkés) seront supprimés."
                    ariaLabel="Supprimer la catégorie"
                    className="-m-2 p-2 text-muted transition-colors hover:text-foreground"
                  >
                    ✕
                  </ConfirmSubmitButton>
                </form>
              </span>
            </li>
          ))}
        </ul>
        <form action={createCategory} className="flex gap-2">
          <input
            name="name"
            required
            placeholder="Nouvelle catégorie"
            className="flex-1 rounded border border-rule bg-surface px-3 py-1.5 text-sm outline-none focus:border-foreground"
          />
          <button className="mono-label rounded border border-rule bg-surface px-3 py-1.5 transition-colors hover:text-foreground motion-reduce:transition-none">
            Ajouter
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="mono-label border-b border-rule pb-2">Flux</h2>
        <ul className="divide-y divide-rule">
          {feedRows.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 py-2.5">
              <span className="min-w-0">
                <span className="block truncate text-sm">{f.title}</span>
                <span className="mono-label block">
                  {f.categoryName}
                  {f.lastError && <span className="text-red-500"> · erreur : {f.lastError}</span>}
                </span>
              </span>
              <form action={deleteFeed.bind(null, f.id)}>
                <ConfirmSubmitButton
                  confirmMessage="Supprimer ce flux ? Ses articles (y compris bookmarkés) seront supprimés."
                  ariaLabel="Supprimer le flux"
                  className="-m-2 p-2 text-muted transition-colors hover:text-foreground"
                >
                  ✕
                </ConfirmSubmitButton>
              </form>
            </li>
          ))}
        </ul>
        {cats.length === 0 ? (
          <p className="text-sm text-muted">Crée d’abord une catégorie.</p>
        ) : (
          <AddFeedForm categories={cats.map(({ id, name }) => ({ id, name }))} />
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: AddFeedForm** — remplacer les className dans `src/components/AddFeedForm.tsx` (logique inchangée) :

```tsx
'use client'

import { useActionState } from 'react'
import { addFeed, type AddFeedState } from '@/app/actions'

const initial: AddFeedState = { error: null }

export function AddFeedForm({ categories }: { categories: { id: number; name: string }[] }) {
  const [state, formAction, pending] = useActionState(addFeed, initial)
  return (
    <form action={formAction} className="space-y-2">
      <input
        name="url"
        type="url"
        required
        placeholder="https://exemple.com/feed.xml"
        className="w-full rounded border border-rule bg-surface px-3 py-1.5 text-sm outline-none focus:border-foreground"
      />
      <select
        name="categoryId"
        required
        className="w-full rounded border border-rule bg-surface px-3 py-1.5 text-sm outline-none focus:border-foreground"
      >
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <button
        disabled={pending}
        className="mono-label rounded border border-rule bg-surface px-3 py-1.5 transition-colors hover:text-foreground disabled:opacity-50 motion-reduce:transition-none"
      >
        {pending ? 'Ajout…' : 'Ajouter le flux'}
      </button>
      {state.error && <p className="text-sm text-red-500">{state.error}</p>}
    </form>
  )
}
```

- [ ] **Step 3: EnableNotifications** — dans `src/components/EnableNotifications.tsx`, remplacer uniquement le JSX de retour (la logique `enable()` et les états restent identiques) :

```tsx
  return (
    <div>
      <button
        onClick={enable}
        disabled={status === 'working' || status === 'done'}
        className="mono-label rounded border border-rule bg-surface px-3 py-1.5 transition-colors hover:text-foreground disabled:opacity-50 motion-reduce:transition-none"
      >
        {status === 'done' ? 'Notifications activées ✓' : 'Activer les notifications sur cet appareil'}
      </button>
      {status === 'error' && (
        <p className="mt-2 text-sm text-red-500">
          Échec — vérifie que la PWA est installée (écran d’accueil) et que les notifications sont autorisées.
        </p>
      )}
    </div>
  )
```

- [ ] **Step 4: Vérifier** : `npx vitest run`, `npm run build`. Live : `/settings` restylé, formulaires fonctionnels (ajouter/supprimer une catégorie test). Kill.

- [ ] **Step 5: Commit** : `git add -A && git commit -m "feat: réglages restylés (mono-labels, hairlines)"`

---

### Task 8: Vérification visuelle complète + déploiement

**Files:** aucun (vérification + deploy)

- [ ] **Step 1: Passe visuelle** — dev server + navigateur (Chrome DevTools MCP ou Playwright MCP) sur les données seedées. Vérifier et capturer :
  - Desktop 1280px : `/` (3 volets, sélection d'article avec filet accent, catégorie active dans la sidebar), `/bookmarks`, `/settings`, état vide du volet.
  - Mobile 390px : `/` (liste + chips + tab bar), `/?article=<id>` (plein écran + ← Retour), `/settings`.
  - Dark mode (émulation `prefers-color-scheme: dark`) sur `/` desktop et mobile.
  - `prefers-reduced-motion` ne casse rien (hover CTA).
- [ ] **Step 2: Suite complète** : `npx vitest run` (44/44), `npm run build`, `npx eslint src/`.
- [ ] **Step 3: Merge + deploy** : merge de la branche dans main (`git checkout main && git merge --no-ff <branche>`), `vercel deploy --prod --yes`, smoke test : `GET /` 200, `GET /api/poll?secret=…` OK, `GET /manifest.webmanifest` avec `#ffffff`.

---

## Vérification finale contre la spec

Tokens/typo/formes/motion → Task 1. Sidebar → Task 2. ArticleDetail partagé + `/article/[id]` conservé pour les push → Task 3. Rangées hairline + accent rationné + chips → Task 4. Fil `?article` (desktop volet, mobile plein écran, introuvable) → Task 5. Bookmarks → Task 6. Réglages restylés → Task 7. Vérif light/dark/mobile/desktop + deploy → Task 8. Les 44 tests restent verts à chaque tâche.
