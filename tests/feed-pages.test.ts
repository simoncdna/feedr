import { describe, it, expect } from 'vitest'
import {
  flattenPages,
  orderWithHero,
  patchRow,
  pickHero,
  type InfiniteFeed,
} from '@/lib/feed-pages'

type Ligne = { id: number; imageUrl: string | null; bookmarked: boolean }

function page(rows: Ligne[], suivant: number | null) {
  return {
    rows,
    nextCursor: suivant === null ? null : { publishedAt: new Date(0), id: suivant },
  }
}

function feed(...pages: Array<ReturnType<typeof page>>): InfiniteFeed<Ligne> {
  return { pages, pageParams: pages.map(() => null) }
}

const l = (id: number, imageUrl: string | null = null, bookmarked = false): Ligne => ({
  id,
  imageUrl,
  bookmarked,
})

describe('flattenPages', () => {
  it('concatène les pages dans l’ordre', () => {
    const data = feed(page([l(1), l(2)], 2), page([l(3)], null))
    expect(flattenPages(data).map((r) => r.id)).toEqual([1, 2, 3])
  })

  it('rend un tableau vide sans données', () => {
    expect(flattenPages(undefined)).toEqual([])
    expect(flattenPages(feed())).toEqual([])
  })
})

describe('patchRow', () => {
  // C'est ce patch qui rend la bascule de bookmark immédiate au swipe. S'il ne
  // trouve pas la ligne, rien ne casse visiblement : l'UI attend simplement
  // l'aller-retour serveur, et le gain disparaît sans avertissement.
  it('modifie la ligne visée, dans quelque page qu’elle soit', () => {
    const data = feed(page([l(1), l(2)], 2), page([l(3), l(4)], null))
    const out = patchRow(data, 4, { bookmarked: true })
    expect(flattenPages(out).map((r) => [r.id, r.bookmarked])).toEqual([
      [1, false],
      [2, false],
      [3, false],
      [4, true],
    ])
  })

  it('ne touche qu’une seule ligne', () => {
    const data = feed(page([l(1), l(2), l(3)], null))
    const out = patchRow(data, 2, { bookmarked: true })
    expect(flattenPages(out).filter((r) => r.bookmarked).map((r) => r.id)).toEqual([2])
  })

  // React Query partage l'objet en cache : le muter contournerait la
  // réconciliation et l'UI pourrait ne pas se redessiner.
  it('ne mute pas la donnée d’origine', () => {
    const data = feed(page([l(1)], null))
    const avant = JSON.stringify(data)
    patchRow(data, 1, { bookmarked: true })
    expect(JSON.stringify(data)).toBe(avant)
  })

  it('rend une donnée équivalente quand l’id est absent', () => {
    const data = feed(page([l(1)], null))
    // Variable intermédiaire : imbriqué directement dans `flattenPages`,
    // TypeScript infère `Row` depuis la contrainte et non depuis `data`.
    const out = patchRow(data, 999, { bookmarked: true })
    expect(flattenPages(out)).toEqual([l(1)])
  })

  it('supporte l’absence de données sans lever', () => {
    // Type explicite : sans données, `Row` n'est pas inférable depuis l'argument.
    expect(patchRow<Ligne>(undefined, 1, { bookmarked: true })).toBeUndefined()
  })

  it('préserve les curseurs des pages', () => {
    const data = feed(page([l(1)], 7), page([l(2)], null))
    const out = patchRow(data, 1, { bookmarked: true })!
    expect(out.pages[0].nextCursor?.id).toBe(7)
    expect(out.pages[1].nextCursor).toBeNull()
  })
})

describe('pickHero', () => {
  it('prend la première ligne pourvue d’une image', () => {
    expect(pickHero([l(1), l(2, 'https://ex.fr/a.jpg'), l(3, 'https://ex.fr/b.jpg')])?.id).toBe(2)
  })

  it('replie sur la première ligne quand aucune n’a d’image', () => {
    expect(pickHero([l(1), l(2)])?.id).toBe(1)
  })

  it('rend undefined sur une liste vide', () => {
    expect(pickHero([])).toBeUndefined()
  })
})

describe('orderWithHero', () => {
  it('met le héros en tête sans le dupliquer', () => {
    const rows = [l(1), l(2, 'https://ex.fr/a.jpg'), l(3)]
    expect(orderWithHero(rows, rows[1]).map((r) => r.id)).toEqual([2, 1, 3])
  })

  it('préserve l’ordre du reste', () => {
    const rows = [l(1), l(2), l(3), l(4, 'https://ex.fr/a.jpg')]
    expect(orderWithHero(rows, rows[3]).map((r) => r.id)).toEqual([4, 1, 2, 3])
  })

  it('rend la liste inchangée sans héros', () => {
    const rows = [l(1), l(2)]
    expect(orderWithHero(rows, undefined)).toEqual(rows)
  })

  // Le héros est choisi sur la première page et reste figé. Les pages suivantes
  // s'ajoutent derrière lui : sans ça, le fil se réordonnerait en pleine lecture.
  it('garde le héros en tête quand la liste s’allonge', () => {
    const premiere = [l(1), l(2, 'https://ex.fr/a.jpg')]
    const hero = pickHero(premiere)
    const tout = [...premiere, l(3, 'https://ex.fr/plus-recent.jpg'), l(4)]
    expect(orderWithHero(tout, hero).map((r) => r.id)).toEqual([2, 1, 3, 4])
  })
})
