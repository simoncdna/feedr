import { describe, it, expect } from 'vitest'
import { platformFeeds } from '@/lib/feed-discovery'

describe('platformFeeds', () => {
  it('dérive le flux d’une playlist YouTube', () => {
    expect(platformFeeds('https://www.youtube.com/playlist?list=PLabc123')).toEqual([
      { url: 'https://www.youtube.com/feeds/videos.xml?playlist_id=PLabc123', label: 'Videos' },
    ])
  })

  it('ignore une playlist sans identifiant', () => {
    expect(platformFeeds('https://www.youtube.com/playlist')).toEqual([])
  })

  // Les chaînes YouTube déclarent leur flux dans le <head> : les traiter ici
  // ferait doublon avec la couche 3 (mesuré le 2026-08-02, cf. la spec).
  it('ne touche pas aux chaînes YouTube, couvertes par l’autodiscovery', () => {
    expect(platformFeeds('https://www.youtube.com/@MKBHD')).toEqual([])
    expect(platformFeeds('https://www.youtube.com/channel/UCBJycsmduvYEL83R_U4JriQ')).toEqual([])
  })

  it('dérive le flux d’un subreddit, avec ou sans slash final', () => {
    const expected = [{ url: 'https://www.reddit.com/r/rss/.rss', label: 'Posts' }]
    expect(platformFeeds('https://www.reddit.com/r/rss')).toEqual(expected)
    expect(platformFeeds('https://www.reddit.com/r/rss/')).toEqual(expected)
  })

  it('ne dérive rien d’un fil de commentaires Reddit', () => {
    expect(platformFeeds('https://www.reddit.com/r/rss/comments/abc/titre/')).toEqual([])
  })

  it('propose releases et commits pour un dépôt GitHub', () => {
    expect(platformFeeds('https://github.com/facebook/react')).toEqual([
      { url: 'https://github.com/facebook/react/releases.atom', label: 'Releases' },
      { url: 'https://github.com/facebook/react/commits.atom', label: 'Commits' },
    ])
  })

  it('ne dérive rien d’une sous-page GitHub ni d’un profil', () => {
    expect(platformFeeds('https://github.com/facebook/react/issues')).toEqual([])
    expect(platformFeeds('https://github.com/facebook')).toEqual([])
  })

  it('ne dérive rien d’un site quelconque ni d’une chaîne invalide', () => {
    expect(platformFeeds('https://overreacted.io/')).toEqual([])
    expect(platformFeeds('pas-une-url')).toEqual([])
  })
})
