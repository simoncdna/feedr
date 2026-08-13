import { useEffect, useState } from 'react'
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import {
  articleQuery,
  bookmarksQuery,
  categoriesQuery,
  feedQuery,
  settingsQuery,
} from '@/queries'
import {
  addFeed,
  createCategory,
  createInvitation,
  deleteCategory,
  deleteFeed,
  fetchFullContent,
  toggleBookmark,
  toggleCategoryNotify,
} from '@/server/mutations'
import { patchRow, type InfiniteFeed } from '@/lib/feed-pages'
import type { ArticleCardData, ArticleDetailData } from '@/server/queries'

// Ces hooks remplacent les revalidatePath() de l'app Next : chaque mutation
// invalide exactement les clés qu'elle périme.

// Le fil et les bookmarks sont paginés : sous ces clés, React Query stocke
// `{ pages, pageParams }` et non un tableau. Un patch écrit pour un tableau plat
// n'y trouverait rien, sans erreur ni avertissement — la bascule cesserait
// simplement d'être immédiate au swipe. D'où `patchRow`, et ses tests.
type FeedData = InfiniteFeed<ArticleCardData> | undefined

/**
 * Bascule de bookmark, optimiste — c'est un gain explicite de la spec : le swipe
 * doit répondre sans attendre l'aller-retour serveur.
 *
 * Trois caches sont touchés parce que trois vues affichent l'état : le fil de la
 * catégorie courante, la liste des bookmarks, et le détail de l'article (dont le
 * bouton lit `articleQuery`). Le plan n'en patchait qu'un ; les deux autres
 * seraient restés figés jusqu'au refetch.
 */
export function useToggleBookmark(categoryId: number | null = null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: number; bookmarked: boolean }) => toggleBookmark({ data: v }),
    onMutate: async ({ id, bookmarked }) => {
      const feedKey = feedQuery(categoryId).queryKey
      const bookmarksKey = bookmarksQuery().queryKey
      const articleKey = articleQuery(id).queryKey
      await Promise.all(
        [feedKey, bookmarksKey, articleKey].map((queryKey) =>
          queryClient.cancelQueries({ queryKey }),
        ),
      )
      const precedent: [QueryKey, unknown][] = [
        [feedKey, queryClient.getQueryData(feedKey)],
        [bookmarksKey, queryClient.getQueryData(bookmarksKey)],
        [articleKey, queryClient.getQueryData(articleKey)],
      ]
      queryClient.setQueryData<FeedData>(feedKey, (d) => patchRow(d, id, { bookmarked }))
      queryClient.setQueryData<FeedData>(bookmarksKey, (d) => patchRow(d, id, { bookmarked }))
      queryClient.setQueryData<ArticleDetailData | null>(articleKey, (a) =>
        a ? { ...a, bookmarked } : a,
      )
      return { precedent }
    },
    onError: (_err, _v, ctx) => {
      // Rétablir l'état d'avant le geste : sans ça, l'UI mentirait sur un échec.
      ctx?.precedent.forEach(([key, data]) => queryClient.setQueryData(key, data))
    },
    onSettled: (_data, _error, { id }) => {
      // Préfixe ['feed'] et non la seule clé de la catégorie courante : les fils
      // des autres catégories affichent le même article et seraient restés faux.
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: bookmarksQuery().queryKey })
      queryClient.invalidateQueries({ queryKey: articleQuery(id).queryKey })
    },
  })
}

// Toucher aux catégories ou aux flux périme trois vues : la page réglages, les
// chips de catégorie et le contenu du fil. C'est le pendant des trois
// revalidatePath('/settings' / '/' / layout) de l'original.
function useSettingsMutation<TVars, TData>(mutationFn: (v: TVars) => Promise<TData>) {
  const queryClient = useQueryClient()
  return useMutation<TData, Error, TVars>({
    mutationFn,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: settingsQuery().queryKey })
      queryClient.invalidateQueries({ queryKey: categoriesQuery().queryKey })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}

export function useCreateCategory() {
  return useSettingsMutation((name: string) => createCategory({ data: name }))
}

export function useToggleCategoryNotify() {
  return useSettingsMutation((v: { id: number; notify: boolean }) =>
    toggleCategoryNotify({ data: v }),
  )
}

