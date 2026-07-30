import { describe, it, expect } from 'vitest'
import { stripHtml, relativeDate } from '@/lib/text'

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
    expect(relativeDate(new Date('2026-07-29T11:55:00Z'), now)).toBe('5 min ago')
    expect(relativeDate(new Date('2026-07-29T09:00:00Z'), now)).toBe('3 h ago')
    expect(relativeDate(new Date('2026-07-27T12:00:00Z'), now)).toBe('2 d ago')
  })
})
