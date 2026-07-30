import { describe, it, expect } from 'vitest'
import { stripHtml, relativeDate, publishedLabel } from '@/lib/text'

describe('stripHtml', () => {
  it('retire les balises et normalise les espaces', () => {
    expect(stripHtml('<p>Un  <b>texte</b></p>\n<p>riche</p>')).toBe('Un texte riche')
  })

  it('décode les entités HTML courantes', () => {
    expect(stripHtml('<p>Tom &amp; Jerry &lt;3&gt; &quot;quotes&quot; &#39;apo&#8217; a&nbsp;b</p>')).toBe('Tom & Jerry <3> "quotes" \'apo’ a b')
  })

  it('ne sur-décode pas une entité déjà échappée', () => {
    expect(stripHtml('&amp;lt;')).toBe('&lt;')
  })
})

describe('relativeDate', () => {
  const now = new Date('2026-07-29T12:00:00Z')
  it('minutes / heures / jours', () => {
    expect(relativeDate(new Date('2026-07-29T11:55:00Z'), now)).toBe('5m ago')
    expect(relativeDate(new Date('2026-07-29T09:00:00Z'), now)).toBe('3h ago')
    expect(relativeDate(new Date('2026-07-27T12:00:00Z'), now)).toBe('2d ago')
  })
})

describe('publishedLabel', () => {
  const now = new Date(2026, 6, 29, 12, 0)
  it("heure si publié aujourd'hui", () => {
    expect(publishedLabel(new Date(2026, 6, 29, 9, 41), now)).toBe('09:41')
  })
  it('date si publié avant aujourd’hui', () => {
    expect(publishedLabel(new Date(2026, 6, 27, 22, 5), now)).toBe('Jul 27')
  })
  it('date avec année si autre année', () => {
    expect(publishedLabel(new Date(2025, 11, 31, 8, 0), now)).toBe('Dec 31, 2025')
  })
})
