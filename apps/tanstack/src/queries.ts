import { queryOptions } from '@tanstack/react-query'
import {
  getArticle,
  listBookmarks,
  listCategories,
  listFeedArticles,
  settingsData,
} from '@/server/queries'

// Les clés vivent ici : c'est ce qui remplace les 13 revalidatePath() de l'app
// Next, et ce qui rend l'invalidation ciblée possible après une mutation.
export const categoriesQuery = () =>
  queryOptions({
    queryKey: ['categories'],
    queryFn: () => listCategories(),
  })

export const feedQuery = (categoryId: number | null) =>
  queryOptions({
    queryKey: ['feed', categoryId],
    queryFn: () => listFeedArticles({ data: categoryId }),
  })

export const bookmarksQuery = () =>
  queryOptions({
    queryKey: ['bookmarks'],
    queryFn: () => listBookmarks(),
  })

export const articleQuery = (id: number) =>
  queryOptions({
    queryKey: ['article', id],
    queryFn: () => getArticle({ data: id }),
  })

export const settingsQuery = () =>
  queryOptions({
    queryKey: ['settings'],
    queryFn: () => settingsData(),
  })
