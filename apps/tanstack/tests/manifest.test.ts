import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Côté Next, le manifeste était produit par src/app/manifest.ts, typé par
// MetadataRoute.Manifest — une faute de frappe était attrapée au typecheck. En
// fichier statique, plus rien ne le vérifie : d'où ce test, qui fige les valeurs
// dont dépend l'installation de la PWA (l'app est déjà installée sur l'iPhone de
// Simon ; changer start_url ou display casserait l'installation existante).
const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'))

describe('manifest.webmanifest', () => {
  it('garde les valeurs d’installation de l’app Next', () => {
    expect(manifest).toEqual({
      name: 'Feedr',
      short_name: 'Feedr',
      description: 'Personal RSS reader',
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#ffffff',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    })
  })

  it('déclare une icône maskable, exigée pour l’écran d’accueil', () => {
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true)
  })
})
