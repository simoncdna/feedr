import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'

import appCss from '../styles.css?url'

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
  shellComponent: RootDocument,
})

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
      <body className="bg-background text-foreground antialiased">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        {children}
        <Scripts />
      </body>
    </html>
  )
}
