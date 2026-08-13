import { Suspense } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseInfiniteQuery, useSuspenseQuery } from '@tanstack/react-query'
import { ArticleList } from '@/components/ArticleList'
import { ArticleDetail } from '@/components/ArticleDetail'
import { CategoryChips } from '@/components/CategoryChips'
import { DetailPane } from '@/components/DetailPane'
import { EmptyPane } from '@/components/EmptyPane'
import { ArticleSkeleton, FeedSkeleton } from '@/components/Skeletons'
import { ResizablePanes } from '@/components/ResizablePanes'
import { flattenPages, orderWithHero, pickHero } from '@/lib/feed-pages'
import { articleQuery, categoriesQuery, feedQuery } from '@/queries'
import { feedSearchSchema } from './-search'

export const Route = createFileRoute('/')({
	validateSearch: feedSearchSchema,
	// `article` n'est PLUS une dépendance du loader. Il l'était, et comme
	// `pendingComponent` remplace tout l'arbre de la route, ouvrir un article
	// affichait le squelette du FIL — bloc image 2/1 et rangées comprises —
	// glissant depuis la droite, avant le vrai article (mesuré : squelette à
	// +24 ms, article à +640 ms). Le squelette ne décrivait pas la destination,
	// et la liste disparaissait pour rien. C'est un `<Suspense>` autour du seul
	// volet de détail qui s'en charge maintenant, avec le bon squelette.
	loaderDeps: ({ search: { category } }) => ({ category }),
	loader: async ({ context: { queryClient }, deps: { category } }) => {
		await Promise.all([
			queryClient.ensureQueryData(categoriesQuery()),
			// La première page seulement : les suivantes viennent au défilement.
			queryClient.ensureInfiniteQueryData(feedQuery(category ?? null)),
		])
	},
	pendingComponent: FeedSkeleton,
	component: FeedPage,
})

function FeedPage() {
	const { category, article } = Route.useSearch()
	const navigate = Route.useNavigate()
	const { data: cats } = useSuspenseQuery(categoriesQuery())
	const { data, hasNextPage, isFetchingNextPage, fetchNextPage } = useSuspenseInfiniteQuery(
		feedQuery(category ?? null),
	)
	const showDetail = Boolean(article)

	// L'article mis en avant est le plus récent qui possède une image ; le reste du
	// fil garde l'ordre chronologique.
	//
	// Le héros est choisi sur la PREMIÈRE PAGE seulement. Sur la liste complète, une
	// page suivante apportant une image alors que la première n'en avait pas
	// changerait le héros, et le fil se réordonnerait sous le doigt du lecteur.
	const rows = flattenPages(data)
	const hero = pickHero(data.pages[0]?.rows ?? [])
	const ordered = orderWithHero(rows, hero)

	return (
		<ResizablePanes
			list={
				<section className={`${showDetail ? 'hidden lg:block' : ''} lg:overflow-y-auto`}>
					{/* Le grand titre défile avec le contenu, il n'est plus collé.
					    Collé, l'en-tête figeait 93 px sur 852 — 11 % de l'écran — pour
					    redire « Feed » que la barre d'onglets dit déjà en orange, et le
					    texte des articles passant dessous était coupé en plein glyphe.
					    Seuls les chips restent, et ils coupent sous leur propre filet. */}
					<header className="px-4 lg:px-6 lg:pt-8">
						<h1 className="text-2xl font-bold tracking-tight lg:hidden">Feed</h1>
						<p className="hidden text-2xl font-bold tracking-tight lg:block">Feed</p>
					</header>
					{/* Fond OPAQUE, pas 95 % + flou : sous la barre de statut, Safari applique
					    son propre matériau translucide par-dessus, et deux translucidités
					    superposées laissent voir la photo de l'article derrière l'heure et
					    la Dynamic Island. C'est cette bande qui tient désormais le haut de
					    l'écran en PWA. En desktop elle redevient transparente et statique,
					    il n'y a pas de barre de statut à couvrir. */}
					<div className="fondu-bas sticky top-0 z-30 mt-3 bg-background px-4 lg:static lg:mt-0 lg:bg-transparent lg:px-6 lg:pb-3 lg:after:hidden">
						<CategoryChips categories={cats} activeId={category ?? null} />
					</div>
					<ArticleList
						articles={ordered}
						linkPropsFor={(id) => ({ to: '/', search: { category, article: id } })}
						selectedId={article ?? null}
						categoryId={category ?? null}
						featuredFirst
						emptyLabel="No articles — add feeds in settings"
						pagination={{ hasNextPage, isFetchingNextPage, fetchNextPage }}
					/>
				</section>
			}
			detail={
				<section className={`${showDetail ? '' : 'hidden'} lg:block lg:overflow-y-auto`}>
					<DetailPane
						showBack={showDetail}
						fallback={() => navigate({ to: '/', search: { category } })}
					>
						<ArticleDetailPane id={article} categoryId={category ?? null} />
					</DetailPane>
				</section>
			}
		/>
	)
}

function ArticleDetailPane({ id, categoryId }: { id: number | undefined; categoryId: number | null }) {
	if (!id) return <EmptyPane label="Select an article" />
	return (
		<Suspense fallback={<ArticleSkeleton />}>
			<LoadedArticle id={id} categoryId={categoryId} />
		</Suspense>
	)
}

function LoadedArticle({ id, categoryId }: { id: number; categoryId: number | null }) {
	const { data: article } = useSuspenseQuery(articleQuery(id))
	if (!article) return <EmptyPane label="Article not found" />
	return <ArticleDetail article={article} categoryId={categoryId} />
}
