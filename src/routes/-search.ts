import { z } from 'zod'

// Un id absent, vide ou non numérique disparaît de l'objet plutôt que de devenir
// NaN — c'est la source de bugs que la migration corrige.
const id = z.coerce.number().int().positive().optional().catch(undefined)

export const feedSearchSchema = z.object({
  category: id,
  article: id,
})

export const bookmarksSearchSchema = z.object({
  article: id,
})

export type FeedSearch = z.infer<typeof feedSearchSchema>
