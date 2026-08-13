import { youtubeEmbedUrl } from '@/lib/youtube'

/**
 * Lecteur YouTube d'un article, monté à l'ouverture.
 *
 * Une version antérieure n'affichait qu'une vignette et ne montait l'iframe qu'au
 * clic, pour ne rien charger de YouTube tant qu'on ne regardait pas. Ça coûtait un
 * clic de plus sur iPhone : l'autoplay demandé à l'iframe naissante est refusé par
 * Safari, qui exige un geste fait dans l'iframe elle-même. Le compromis a été
 * tranché en faveur du clic unique. Conséquence assumée : ouvrir un article vidéo
 * charge le lecteur YouTube, même si on ne le lance pas.
 *
 * `videoId` doit venir de `youtubeVideoId`, qui en valide la forme : c'est là que
 * se joue la garantie qu'aucune chaîne venue d'un flux tiers n'atteigne le `src`
 * de l'iframe.
 */
export function VideoEmbed({ videoId, title }: { videoId: string; title: string }) {
  return (
    <iframe
      className="mt-6 aspect-video w-full rounded"
      src={youtubeEmbedUrl(videoId)}
      title={title}
      allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  )
}
