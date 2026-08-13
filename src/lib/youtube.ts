// Hôtes que YouTube sert lui-même. Comparés en entier, jamais par inclusion de
// chaîne : `youtube.com.evil.tld` contient « youtube.com » sans en être.
const HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
  'www.youtu.be',
])

// Onze caractères de l'alphabet base64url : c'est la forme d'un id de vidéo.
const ID = /^[A-Za-z0-9_-]{11}$/

// `/embed/<id>`, `/shorts/<id>`, et la forme courte `youtu.be/<id>`.
const CHEMIN = /^\/(?:embed|shorts|v)\/([^/?#]+)/

/**
 * Lit l'id de vidéo d'une URL YouTube, ou rend `null`.
 *
 * La validation de forme n'est pas cosmétique : l'id repart dans l'URL d'une
 * iframe (`youtubeEmbedUrl`), donc c'est ici — et seulement ici — que se joue la
 * garantie qu'aucune chaîne arbitraire venue d'un flux tiers n'atteint cet
 * attribut. Tout ce qui n'a pas exactement la forme attendue est refusé.
 */
export function youtubeVideoId(url: string): string | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  const host = u.hostname.toLowerCase()
  if (!HOSTS.has(host)) return null

  const candidat = host.endsWith('youtu.be')
    ? u.pathname.slice(1).split('/')[0]
    : (u.searchParams.get('v') ?? CHEMIN.exec(u.pathname)?.[1] ?? '')

  return ID.test(candidat) ? candidat : null
}

/**
 * Vignette de la vidéo. `hqdefault` plutôt que `maxresdefault` : elle existe
 * pour toutes les vidéos, là où `maxresdefault` renvoie un 404 sur une partie
 * d'entre elles. Elle est en 4/3 (480×360), donc à recadrer côté affichage.
 */
export function youtubeThumbnailUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
}

/**
 * Lecteur sur le domaine sans cookie.
 *
 * Sans `autoplay`, délibérément. Une version antérieure montait l'iframe au clic
 * sur une vignette et demandait l'autoplay : Chrome de bureau obéissait, mais
 * Safari sur iPhone refuse de lancer une vidéo avec son sans geste fait *dans*
 * l'iframe — le clic sur la vignette avait lieu avant qu'elle existe. Résultat :
 * deux clics sur mobile, un seul sur desktop. Le lecteur est donc désormais monté
 * directement et sans autoplay : le seul clic est celui de YouTube, le même
 * partout, et aucune vidéo ne démarre sans qu'on l'ait demandée.
 *
 * `playsinline` pour qu'iOS joue dans la page plutôt que de basculer en plein
 * écran.
 */
export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?playsinline=1`
}
