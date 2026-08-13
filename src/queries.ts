import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import type { FeedCursor } from '@/lib/feed-pages'
import {
  getArticle,
  listBookmarks,
  listCategories,
  listFeedArticles,
  currentUser,
  settingsData,
} from '@/server/queries'

// Les clés vivent ici : c'est ce qui remplace les 13 revalidatePath() de l'app
// Next, et ce qui rend l'invalidation ciblée possible après une mutation.
export const categoriesQuery = () =>
  queryOptions({
    queryKey: ['categories'],
    queryFn: () => listCategories(),
  })

// Les deux listes sont paginées par curseur. Les CLÉS NE CHANGENT PAS : les
// mutations invalident par préfixe `['feed']`, et les renommer casserait cette
// invalidation en silence.
export const feedQuery = (categoryId: number | null) =>
  infiniteQueryOptions({
    queryKey: ['feed', categoryId],
    queryFn: ({ pageParam }) => listFeedArticles({ data: { categoryId, cursor: pageParam } }),
    initialPageParam: null as FeedCursor | null,
    getNextPageParam: (derniere) => derniere.nextCursor,
  })

export const bookmarksQuery = () =>
  infiniteQueryOptions({
    queryKey: ['bookmarks'],
    queryFn: ({ pageParam }) => listBookmarks({ data: pageParam }),
    initialPageParam: null as FeedCursor | null,
    getNextPageParam: (derniere) => derniere.nextCursor,
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

export const sessionQuery = () =>
  queryOptions({
    queryKey: ['session'],
    queryFn: () => currentUser(),
  })
