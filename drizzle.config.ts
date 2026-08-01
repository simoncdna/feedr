import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

config({ path: '.env.local' })

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL absente — .env.local manque ?')

// Endpoint Neon de PRODUCTION. Ce n'est pas un secret (un nom d'hôte), et le
// nommer ici est le seul moyen de rendre le garde-fou fiable : `vercel env pull`
// réécrit .env.local avec les valeurs de prod, et un `drizzle-kit push` lancé
// juste après toucherait la vraie base. Incident du 2026-07-31.
const ENDPOINT_DE_PROD = 'ep-curly-union-avv8f242'

// Pooled ou non, avec ou sans guillemets : on compare des hôtes normalisés.
function endpointHost(raw: string): string | null {
  try {
    return new URL(raw.trim().replace(/^["']|["']$/g, '')).hostname.replace('-pooler', '')
  } catch {
    return null
  }
}

const cible = endpointHost(url)
// Une URL illisible doit arrêter le processus, pas désarmer le contrôle qui suit.
if (!cible) throw new Error(`DATABASE_URL illisible, impossible de vérifier la cible : ${url}`)
if (cible.startsWith(ENDPOINT_DE_PROD)) {
  throw new Error(
    'DATABASE_URL pointe sur la base de production — drizzle-kit ne doit jamais la toucher.',
  )
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
})
