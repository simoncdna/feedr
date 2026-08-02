import { describe, it, expect } from 'vitest'
import { extractFeedLinks, platformFeeds } from '@/lib/feed-discovery'

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

  it('propose releases et commits pour un dépôt GitHub avec un slash final', () => {
    expect(platformFeeds('https://github.com/facebook/react/')).toEqual([
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

describe('extractFeedLinks', () => {
  const base = 'https://exemple.fr/blog/'

  it('absolutise un href relatif et garde un href absolu', () => {
    const html = `
      <link rel="alternate" type="application/rss+xml" href="/rss.xml">
      <link rel="alternate" type="application/atom+xml" href="https://ailleurs.fr/atom.xml">
    `
    expect(extractFeedLinks(html, base)).toEqual([
      { url: 'https://exemple.fr/rss.xml', label: '/rss.xml' },
      { url: 'https://ailleurs.fr/atom.xml', label: '/atom.xml' },
    ])
  })

  it('absolutise un href protocol-relative', () => {
    const html = `<link rel="alternate" type="application/rss+xml" href="//cdn.fr/f.xml">`
    expect(extractFeedLinks(html, base)).toEqual([{ url: 'https://cdn.fr/f.xml', label: '/f.xml' }])
  })

  // Mastodon écrit href avant rel, YouTube écrit rel avant href : une regex qui
  // suppose un ordre rate un cas sur deux (mesuré le 2026-08-02, cf. la spec).
  it('accepte les attributs dans n’importe quel ordre et en quotes simples', () => {
    const html = `<link href='/a.xml' rel='alternate' type='application/rss+xml' title='Blog'>`
    expect(extractFeedLinks(html, base)).toEqual([
      { url: 'https://exemple.fr/a.xml', label: 'Blog' },
    ])
  })

  it('prend le title comme libellé, sinon le chemin', () => {
    const html = `
      <link rel="alternate" type="application/rss+xml" href="/a.xml" title="Articles">
      <link rel="alternate" type="application/rss+xml" href="/b.xml">
    `
    expect(extractFeedLinks(html, base).map((c) => c.label)).toEqual(['Articles', '/b.xml'])
  })

  it('décode les esperluettes encodées dans le href', () => {
    const html = `<link rel="alternate" type="application/rss+xml" href="/f?a=1&amp;b=2">`
    const candidates = extractFeedLinks(html, base)
    expect(candidates).toHaveLength(1)
    expect(candidates[0].url).toBe('https://exemple.fr/f?a=1&b=2')
  })

  it('relègue les flux de commentaires en fin de liste', () => {
    const html = `
      <link rel="alternate" type="application/rss+xml" href="/comments/feed" title="Comments Feed">
      <link rel="alternate" type="application/rss+xml" href="/feed" title="Articles">
    `
    expect(extractFeedLinks(html, base).map((c) => c.label)).toEqual(['Articles', 'Comments Feed'])
  })

  it('déduplique par URL', () => {
    const html = `
      <link rel="alternate" type="application/rss+xml" href="/f.xml">
      <link rel="alternate" type="application/rss+xml" href="https://exemple.fr/f.xml">
    `
    expect(extractFeedLinks(html, base)).toHaveLength(1)
  })

  it('ignore les balises qui ne sont pas des flux', () => {
    const html = `
      <link rel="alternate icon" type="image/png" href="/favicon.png">
      <link rel="alternate" media="handheld" href="https://m.exemple.fr/">
      <link rel="stylesheet" type="text/css" href="/style.css">
      <link rel="alternate" type="application/activity+json" href="/users/x">
    `
    expect(extractFeedLinks(html, base)).toEqual([])
  })

  it('rejette les candidats qui ne passent pas le garde-fou SSRF', () => {
    const html = `<link rel="alternate" type="application/rss+xml" href="http://localhost/feed">`
    expect(extractFeedLinks(html, base)).toEqual([])
  })

  it('ne trouve rien dans une page sans balise', () => {
    expect(extractFeedLinks('<html><body>rien</body></html>', base)).toEqual([])
  })

  it('ignore un <link> mis en commentaire', () => {
    const html = `
      <!-- <link rel="alternate" type="application/rss+xml" href="/mort.xml" title="Mort"> -->
      <link rel="alternate" type="application/rss+xml" href="/vivant.xml" title="Vivant">
    `
    expect(extractFeedLinks(html, base)).toEqual([{ url: 'https://exemple.fr/vivant.xml', label: 'Vivant' }])
  })

  it('ignore un data-href au profit du vrai href', () => {
    const html = `<link rel="alternate" type="application/rss+xml" data-href="/tracker.xml" href="/vrai.xml">`
    expect(extractFeedLinks(html, base)).toEqual([{ url: 'https://exemple.fr/vrai.xml', label: '/vrai.xml' }])
  })

  it('étiquette par le nom d’hôte un flux sans title à la racine', () => {
    const html = `<link rel="alternate" type="application/rss+xml" href="https://exemple.fr/">`
    expect(extractFeedLinks(html, base)).toEqual([{ url: 'https://exemple.fr/', label: 'exemple.fr' }])
  })

  it('accepte un type avec paramètre, comme "application/rss+xml; charset=utf-8"', () => {
    const html = `<link rel="alternate" type="application/rss+xml; charset=utf-8" href="/f.xml">`
    expect(extractFeedLinks(html, base)).toEqual([{ url: 'https://exemple.fr/f.xml', label: '/f.xml' }])
  })

  it('accepte des valeurs d’attributs sans quotes', () => {
    const html = `<link rel=alternate type=application/rss+xml href=/nu.xml>`
    expect(extractFeedLinks(html, base)).toEqual([{ url: 'https://exemple.fr/nu.xml', label: '/nu.xml' }])
  })

  it('lit une balise dont les attributs sont répartis sur plusieurs lignes', () => {
    const html = `
      <link
        rel="alternate"
        type="application/rss+xml"
        href="/multi.xml"
        title="Multi-lignes"
      >
    `
    expect(extractFeedLinks(html, base)).toEqual([
      { url: 'https://exemple.fr/multi.xml', label: 'Multi-lignes' },
    ])
  })
})
