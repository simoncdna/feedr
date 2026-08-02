import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ArticleDetail } from '@/components/ArticleDetail'
import { ArticleSkeleton } from '@/components/Skeletons'
import { articleQuery } from '@/queries'

// Cible des notifications push : lib/notify.ts construit `/article/${id}`.
// L'URL ne doit pas changer.
export const Route = createFileRoute('/article/$id')({
  params: {
    parse: ({ id }) => {
      const n = Number(id)
      if (!Number.isInteger(n)) throw notFound()
      return { id: n }
    },
    stringify: ({ id }) => ({ id: String(id) }),
  },
  loader: async ({ context: { queryClient }, params: { id } }) => {
    const article = await queryClient.ensureQueryData(articleQuery(id))
    if (!article) throw notFound()
  },
  pendingComponent: ArticleSkeleton,
  component: ArticlePage,
})

function ArticlePage() {
  const { id } = Route.useParams()
  const { data: article } = useSuspenseQuery(articleQuery(id))
  if (!article) throw notFound()
  return (
    <div>
      <div className="px-4 pt-2 lg:px-6 lg:pt-6">
        <Link to="/" search={{ category: undefined }} className="mono-label -m-2 p-2 transition-colors hover:text-foreground">
          ← Feed
        </Link>
      </div>
      <ArticleDetail article={article} />
    </div>
  )
}
