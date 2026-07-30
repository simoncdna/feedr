'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ThemeToggle } from './ThemeToggle'

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
      <div className="flex items-center justify-between">
        <Link href="/" className="mono-label text-foreground">
          Feedr
        </Link>
        <ThemeToggle />
      </div>

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
                aria-current={active ? 'page' : undefined}
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
