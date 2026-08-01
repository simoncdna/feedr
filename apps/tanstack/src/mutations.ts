import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { articleQuery, bookmarksQuery, categoriesQuery, feedQuery } from '@/queries'
import {
  addFeed,
  createCategory,
  createInvitation,
  deleteCategory,
  deleteFeed,
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

// Une catégorie ajoutée, renommée ou supprimée change la liste des chips et le
// contenu du fil : les deux clés partent.
function useCategoryMutation<TVars>(mutationFn: (v: TVars) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: categoriesQuery().queryKey })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}

export function useCreateCategory() {
  return useCategoryMutation((name: string) => createCategory({ data: name }))
}

export function useToggleCategoryNotify() {
  return useCategoryMutation((v: { id: number; notify: boolean }) =>
    toggleCategoryNotify({ data: v }),
  )
}

export function useDeleteCategory() {
  return useCategoryMutation((id: number) => deleteCategory({ data: id }))
}

export function useAddFeed() {
  return useCategoryMutation((v: { url: string; categoryId: number }) => addFeed({ data: v }))
}

export function useDeleteFeed() {
  return useCategoryMutation((id: number) => deleteFeed({ data: id }))
}

export function useCreateInvitation() {
  return useMutation({
    mutationFn: (v: { kind: 'signup' | 'recovery'; targetUserId?: string }) =>
      createInvitation({ data: v }),
  })
}
