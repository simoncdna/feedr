import { describe, expect, it } from 'vitest'
import { feedSearchSchema } from '@/routes/-search'

describe('feedSearchSchema', () => {
  it('accepte des identifiants numériques valides', () => {
    expect(feedSearchSchema.parse({ category: 3, article: 42 }))
      .toEqual({ category: 3, article: 42 })
  })

  it('accepte des chaînes numériques venant de l\'URL', () => {
    expect(feedSearchSchema.parse({ category: '3' })).toEqual({ category: 3 })
  })

  it('écarte les valeurs non numériques au lieu de produire NaN', () => {
    expect(feedSearchSchema.parse({ category: 'abc' })).toEqual({})
  })

  it('écarte les identifiants non entiers ou négatifs', () => {
    expect(feedSearchSchema.parse({ article: 1.5 })).toEqual({})
    expect(feedSearchSchema.parse({ article: -2 })).toEqual({})
  })

  it('accepte un objet vide', () => {
    expect(feedSearchSchema.parse({})).toEqual({})
  })
})
