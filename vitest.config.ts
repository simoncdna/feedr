import { configDefaults, defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    // `apps/` héberge l'app TanStack, projet autonome avec sa propre suite. Sans
    // cette exclusion, ses tests seraient aussi ramassés ici et résolus contre
    // l'alias `@` de la racine — ils testeraient donc le code Next deux fois.
    exclude: [...configDefaults.exclude, 'apps/**'],
  },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
})
