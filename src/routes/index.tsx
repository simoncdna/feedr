import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseInfiniteQuery, useSuspenseQuery } from '@tanstack/react-query'
import { ArticleList } from '@/components/ArticleList'
import { BackButton } from '@/components/BackButton'
import { ArticleDetail } from '@/components/ArticleDetail'
import { CategoryChips } from '@/components/CategoryChips'
import { EmptyPane } from '@/components/EmptyPane'
import { FeedSkeleton } from '@/components/Skeletons'
import { ResizablePanes } from '@/components/ResizablePanes'
import { flattenPages, orderWithHero, pickHero } from '@/lib/feed-pages'
import { articleQuery, categoriesQuery, feedQuery } from '@/queries'
import { feedSearchSchema } from './-search'

export const Route = createFileRoute('/')({
	validateSearch: feedSearchSchema,
	loaderDeps: ({ search: { category, article } }) => ({ category, article }),
	loader: async ({ context: { queryClient }, deps: { category, article } }) => {
		await Promise.all([
			queryClient.ensureQueryData(categoriesQuery()),
			// La première page seulement : les suivantes viennent au défilement.
			queryClient.ensureInfiniteQueryData(feedQuery(category ?? null)),
			article ? queryClient.ensureQueryData(articleQuery(article)) : Promise.resolve(),
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
					{/* Fond OPAQUE, pas 95 % + flou : sous la barre de statut, Safari applique
              son propre matériau translucide par-dessus, et deux translucidités
              superposées laissent voir la photo de l'article derrière l'heure et
              la Dynamic Island. En desktop l'en-tête redevient transparent, il n'y
              a pas de barre de statut à couvrir. */}
					{/* `-mt-4 pt-4` : l'en-tête remonte dans le `pt-4` de <main> pour que
					    le titre s'aligne sur ceux de Bookmarks et Settings, qui n'ont pas
					    de padding haut à eux. Le padding est déplacé ici plutôt que
					    supprimé — c'est lui qui tient l'air au-dessus du titre une fois
					    l'en-tête collé, quand le padding de <main> a défilé. */}
					<header className="sticky top-0 z-30 -mt-4 bg-background px-4 pt-4 lg:static lg:mt-0 lg:bg-transparent lg:px-6 lg:pb-3 lg:pt-8">
						<h1 className="text-3xl font-bold tracking-tight lg:hidden">Feed</h1>
						<p className="hidden text-3xl font-bold tracking-tight lg:block">Feed</p>
						<div className="pt-3 lg:hidden">
							<CategoryChips categories={cats} activeId={category ?? null} />
						</div>
					</header>
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
					{showDetail && (
						<div className="px-4 pt-2 lg:hidden">
							<BackButton fallback={() => navigate({ to: '/', search: { category } })}>
								← Back
							</BackButton>
						</div>
					)}
					<ArticleDetailPane id={article} categoryId={category ?? null} />
				</section>
			}
		/>
	)
}

function ArticleDetailPane({ id, categoryId }: { id: number | undefined; categoryId: number | null }) {
	if (!id) return <EmptyPane label="Select an article" />
	return <LoadedArticle id={id} categoryId={categoryId} />
}

function LoadedArticle({ id, categoryId }: { id: number; categoryId: number | null }) {
	const { data: article } = useSuspenseQuery(articleQuery(id))
	if (!article) return <EmptyPane label="Article not found" />
	return <ArticleDetail article={article} categoryId={categoryId} />
}
