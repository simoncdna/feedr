import { useEffect } from 'react'
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
import type { ArticleCardData, ArticleDetailData } from '@/server/queries'

// Ces hooks remplacent les revalidatePath() de l'app Next : chaque mutation
// invalide exactement les clés qu'elle périme.

function patchList(rows: ArticleCardData[] | undefined, id: number, bookmarked: boolean) {
  return rows?.map((r) => (r.id === id ? { ...r, bookmarked } : r))
}

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
      queryClient.setQueryData<ArticleCardData[]>(feedKey, (rows) => patchList(rows, id, bookmarked))
      queryClient.setQueryData<ArticleCardData[]>(bookmarksKey, (rows) =>
        patchList(rows, id, bookmarked),
      )
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
 * le scraping à chaque ouverture. En cas d'échec réseau on ne réessaie pas non
 * plus — la server fn a noté la tentative côté base, et l'article retombe sur le
 * contenu du flux.
 *
 * La réponse est écrite dans le cache du détail plutôt que la clé invalidée : la
 * server fn rend déjà le contenu, un refetch serait un aller-retour pour rien.
 * La date posée n'est pas celle de la base — le serveur ne la rend pas — mais
 * seule sa présence est lue, jamais sa valeur, qui ne s'affiche nulle part.
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
  const { mutate, isError } = useMutation({
    mutationFn: (articleId: number) => fetchFullContent({ data: articleId }),
    onSuccess: (fullContent, articleId) => {
      queryClient.setQueryData<ArticleDetailData | null>(articleQuery(articleId).queryKey, (a) =>
        a ? { ...a, fullContent, fullContentAt: new Date() } : a,
      )
    },
  })
  useEffect(() => {
    if (!attempted) mutate(id)
  }, [id, attempted, mutate])
  // Et non `isPending` : au premier rendu la mutation n'est pas encore partie et
  // l'extrait du flux apparaîtrait le temps d'une image avant le squelette.
  // `isPending` est de plus partagé entre articles — il vaut encore `true` pour
  // celui qu'on vient de quitter, et masquerait le texte déjà en cache du suivant
  // pendant tout le scraping du précédent.
  return !attempted && !isError
}
