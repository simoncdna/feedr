import { describe, it, expect } from 'vitest'
import { buildNotifications, type InsertedArticle } from '@/lib/notify'

const make = (over: Partial<InsertedArticle>): InsertedArticle => ({
  id: 1, title: 'Titre', feedTitle: 'Mon Flux', categoryNotify: true, ...over,
})

describe('buildNotifications', () => {
  it('ne notifie que les catégories avec notify=true', () => {
    const r = buildNotifications([
      make({ id: 1, categoryNotify: true }),
      make({ id: 2, categoryNotify: false }),
    ])
    expect(r).toHaveLength(1)
    expect(r[0].url).toBe('/article/1')
  })

  it('payload = nom du flux en titre, titre d’article en body', () => {
    expect(buildNotifications([make({ id: 7, title: 'Big news', feedTitle: 'HN' })])).toEqual([
      { title: 'HN', body: 'Big news', url: '/article/7' },
    ])
  })
})
