import { describe, it, expect } from 'vitest'
import { stripHtml, relativeDate } from '@/lib/text'

describe('stripHtml', () => {
  it('retire les balises et normalise les espaces', () => {
    expect(stripHtml('<p>Un  <b>texte</b></p>\n<p>riche</p>')).toBe('Un texte riche')
  })
})

describe('relativeDate', () => {
  const now = new Date('2026-07-29T12:00:00Z')
  it('minutes / heures / jours', () => {
    expect(relativeDate(new Date('2026-07-29T11:55:00Z'), now)).toBe('il y a 5 min')
    expect(relativeDate(new Date('2026-07-29T09:00:00Z'), now)).toBe('il y a 3 h')
    expect(relativeDate(new Date('2026-07-27T12:00:00Z'), now)).toBe('il y a 2 j')
  })
})
