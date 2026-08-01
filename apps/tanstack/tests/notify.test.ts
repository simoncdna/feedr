import { describe, it, expect } from 'vitest'
import { groupNotificationsByUser, type InsertedArticle } from '@/lib/notify'

const make = (over: Partial<InsertedArticle>): InsertedArticle => ({
  id: 1, title: 'Titre', feedTitle: 'Mon Flux', categoryNotify: true, userId: 'user-1', ...over,
})

describe('groupNotificationsByUser', () => {
  it('ne notifie que les catégories avec notify=true', () => {
    const map = groupNotificationsByUser([
      make({ id: 1, categoryNotify: true }),
      make({ id: 2, categoryNotify: false }),
    ])
    expect(map.get('user-1')).toEqual([{ title: 'Mon Flux', body: 'Titre', url: '/article/1' }])
  })

  it('payload = nom du flux en titre, titre d’article en body', () => {
    const map = groupNotificationsByUser([make({ id: 7, title: 'Big news', feedTitle: 'HN' })])
    expect(map.get('user-1')).toEqual([{ title: 'HN', body: 'Big news', url: '/article/7' }])
  })

  it('groupe les payloads par userId, en sautant les catégories notify=false', () => {
    const map = groupNotificationsByUser([
      make({ id: 1, title: 'A1', feedTitle: 'Flux A', userId: 'user-1', categoryNotify: true }),
      make({ id: 2, title: 'A2', feedTitle: 'Flux A', userId: 'user-1', categoryNotify: false }),
      make({ id: 3, title: 'B1', feedTitle: 'Flux B', userId: 'user-2', categoryNotify: true }),
    ])

    expect(map.size).toBe(2)
    expect(map.get('user-1')).toEqual([{ title: 'Flux A', body: 'A1', url: '/article/1' }])
    expect(map.get('user-2')).toEqual([{ title: 'Flux B', body: 'B1', url: '/article/3' }])
  })

  it('ignore les articles dont le userId est null', () => {
    const map = groupNotificationsByUser([
      make({ id: 1, userId: null, categoryNotify: true }),
      make({ id: 2, userId: 'user-1', categoryNotify: true }),
    ])

    expect(map.size).toBe(1)
    expect(map.get('user-1')).toEqual([{ title: 'Mon Flux', body: 'Titre', url: '/article/2' }])
  })
})
