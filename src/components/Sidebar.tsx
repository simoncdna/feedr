import { Link, useRouterState } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ThemeToggle } from './ThemeToggle'
import { categoriesQuery, sessionQuery } from '@/queries'
import { signOut } from '@/server/mutations'

// Côté Next, Sidebar (serveur, requête DB) et SidebarClient étaient séparés. Ici
// une seule fonction : les catégories viennent du cache de categoriesQuery, déjà
// rempli par le loader du fil.
const nav = [
	{ href: '/', label: 'Feed' },
	{ href: '/bookmarks', label: 'Bookmarks' },
	{ href: '/settings', label: 'Settings' },
] as const

export function Sidebar() {
	const pathname = useRouterState({ select: (s) => s.location.pathname })
	const search = useRouterState({ select: (s) => s.location.search as { category?: number } })
	const { data: user } = useQuery(sessionQuery())
	// Sans session, listCategories jetterait un redirect : on ne la déclenche pas.
	const { data: categories } = useQuery({ ...categoriesQuery(), enabled: Boolean(user) })
	const leave = useMutation({ mutationFn: () => signOut() })

	if (!user) return null

	const onFeed = pathname === '/'
	const activeCategory = onFeed ? search.category ?? null : null

	const isActive = (href: string) =>
		href === '/'
			? (pathname === '/' && !search.category) || pathname.startsWith('/article')
			: pathname.startsWith(href)

	return (
		<aside className="sticky top-0 hidden h-11 w-60 shrink-0 flex-col gap-10 overflow-y-auto border-r border-rule px-6 py-8 lg:flex">
			<div className="flex items-center justify-between">
				<Link to="/" activeOptions={{ exact: true }} className="mono-label text-foreground">
					Feedr
				</Link>
				<ThemeToggle />
			</div>

			<nav aria-label="Main navigation" className="flex flex-col gap-3">
				{nav.map((item) => (
					<Link
						key={item.href}
						to={item.href}
						// Voir TabBar : sans `exact`, `to="/"` est actif partout et le routeur
						// pose son propre aria-current par-dessus le nôtre.
						activeOptions={{ exact: true }}
						aria-current={isActive(item.href) ? 'page' : undefined}
						className={`mono-label -m-2 p-2 transition-colors ${isActive(item.href) ? 'text-accent' : 'hover:text-foreground'
							}`}
					>
						{item.label}
					</Link>
				))}
			</nav>

			{categories && categories.length > 0 && (
				<div className="flex flex-col gap-1">
					<p className="mono-label mb-2">Categories</p>
					{categories.map((c) => {
						const active = activeCategory === c.id
						return (
							<Link
								key={c.id}
								to="/"
								search={{ category: c.id }}
								activeOptions={{ exact: true }}
								aria-current={active ? 'page' : undefined}
								className={`flex items-center justify-between gap-2 py-1.5 text-sm transition-colors ${active ? 'font-medium text-accent' : 'text-muted hover:text-foreground'
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

			<div className="mt-auto flex items-center justify-between gap-2 border-t border-rule pt-4">
				<p className="mono-label truncate">{user.name}</p>
				<button
					type="button"
					onClick={() => leave.mutate()}
					className="mono-label -m-2 p-2 transition-colors hover:text-foreground"
				>
					Sign out
				</button>
			</div>
		</aside>
	)
}
