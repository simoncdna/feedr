import {
  HeadContent,
  Link,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'

import appCss from '../styles.css?url'
import { RegisterSW } from '@/components/RegisterSW'
import { Sidebar } from '@/components/Sidebar'
import { TabBar } from '@/components/TabBar'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

// Repris caractère pour caractère de l'app Next : évite le flash de thème au
// chargement et s'accorde avec ThemeToggle. Ne pas retoucher.
const THEME_BOOTSTRAP = `try{var t=localStorage.theme;if(t==='dark'||t==='light'){document.documentElement.dataset.theme=t;var c=t==='dark'?'#0c0c0e':'#ffffff';var o=document.querySelector('meta[name="theme-color"][data-theme-override]');if(!o){o=document.createElement('meta');o.setAttribute('name','theme-color');o.setAttribute('data-theme-override','');document.head.insertBefore(o,document.head.querySelector('meta[name="theme-color"]'))}o.setAttribute('content',c)}}catch(e){}`

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      // viewport-fit=cover : indispensable, tout le traitement des zones sûres
      // de styles.css en dépend.
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      { title: 'Feedr' },
      { name: 'description', content: 'Personal RSS reader' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      { name: 'apple-mobile-web-app-title', content: 'Feedr' },
      // Les deux `theme-color` ne passent PAS par `head.meta` : le router
      // déduplique sur `name` seul (headContentUtils.js — `media` n'entre pas
      // dans la clé), donc la seconde serait silencieusement écartée. Elles sont
      // écrites en dur dans <head> plus bas.
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'apple-touch-icon', href: '/icon-192.png' },
    ],
  }),
  // Sans ce composant, chaque requête vers une URL inconnue — /favicon.ico en
  // tête, que l'app Next ne servait pas davantage — déclenche un notFoundError
  // sur __root__ et un avertissement du routeur, soit ~180 par chargement.
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
})

function NotFound() {
  return (
    <div className="mx-auto max-w-sm px-4 pt-16">
      <p className="mono-label">Feedr</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Not found</h1>
      <p className="mt-8">
        <Link to="/" search={{ category: undefined }} className="cta-link text-sm font-medium">
          Back to the feed
          <span className="cta-arrow" aria-hidden="true">→</span>
        </Link>
      </p>
    </div>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Avant <HeadContent /> : le bootstrap de thème insère sa balise
            d'override devant la PREMIÈRE `meta[name="theme-color"]`, et un
            navigateur retient la première dont le `media` s'applique — une
            balise sans `media` s'applique toujours. L'ordre fait donc gagner
            l'override manuel, exactement comme dans l'app Next. */}
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0c0c0e" media="(prefers-color-scheme: dark)" />
        <HeadContent />
      </head>
      {/* Châssis repris de src/app/layout.tsx : mêmes classes, même ordre. */}
      <body className="bg-background text-foreground antialiased">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        <div className="lg:flex">
          <Sidebar />
          <main className="mx-auto w-full max-w-lg pb-28 pt-4 lg:m-0 lg:min-w-0 lg:max-w-none lg:flex-1 lg:p-0">
            {children}
          </main>
        </div>
        <TabBar />
        <RegisterSW />
        <Scripts />
      </body>
    </html>
  )
}
