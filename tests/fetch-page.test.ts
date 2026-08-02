import { describe, expect, it } from 'vitest'
import { readCapped } from '@/lib/fetch-page'

// Duplique le plafond privé de fetch-page.ts (2 * 1024 * 1024) : ce fichier ne
// l'importe pas, mais un test doit connaître l'ordre de grandeur attendu pour
// vérifier qu'on s'arrête bien avant la fin d'un flux sans fin.
const MAX_PAGE_CHARS = 2 * 1024 * 1024

function chunk(str: string, size: number): Uint8Array[] {
  const bytes = new TextEncoder().encode(str)
  const chunks: Uint8Array[] = []
  for (let i = 0; i < bytes.length; i += size) chunks.push(bytes.slice(i, i + size))
  return chunks
}

/** Encode en ISO-8859-1 : chaque code point (0-255) devient l'octet identique. */
function latin1(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i)
  return bytes
}

function streamFromChunks(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let i = 0
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(chunks[i++])
      } else {
        controller.close()
      }
    },
  })
}

function streamThatErrors(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let i = 0
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(chunks[i++])
      } else {
        controller.error(new Error('boom'))
      }
    },
  })
}

const HTML = 'text/html'

describe('readCapped', () => {
  // La régression YouTube, en vrai : le lien de flux vit dans le <body>, ~48 Ko
  // après </head> (mesuré le 2026-08-02 sur /@MKBHD : </head> à l'octet 685 259,
  // le lien à 733 674). Une version antérieure de readCapped s'arrêtait à
  // </head>, sur l'hypothèse — fausse ici — que l'autodiscovery y vit toujours ;
  // ce test encode le vrai défaut : le lien doit survivre malgré un </head> et
  // ~700 Ko de remplissage avant lui, dans le body.
  it('lit jusqu\'au lien de flux même posé après </head>, dans le body', async () => {
    const filler = 'x'.repeat(700 * 1024)
    const html =
      `<html><head><title>t</title></head>` +
      `<body>${filler}` +
      `<link rel="alternate" type="application/rss+xml" href="/f.xml">` +
      `</body></html>`
    const stream = streamFromChunks(chunk(html, 8192))
    const result = await readCapped(stream, HTML, 'https://example.test/')
    expect(result).toContain('<link rel="alternate" type="application/rss+xml" href="/f.xml">')
  })

  it('sans </head>, reste borné par le plafond plutôt que de lire indéfiniment', async () => {
    const filler = 'y'.repeat(3 * 1024 * 1024) // 3 Mo, jamais de </head>
    const stream = streamFromChunks(chunk(filler, 4096))
    const result = await readCapped(stream, HTML, 'https://example.test/')
    expect(result).not.toBeNull()
    expect(result!.length).toBeLessThan(filler.length)
    // Une marge d'un chunk au-delà du plafond : la boucle vérifie le plafond
    // avant de lire, pas après.
    expect(result!.length).toBeLessThanOrEqual(MAX_PAGE_CHARS + 4096)
  })

  it('renvoie null sans rejection non gérée quand le flux échoue en cours de lecture', async () => {
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown) => unhandled.push(reason)
    process.on('unhandledRejection', onUnhandled)
    try {
      const stream = streamThatErrors(chunk('<html><head>', 4))
      const result = await readCapped(stream, HTML, 'https://example.test/')
      expect(result).toBeNull()
      // Laisse le tour de boucle courant s'écouler pour qu'une éventuelle
      // rejection non gérée sur reader.cancel() ait le temps de se manifester.
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(unhandled).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })

  it('décode selon le charset déclaré (iso-8859-1) au lieu de corrompre les accents', async () => {
    const html = '<html><head><link title="Actualités" rel="alternate" type="application/rss+xml" href="/f.xml"></head></html>'
    const stream = streamFromChunks([latin1(html)])
    const result = await readCapped(stream, 'text/html; charset=iso-8859-1', 'https://example.test/')
    expect(result).toContain('Actualités')
    expect(result).not.toContain('�')
  })
})
