function isPrivateIPv4(ip: string): boolean {
  if (/^127\.|^10\.|^0\.|^169\.254\.|^192\.168\./.test(ip)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true
  return false
}

/**
 * Décode l'IPv4 encapsulée dans un littéral IPv6 "IPv4-mapped" (::ffff:a.b.c.d).
 * Le parseur WHATWG normalise systématiquement la forme pointée en deux groupes
 * hexadécimaux (ex. ::ffff:127.0.0.1 → ::ffff:7f00:1), donc les deux formes
 * doivent être gérées.
 */
function mappedIPv4(h: string): string | null {
  const dotted = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(h)
  if (dotted) return dotted[1]
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(h)
  if (!hex) return null
  const hi = parseInt(hex[1], 16)
  const lo = parseInt(hex[2], 16)
  if (Number.isNaN(hi) || Number.isNaN(lo)) return null
  return [(hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff].join('.')
}

/** Garde-fou SSRF : n'autorise que les URLs http(s) publiques (pas de loopback, LAN, lien-local, .internal). */
export function isSafeFeedUrl(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (h === 'localhost' || h === '::1' || h === '::' || h.endsWith('.local') || h.endsWith('.internal')) return false
  if (isPrivateIPv4(h)) return false
  if (/^fe80:/.test(h) || /^f[cd][0-9a-f]{2}:/.test(h)) return false
  const mapped = mappedIPv4(h)
  if (mapped && isPrivateIPv4(mapped)) return false
  return true
}
