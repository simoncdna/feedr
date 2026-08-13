import { describe, it, expect } from 'vitest'
import { youtubeEmbedUrl, youtubeThumbnailUrl, youtubeVideoId } from '@/lib/youtube'

const ID = 'o4SSoURPODY'

describe('youtubeVideoId', () => {
  it('lit l’id des quatre formes d’URL', () => {
    expect(youtubeVideoId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID)
    expect(youtubeVideoId(`https://youtu.be/${ID}`)).toBe(ID)
    expect(youtubeVideoId(`https://www.youtube.com/embed/${ID}`)).toBe(ID)
    expect(youtubeVideoId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID)
  })

  it('ignore les paramètres qui accompagnent le lien', () => {
    expect(youtubeVideoId(`https://www.youtube.com/watch?v=${ID}&t=42s&list=PLabc`)).toBe(ID)
    expect(youtubeVideoId(`https://youtu.be/${ID}?t=42`)).toBe(ID)
  })

  it('accepte les hôtes YouTube sans www et youtube-nocookie', () => {
    expect(youtubeVideoId(`https://youtube.com/watch?v=${ID}`)).toBe(ID)
    expect(youtubeVideoId(`https://m.youtube.com/watch?v=${ID}`)).toBe(ID)
    expect(youtubeVideoId(`https://www.youtube-nocookie.com/embed/${ID}`)).toBe(ID)
  })

  // La validation de forme est la frontière de sécurité : l'id finit interpolé
  // dans l'URL d'une iframe. Un id accepté sans contrôle y ouvrirait une brèche.
  it('rejette un id qui n’a pas la forme attendue', () => {
    expect(youtubeVideoId('https://www.youtube.com/watch?v=tropcourt')).toBeNull()
    expect(youtubeVideoId('https://www.youtube.com/watch?v=beaucouptroplong123')).toBeNull()
    expect(youtubeVideoId('https://www.youtube.com/watch?v=abc/../../etc')).toBeNull()
    expect(youtubeVideoId('https://www.youtube.com/watch?v=abcdefghij"onload')).toBeNull()
  })

  it('rejette ce qui n’est pas une vidéo YouTube', () => {
    expect(youtubeVideoId('https://www.theverge.com/article/123')).toBeNull()
    expect(youtubeVideoId(`https://notyoutube.com/watch?v=${ID}`)).toBeNull()
    // Un hôte qui contient « youtube.com » sans en être : le test doit porter sur
    // l'hôte entier, pas sur une inclusion de chaîne.
    expect(youtubeVideoId(`https://youtube.com.evil.tld/watch?v=${ID}`)).toBeNull()
    expect(youtubeVideoId('https://www.youtube.com/@MKBHD')).toBeNull()
    expect(youtubeVideoId('https://www.youtube.com/watch')).toBeNull()
  })

  it('rejette une URL illisible sans lever', () => {
    expect(youtubeVideoId('')).toBeNull()
    expect(youtubeVideoId('pas une url')).toBeNull()
    expect(youtubeVideoId('javascript:alert(1)')).toBeNull()
  })
})

describe('youtubeThumbnailUrl', () => {
  it('construit l’URL de vignette', () => {
    expect(youtubeThumbnailUrl(ID)).toBe(`https://i.ytimg.com/vi/${ID}/hqdefault.jpg`)
  })
})

describe('youtubeEmbedUrl', () => {
  it('construit une URL d’embed sans cookie', () => {
    expect(youtubeEmbedUrl(ID)).toBe(`https://www.youtube-nocookie.com/embed/${ID}?playsinline=1`)
  })

  // L'autoplay a été retiré : Safari sur iPhone le refuse de toute façon, et là où
  // il est accepté il ferait démarrer une vidéo que personne n'a demandée.
  it('ne demande pas l’autoplay', () => {
    expect(youtubeEmbedUrl(ID)).not.toContain('autoplay')
  })
})
