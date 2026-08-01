import { existsSync, readFileSync } from 'node:fs'
import { config, parse } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

// À lancer depuis apps/tanstack : le .env.local de ce dossier pointe sur la base
// de développement, celui de la racine sur la prod.
config({ path: '.env.local' })

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL absente — apps/tanstack/.env.local manque ?')

// Deux chaînes peuvent désigner la même base (pooled ou non, guillemets ou pas) :
// on compare des hôtes normalisés, pas des chaînes brutes.
function endpointHost(raw: string | undefined): string | null {
  if (!raw) return null
  try {
    return new URL(raw.trim().replace(/^["']|["']$/g, '')).hostname.replace('-pooler', '')
  } catch {
    return null
  }
}

const target = endpointHost(url)
// Une URL illisible doit arrêter le processus, pas désarmer le contrôle qui suit.
if (!target) throw new Error(`DATABASE_URL illisible, impossible de vérifier la cible : ${url}`)

// Le schéma de prod ne doit pas bouger pendant la migration : on refuse de
// démarrer si la cible est la même base que celle du .env.local de la racine.
const rootEnv = '../../.env.local'
if (existsSync(rootEnv)) {
  const prod = endpointHost(parse(readFileSync(rootEnv)).DATABASE_URL)
  if (prod && prod === target) {
    throw new Error(
      'DATABASE_URL pointe sur la base de production — drizzle-kit ne doit jamais la toucher.',
    )
  }
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
})
