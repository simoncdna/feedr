// Reprise unique : pose image_url et has_video sur les articles YouTube déjà en
// base. Le poller n'insère que les guid inconnus, donc corriger le parsing ne
// touche que les futurs articles — sans cette reprise, les vidéos déjà stockées
// resteraient sans vignette jusqu'à leur purge à 30 jours, et les bookmarkées,
// jamais purgées, indéfiniment.
//
// Aucun réseau : l'URL de vignette se dérive de l'id, lui-même déjà dans le lien
// stocké. La description n'est pas récupérable ainsi — elle ne vit que dans le
// flux, qui ne garde que les quinze dernières entrées d'une chaîne.
//
// Importe `youtubeVideoId` au lieu de porter sa propre regex SQL : deux
// définitions de « une URL de vidéo YouTube » finiraient par diverger. D'où le
// `.ts` et le retrait de types par Node, là où les autres scripts sont en .mjs.
//
//   node --experimental-strip-types --env-file=.env.local \
//     scripts/backfill-youtube-thumbnails.ts            # aperçu, n'écrit rien
//   node --experimental-strip-types --env-file=.env.local \
//     scripts/backfill-youtube-thumbnails.ts --apply    # écrit
//
// La base visée est celle de DATABASE_URL : vérifier l'endpoint avant --apply.
import { neon } from '@neondatabase/serverless'
import { youtubeThumbnailUrl, youtubeVideoId } from '../src/lib/youtube.ts'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL absente.')
  process.exit(1)
}
const sql = neon(url)
const apply = process.argv.includes('--apply')

console.log(`base : ${new URL(url).hostname}`)

// Seules les lignes incomplètes : une ligne déjà pourvue d'une vignette et
// marquée vidéo n'a rien à gagner d'une réécriture.
const candidats = (await sql`
  SELECT id, link, title, image_url, has_video
  FROM articles
  WHERE image_url IS NULL OR has_video = false
`) as Array<{ id: number; link: string; title: string; image_url: string | null; has_video: boolean }>

const aReprendre = candidats.flatMap((a) => {
  const videoId = youtubeVideoId(a.link)
  if (!videoId) return []
  const imageUrl = a.image_url ?? youtubeThumbnailUrl(videoId)
  if (imageUrl === a.image_url && a.has_video) return []
  return [{ id: a.id, title: a.title, imageUrl }]
})

console.log(`${candidats.length} lignes incomplètes, ${aReprendre.length} vidéos YouTube à reprendre`)
for (const a of aReprendre.slice(0, 10)) {
  console.log(`  #${a.id} ${a.title.slice(0, 45)} → ${a.imageUrl}`)
}
if (aReprendre.length > 10) console.log(`  … et ${aReprendre.length - 10} autres`)

if (!apply) {
  console.log('\nAperçu seulement. Relancer avec --apply pour écrire.')
  process.exit(0)
}

for (const a of aReprendre) {
  await sql`UPDATE articles SET image_url = ${a.imageUrl}, has_video = true WHERE id = ${a.id}`
}
console.log(`\n${aReprendre.length} lignes mises à jour.`)
