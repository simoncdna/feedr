import { describe, it, expect } from 'vitest'
import { groupNotificationsByUser, RECAP_FEED_LIMIT, type InsertedArticle } from '@/lib/notify'

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

  it('un seul article garde le détail : flux en titre, article en body, lien direct', () => {
    const map = groupNotificationsByUser([make({ id: 7, title: 'Big news', feedTitle: 'HN' })])
    expect(map.get('user-1')).toEqual([{ title: 'HN', body: 'Big news', url: '/article/7' }])
  })

  it('ignore les articles dont le userId est null', () => {
    const map = groupNotificationsByUser([
      make({ id: 1, userId: null, categoryNotify: true }),
      make({ id: 2, userId: 'user-1', categoryNotify: true }),
    ])

    expect(map.size).toBe(1)
    expect(map.get('user-1')).toEqual([{ title: 'Mon Flux', body: 'Titre', url: '/article/2' }])
  })

  it('ne renvoie aucune entrée quand rien n’est notifiable', () => {
    const map = groupNotificationsByUser([
      make({ id: 1, categoryNotify: false }),
      make({ id: 2, userId: null }),
    ])
    expect(map.size).toBe(0)
  })

  describe('récapitulatif', () => {
    it('plusieurs articles = UNE seule notification, pas une par article', () => {
      const map = groupNotificationsByUser([
        make({ id: 1, title: 'A1', feedTitle: 'HN' }),
        make({ id: 2, title: 'A2', feedTitle: 'HN' }),
        make({ id: 3, title: 'A3', feedTitle: 'The Verge' }),
      ])

      expect(map.get('user-1')).toHaveLength(1)
      expect(map.get('user-1')![0]).toEqual({
        title: '3 new articles',
        body: 'HN · The Verge',
        url: '/',
      })
    })

    it('dédoublonne les noms de flux et garde l’ordre d’apparition', () => {
      const map = groupNotificationsByUser([
        make({ id: 1, feedTitle: 'Le Monde' }),
        make({ id: 2, feedTitle: 'HN' }),
        make({ id: 3, feedTitle: 'Le Monde' }),
      ])
      expect(map.get('user-1')![0].body).toBe('Le Monde · HN')
    })

    it('plafonne la liste des flux et compte le reste', () => {
      const articles = ['A', 'B', 'C', 'D', 'E'].map((feedTitle, i) =>
        make({ id: i + 1, feedTitle }),
      )
      const payload = groupNotificationsByUser(articles).get('user-1')![0]

      expect(RECAP_FEED_LIMIT).toBe(3)
      expect(payload.title).toBe('5 new articles')
      expect(payload.body).toBe('A · B · C +2')
    })

    it('récapitule par utilisateur, sans mélanger les flux', () => {
      const map = groupNotificationsByUser([
        make({ id: 1, title: 'A1', feedTitle: 'Flux A', userId: 'user-1' }),
        make({ id: 2, title: 'A2', feedTitle: 'Flux A', userId: 'user-1' }),
        make({ id: 3, title: 'B1', feedTitle: 'Flux B', userId: 'user-2' }),
      ])

      expect(map.size).toBe(2)
      // user-2 n'a qu'un article : il garde le lien direct vers l'article.
      expect(map.get('user-2')).toEqual([{ title: 'Flux B', body: 'B1', url: '/article/3' }])
      expect(map.get('user-1')).toEqual([{
        title: '2 new articles', body: 'Flux A', url: '/',
      }])
    })

    it('ne compte pas les articles non notifiables dans le total', () => {
      const map = groupNotificationsByUser([
        make({ id: 1, feedTitle: 'HN', categoryNotify: true }),
        make({ id: 2, feedTitle: 'HN', categoryNotify: true }),
        make({ id: 3, feedTitle: 'Muet', categoryNotify: false }),
      ])
      expect(map.get('user-1')![0].title).toBe('2 new articles')
      expect(map.get('user-1')![0].body).toBe('HN')
    })
  })
})
