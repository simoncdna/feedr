import { createFileRoute, notFound, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ArticleDetail } from '@/components/ArticleDetail'
import { DetailPane } from '@/components/DetailPane'
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
  const navigate = useNavigate()
  const { data: article } = useSuspenseQuery(articleQuery(id))
  if (!article) throw notFound()
  return (
    // Cible des notifications push : arrivé ici depuis une notification,
    // l'historique est vide et le repli sur le fil est le seul chemin — d'où le
    // `fallback`, que le geste de bord emprunte aussi.
    <DetailPane showBack fallback={() => navigate({ to: '/', search: {} })} label="Feed">
      <ArticleDetail article={article} />
    </DetailPane>
  )
}