export function useDeleteCategory() {
  return useSettingsMutation((id: number) => deleteCategory({ data: id }))
}

export function useAddFeed() {
  return useSettingsMutation((v: { url: string; categoryId: number }) => addFeed({ data: v }))
}

export function useDeleteFeed() {
  return useSettingsMutation((id: number) => deleteFeed({ data: id }))
}

export function useCreateInvitation() {
  return useMutation({
    mutationFn: (v: { kind: 'signup' | 'recovery'; targetUserId?: string }) =>
      createInvitation({ data: v }),
  })
}

/**
 * Va chercher le texte complet à l'ouverture d'un article, une fois par article,
 * et rend `true` tant qu'il faut afficher un squelette à la place du corps.
 *
 * `attempted` est `article.fullContentAt !== null`, jamais la présence du texte :
 * une tentative ratée pose une date sans corps, et confondre les deux relancerait
 * le scraping à chaque ouverture. En cas d'échec on ne réessaie pas dans ce
 * rendu, et l'article retombe sur le contenu du flux. Attention : selon l'endroit
 * où l'échec s'est produit, la base peut ne rien savoir. `recordAttempt` n'est
 * atteint qu'après le retour de `fetchPage` ; une panne côté plateforme (function
 * tuée, 502, session expirée) ne note donc aucune tentative, et l'article sera
 * rescrapé à la prochaine ouverture.
 *
 * La réponse est écrite dans le cache du détail plutôt que la clé invalidée : la
 * server fn rend déjà le contenu, un refetch serait un aller-retour pour rien.
 * La date posée n'est pas celle de la base — le serveur ne la rend pas — mais
 * seule sa présence est lue, jamais sa valeur, qui ne s'affiche nulle part.
 *
 * L'annulation avant l'écriture n'est pas décorative, et elle est délibérément
 * dans `onSuccess` et non dans `onMutate` : le refetch qui pose problème part
 * *pendant* le scraping (retour au premier plan de la PWA, invalidation par un
 * bookmark, préchargement de route au survol), donc après le début de la
 * mutation. Il photographie la ligne avec `full_content_at` encore nul, et sans
 * cette annulation sa réponse atterrit après la nôtre et la rembobine : le corps
 * disparaît sous les yeux du lecteur et l'effet repart.
 *
 * L'id voyage en variable de mutation et non par la fermeture, et figure dans les
 * dépendances de l'effet. Les deux tiennent au même mécanisme : `mutate` est une
 * référence stable, et `MutationObserver.setOptions` réinjecte les options du
 * dernier rendu dans une mutation encore en vol. Sans l'id en dépendance, deux
 * articles jamais tentés d'affilée ne déclencheraient qu'une requête, pour le
 * premier ; avec un `onSuccess` qui lirait l'id de la fermeture, changer
 * d'article pendant le scraping — une dizaine de secondes dans le pire cas —
 * écrirait le corps du premier dans la clé du second.
 */
export function useFullContent(id: number, attempted: boolean) {
  const queryClient = useQueryClient()
  // L'échec est retenu par article, et non lu sur la mutation. `isPending` comme
  // `isError` sont l'état de l'observateur, qui survit à l'article auquel il se
  // rapporte : après un article en échec, le suivant jamais tenté hériterait de
  // son `isError`, verrait son extrait de flux peint le temps d'une image, puis
  // le squelette — le clignotement que ce hook existe pour éviter.
  const [failedId, setFailedId] = useState<number | null>(null)
  const { mutate } = useMutation({
    mutationFn: (articleId: number) => fetchFullContent({ data: articleId }),
    onSuccess: async (fullContent, articleId) => {
      const queryKey = articleQuery(articleId).queryKey
      await queryClient.cancelQueries({ queryKey })
      queryClient.setQueryData<ArticleDetailData | null>(queryKey, (a) =>
        a ? { ...a, fullContent, fullContentAt: new Date() } : a,
      )
    },
    onError: (_err, articleId) => setFailedId(articleId),
  })
  useEffect(() => {
    if (!attempted) mutate(id)
  }, [id, attempted, mutate])
  // Et non `isPending` : au premier rendu la mutation n'est pas encore partie et
  // l'extrait du flux apparaîtrait le temps d'une image avant le squelette.
  return !attempted && failedId !== id
}
