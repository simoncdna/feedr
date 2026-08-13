const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity[0] === '#') {
      const isHex = entity[1] === 'x' || entity[1] === 'X'
      const codePoint = isHex ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10)
      if (Number.isNaN(codePoint)) return match
      try {
        return String.fromCodePoint(codePoint)
      } catch {
        return match
      }
    }
    return NAMED_ENTITIES[entity] ?? match
  })
}

export function stripHtml(html: string): string {
  const withoutTags = html.replace(/<[^>]*>/g, ' ')
  const decoded = decodeEntities(withoutTags)
  return decoded.replace(/\s+/g, ' ').trim()
}

export function timeLabel(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/**
 * Le jour d'une date, tel qu'il s'écrit au-dessus d'un groupe de rangées.
 *
 * Remplace l'ancien `relativeDate` (« 3h ago », « 2d ago »), qui ne servait que
 * la vue détail et donnait deux écritures différentes de la même date selon
 * l'écran — « 06:09 » dans le fil, « 9H AGO » dans le détail.
 *
 * La comparaison porte sur la date CIVILE et non sur une différence de durée :
 * à 00 h 30, « il y a 25 heures » tombe avant-hier, pas hier.
 */
export function dayLabel(date: Date, now: Date = new Date()): string {
  const jours = (d: Date) => Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86_400_000)
  const ecart = jours(now) - jours(date)
  if (ecart === 0) return 'Today'
  if (ecart === 1) return 'Yesterday'
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  })
}

/**
 * La date d'un article dans sa vue détail : jour ET heure. Le détail s'ouvre
 * aussi depuis une notification push, sans le fil autour ni le séparateur de
 * journée qui porte le jour dans une liste — il doit se lire seul.
 */
export function articleDateLabel(date: Date, now: Date = new Date()): string {
  return `${dayLabel(date, now)} at ${timeLabel(date)}`
}

export function publishedLabel(date: Date, now: Date = new Date()): string {
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  if (sameDay) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  })
}
