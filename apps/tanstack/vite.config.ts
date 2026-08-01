import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// nitro() est ce qui rend le build déployable : sans lui, `vite build` produit un
// dist/ dont le server.js n'écoute pas, et Vercel répond 404 sur tout (constaté
// sur un preview). Nitro détecte l'hébergeur en CI et émet le format attendu —
// aucun preset à déclarer pour Vercel. En local, la sortie est .output/.
const config = defineConfig({
  server: { port: 3001 },
  resolve: { tsconfigPaths: true },
  plugins: [devtools(), tailwindcss(), tanstackStart(), nitro(), viteReact()],
})

export default config
