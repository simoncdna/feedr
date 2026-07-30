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

export function relativeDate(date: Date, now: Date = new Date()): string {
  const minutes = Math.round((now.getTime() - date.getTime()) / 60_000)
  if (minutes < 1) return 'à l’instant'
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.round(hours / 24)
  if (days < 7) return `il y a ${days} j`
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}
