import { describe, it, expect } from 'vitest'
import { isSafeFeedUrl } from '@/lib/url'

describe('isSafeFeedUrl', () => {
  it('accepte les URLs http(s) publiques', () => {
    expect(isSafeFeedUrl('https://example.com/feed.xml')).toBe(true)
    expect(isSafeFeedUrl('http://blog.fr/rss')).toBe(true)
  })

  it('rejette les schémas non http(s)', () => {
    expect(isSafeFeedUrl('ftp://example.com/feed.xml')).toBe(false)
    expect(isSafeFeedUrl('javascript:alert(1)')).toBe(false)
  })

  it('rejette les chaînes qui ne sont pas des URLs', () => {
    expect(isSafeFeedUrl('not-a-url')).toBe(false)
  })

  it('rejette localhost et le loopback', () => {
    expect(isSafeFeedUrl('http://localhost:3000/x')).toBe(false)
    expect(isSafeFeedUrl('http://127.0.0.1/x')).toBe(false)
  })

  it('rejette les plages IP privées/réservées', () => {
    expect(isSafeFeedUrl('http://10.0.0.5/x')).toBe(false)
    expect(isSafeFeedUrl('http://172.16.0.1/x')).toBe(false)
    expect(isSafeFeedUrl('http://192.168.1.10/x')).toBe(false)
  })

  it('rejette le lien-local / métadonnées cloud', () => {
    expect(isSafeFeedUrl('http://169.254.169.254/latest/meta-data')).toBe(false)
  })

  it('rejette les domaines internes', () => {
    expect(isSafeFeedUrl('http://foo.internal/x')).toBe(false)
  })
})
