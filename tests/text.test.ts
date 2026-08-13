import { describe, it, expect } from 'vitest'
import { articleDateLabel, dayLabel, publishedLabel, stripHtml, timeLabel } from '@/lib/text'

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

  // Cas réel relevé dans le fil : les TITRES ne passaient pas par stripHtml, et
  // The Verge publie ses apostrophes en entités numériques. « Let&#8217;s » se
  // lisait tel quel dans la liste et dans la vue détail.
  it('décode une apostrophe typographique dans un titre', () => {
    expect(stripHtml('Pixel 11 event live blog: Let&#8217;s watch')).toBe(
      'Pixel 11 event live blog: Let’s watch',
    )
  })

  // Un « < » isolé n'est pas une balise : le titre doit survivre intact.
  it('laisse un chevron isolé tranquille', () => {
    expect(stripHtml('Latency a < b in practice')).toBe('Latency a < b in practice')
  })
})

describe('timeLabel', () => {
  it('heure sur 24 h, toujours à deux chiffres', () => {
    expect(timeLabel(new Date(2026, 6, 29, 9, 41))).toBe('09:41')
    expect(timeLabel(new Date(2026, 6, 29, 0, 5))).toBe('00:05')
    expect(timeLabel(new Date(2026, 6, 29, 22, 5))).toBe('22:05')
  })
})

describe('dayLabel', () => {
  const now = new Date(2026, 6, 29, 12, 0)

  it('nomme le jour courant et le précédent', () => {
    expect(dayLabel(new Date(2026, 6, 29, 0, 5), now)).toBe('Today')
    expect(dayLabel(new Date(2026, 6, 28, 23, 55), now)).toBe('Yesterday')
  })

  // Un décalage de 24 h ne suffit pas : à 00 h 30, « il y a 25 heures »
  // appartient à avant-hier, pas à hier. La comparaison porte sur la date
  // civile, jamais sur une différence de millisecondes.
  it('compare des dates civiles, pas des durées', () => {
    const minuitPasse = new Date(2026, 6, 29, 0, 30)
    expect(dayLabel(new Date(2026, 6, 28, 23, 30), minuitPasse)).toBe('Yesterday')
    expect(dayLabel(new Date(2026, 6, 27, 23, 30), minuitPasse)).toBe('Jul 27')
  })

  it('franchit un changement de mois et d’année', () => {
    expect(dayLabel(new Date(2026, 0, 1, 8, 0), new Date(2026, 0, 2, 8, 0))).toBe('Yesterday')
    expect(dayLabel(new Date(2025, 11, 31, 8, 0), new Date(2026, 0, 1, 8, 0))).toBe('Yesterday')
    expect(dayLabel(new Date(2025, 11, 30, 8, 0), now)).toBe('Dec 30, 2025')
  })
})

describe('articleDateLabel', () => {
  const now = new Date(2026, 6, 29, 12, 0)

  // Le détail est lisible hors contexte : contrairement à une rangée du fil, il
  // n'a pas de séparateur de journée au-dessus de lui pour porter le jour.
  it('porte le jour ET l’heure', () => {
    expect(articleDateLabel(new Date(2026, 6, 29, 9, 41), now)).toBe('Today at 09:41')
    expect(articleDateLabel(new Date(2026, 6, 28, 22, 5), now)).toBe('Yesterday at 22:05')
    expect(articleDateLabel(new Date(2026, 6, 27, 22, 5), now)).toBe('Jul 27 at 22:05')
    expect(articleDateLabel(new Date(2025, 11, 31, 8, 0), now)).toBe('Dec 31, 2025 at 08:00')
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
