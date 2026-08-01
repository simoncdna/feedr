import { Link, useRouterState } from '@tanstack/react-router'

const tabs = [
  {
    href: '/', label: 'Feed',
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
    href: '/settings', label: 'Settings',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z" />
      </svg>
    ),
  },
] as const

const HIDDEN_ON = ['/sign-in', '/invite']

export function TabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null
  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-background/90 backdrop-blur lg:hidden"
    >
      <div className="mx-auto flex max-w-lg pb-[max(calc(var(--safe-bottom)-15px),0px)]">
        {tabs.map((tab) => {
          const active =
            tab.href === '/'
              ? pathname === '/' || pathname.startsWith('/article')
              : pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              to={tab.href}
              // `exact` est indispensable : sans lui le routeur considère `to="/"`
              // actif sur TOUTES les routes (correspondance par préfixe) et pose
              // aria-current="page" sur l'onglet Feed partout. C'est nous qui
              // calculons l'état actif, comme dans l'app Next.
              activeOptions={{ exact: true }}
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
