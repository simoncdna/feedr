import { describe, expect, it, vi } from 'vitest'
import { fetchPage, MAX_PAGE_CHARS, readCapped, resolveRedirect } from '@/lib/fetch-page'

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

// `fetchPage` est toute la frontière SSRF d'une fonctionnalité dont le métier
// est de récupérer des URLs fournies par l'utilisateur. Sans ces tests, un
// "simplification" vers `redirect: 'follow'` + contrôle de l'URL finale — la
// faute exacte que le commentaire du code met en garde contre — passerait
// silencieusement : rien d'autre dans la suite ne l'aurait détectée.
describe('fetchPage — garde SSRF', () => {
  it('refuse une adresse de métadonnées cloud sans effectuer de requête réseau', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    try {
      const result = await fetchPage('http://169.254.169.254/latest/meta-data')
      expect(result).toBeNull()
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('refuse localhost sans effectuer de requête réseau', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    try {
      const result = await fetchPage('http://localhost/feed')
      expect(result).toBeNull()
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      fetchSpy.mockRestore()
    }
  })
})

describe('resolveRedirect', () => {
  it('accepte une redirection absolue vers un hôte public', () => {
    expect(resolveRedirect('https://exemple.fr/x', 'https://exemple.fr/')).toBe('https://exemple.fr/x')
  })

  it('résout un Location relatif contre l’URL courante', () => {
    expect(resolveRedirect('/x', 'https://exemple.fr/a/b')).toBe('https://exemple.fr/x')
  })

  it('refuse une redirection vers une adresse de métadonnées cloud', () => {
    expect(resolveRedirect('http://169.254.169.254/latest/meta-data', 'https://exemple.fr/')).toBeNull()
  })

  it('refuse une redirection vers une plage privée', () => {
    expect(resolveRedirect('http://10.0.0.5/', 'https://exemple.fr/')).toBeNull()
  })
})
