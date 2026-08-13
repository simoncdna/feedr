/**
 * Manipulation des listes paginées du fil et des bookmarks.
 *
 * Génériques sur le type de ligne, et sans un seul import : le module ne tire ni
 * `@/db`, ni React, ni le framework. C'est ce qui le rend testable dans
 * l'environnement `node` de Vitest — un test qui passerait par `@/mutations`
 * tirerait `@/server/mutations`, donc `@/db`, qui instancie le client Drizzle dès
 * l'import et exige une DATABASE_URL.
 */

/**
 * Ancre d'une page. Le couple, et non la seule date : les égalités de
 * `publishedAt` sont courantes ici — `normalizeItem` replie sur `now` tout item
 * de flux sans date, donc un lot entier partage un timestamp. Sans `id` pour
 * trancher, l'ordre n'est pas total et la pagination saute ou répète des lignes.
 */
export type FeedCursor = { publishedAt: Date; id: number }

export type FeedPage<Row> = { rows: Row[]; nextCursor: FeedCursor | null }

/** La forme que React Query donne aux données d'un `useInfiniteQuery`. */
export type InfiniteFeed<Row> = { pages: Array<FeedPage<Row>>; pageParams: unknown[] }

/** Les lignes de toutes les pages, dans l'ordre. */
export function flattenPages<Row>(data: InfiniteFeed<Row> | undefined): Row[] {
  return data?.pages.flatMap((p) => p.rows) ?? []
}

/**
 * Applique un correctif à une ligne, où qu'elle soit dans les pages.
 *
 * Remplace le `patchList` d'avant la pagination, qui opérait sur un tableau plat.
 * Sur des données paginées celui-ci ne trouvait plus rien — sans erreur ni
 * avertissement — et la bascule optimiste du bookmark cessait simplement d'être
 * immédiate au swipe.
 *
 * Recopie plutôt que muter : React Query partage l'objet en cache, et le modifier
 * en place contournerait la réconciliation.
 */
export function patchRow<Row extends { id: number }>(
  data: InfiniteFeed<Row> | undefined,
  id: number,
  patch: Partial<Row>,
): InfiniteFeed<Row> | undefined {
  if (!data) return data
  return {
    ...data,
    pages: data.pages.map((p) => ({
      ...p,
      rows: p.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })),
  }
}

/**
 * L'article à mettre en avant : le premier pourvu d'une image, sinon le premier.
 *
 * À appeler sur la PREMIÈRE PAGE seulement. Sur la liste complète, une page
 * suivante apportant une image alors que la première n'en avait pas changerait le
 * héros, et le fil se réordonnerait sous le doigt du lecteur.
 */
export function pickHero<Row extends { imageUrl: string | null }>(rows: Row[]): Row | undefined {
  return rows.find((r) => r.imageUrl) ?? rows[0]
}

/** Le héros en tête, le reste dans son ordre d'origine. */
export function orderWithHero<Row extends { id: number }>(
  rows: Row[],
  hero: Row | undefined,
): Row[] {
  if (!hero) return rows
  return [hero, ...rows.filter((r) => r.id !== hero.id)]
}
