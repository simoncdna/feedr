/** Garde-fou SSRF : n'autorise que les URLs http(s) publiques (pas de loopback, LAN, lien-local, .internal). */
export function isSafeFeedUrl(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  const h = u.hostname.toLowerCase()
  if (h === 'localhost' || h === '::1' || h.endsWith('.local') || h.endsWith('.internal')) return false
  if (/^127\.|^10\.|^0\.|^169\.254\.|^192\.168\./.test(h)) return false
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false
  return true
}
