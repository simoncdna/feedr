import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'
import { qrcode } from 'vite-plugin-qrcode'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// nitro() est ce qui rend le build déployable : sans lui, `vite build` produit un
// dist/ dont le server.js n'écoute pas, et Vercel répond 404 sur tout (constaté
// sur un preview). Nitro détecte l'hébergeur en CI et émet le format attendu —
// aucun preset à déclarer pour Vercel. En local, la sortie est .output/.
const config = defineConfig({
  server: { port: 3001 },
  resolve: { tsconfigPaths: true },
  // qrcode() affiche un QR de l'URL réseau au démarrage — utile pour ouvrir l'app
  // sur un vrai iPhone. Nécessite `--host` (voir le script `dev:phone`), sinon le
  // serveur n'écoute que sur localhost et il n'y a pas d'URL réseau à encoder.
  plugins: [devtools(), tailwindcss(), tanstackStart(), nitro(), viteReact(), qrcode()],
})

export default config
