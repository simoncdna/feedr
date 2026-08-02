// Affiche l'URL réseau et son QR code, pour ouvrir l'app sur un vrai téléphone.
// Le plugin Vite ne le fait qu'en `vite dev` ; ce script sert au BUILD DE PROD,
// le seul testable sous Safari (en dev, les chunks HMR échouent et rien ne s'hydrate).
import { networkInterfaces } from 'node:os'
import { renderUnicodeCompact } from 'uqr'

const port = process.env.PORT ?? '3001'
const ip = Object.values(networkInterfaces())
  .flat()
  .find((i) => i && i.family === 'IPv4' && !i.internal)?.address

if (!ip) {
  console.log('Aucune interface réseau trouvée — le téléphone ne pourra pas joindre la machine.')
} else {
  const url = `http://${ip}:${port}/`
  console.log(`\n  Sur le téléphone :  ${url}\n`)
  console.log(renderUnicodeCompact(url).split('\n').map((l) => '  ' + l).join('\n'))
  console.log('\n  Rappel : en HTTP sur le réseau local, iOS considère le contexte comme non')
  console.log('  sécurisé — pas de service worker, donc pas de push, et pas de passkey.')
  console.log('  « Sur l\'écran d\'accueil » fonctionne quand même : c\'est ce qu\'il faut')
  console.log('  pour tester la barre de statut en mode standalone.\n')
}
