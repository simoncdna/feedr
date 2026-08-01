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
      {
        name: 'theme-color',
        content: '#ffffff',
        media: '(prefers-color-scheme: light)',
      },
      {
        name: 'theme-color',
        content: '#0c0c0e',
        media: '(prefers-color-scheme: dark)',
      },
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
