import { useState } from 'react'
import { youtubeEmbedUrl, youtubeThumbnailUrl } from '@/lib/youtube'

/**
 * Lecteur YouTube monté au clic, pas au chargement.
 *
 * Tant qu'on n'a pas cliqué, il n'y a qu'une image : aucun cookie YouTube, et
 * pas le mégaoctet de JavaScript du lecteur. Sur une PWA dont un relevé ramène
 * des dizaines d'articles, monter l'iframe à l'ouverture ferait payer ce coût
 * même aux vidéos qu'on ne regarde pas.
 *
 * `videoId` doit venir de `youtubeVideoId`, qui en valide la forme : c'est là que
 * se joue la garantie qu'aucune chaîne venue d'un flux tiers n'atteigne le `src`
 * de l'iframe.
 */
export function VideoEmbed({ videoId, title }: { videoId: string; title: string }) {
  const [playing, setPlaying] = useState(false)

  if (playing) {
    return (
      <iframe
        className="mt-6 aspect-video w-full rounded"
        src={youtubeEmbedUrl(videoId)}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Play video: ${title}`}
      className="group relative mt-6 block aspect-video w-full overflow-hidden rounded"
    >
      {/* `object-cover` parce que hqdefault est en 4/3 (480×360) : affichée telle
          quelle dans une boîte 16/9 elle aurait des bandes noires. maxresdefault
          est bien en 16/9 mais renvoie un 404 sur une partie des vidéos. */}
      <img
        src={youtubeThumbnailUrl(videoId)}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm transition-transform group-hover:scale-105">
          <svg viewBox="0 0 24 24" className="ml-0.5 h-6 w-6 text-white" fill="currentColor" aria-hidden="true">
            <path d="M6 4.5v15l14-7.5z" />
          </svg>
        </span>
      </span>
    </button>
  )
}
